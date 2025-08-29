import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { setProcessStopFlag, shouldStopProcessing, setCurrentProcessInfo } from '@/lib/process-state'

// Force Node.js runtime to avoid fetch errors in Electron/production
export const runtime = 'nodejs'

// Helper function to get saved webhook URL
async function getWebhookUrl(): Promise<string> {
  try {
    // Try to get from save-location API
    const response = await fetch('http://localhost:3000/api/save-location')
    if (response.ok) {
      const data = await response.json()
      const webhookLocation = data.locations.find((loc: any) => loc.type === 'webhook')
      if (webhookLocation?.path) {
        return webhookLocation.path
      }
    }
  } catch (error) {
    console.log('Failed to get webhook URL from API, using default')
  }
  
  // Default webhook URL if not found
  return 'https://n8nautonerve-fjdudrhtahe3bje7.southeastasia-01.azurewebsites.net/webhook-test/gstr2b-email'
}

// Helper function to save logs to file
function saveLogToFile(logEntry: any) {
  try {
    // Get current date in local timezone for consistent date handling
    const now = new Date()
    const timestamp = now.toISOString()
    
    // Use local date for file naming to match UI expectations
    const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
    const dateString = localDate.toISOString().split('T')[0] // YYYY-MM-DD format in local time
    
    console.log('Current time (UTC):', timestamp)
    console.log('Local date for file:', dateString)
    console.log('Timezone offset (minutes):', now.getTimezoneOffset())
    
    // Add timestamp and ID if not present
    const logWithMetadata = {
      ...logEntry,
      timestamp: logEntry.timestamp || timestamp,
      id: logEntry.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: dateString, // Add explicit date field for filtering
      local_date: dateString // Also add local_date for clarity
    }

    // Create logs directory if it doesn't exist
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    // Create log file using the local date format
    const logFile = path.join(logDir, `webhook-responses-${dateString}.log`)
    
    // Append log entry to file
    const logLine = JSON.stringify(logWithMetadata) + '\n'
    fs.appendFileSync(logFile, logLine)
    
    console.log('Log saved to file:', logFile)
    console.log('Log entry saved for local date:', dateString)
    console.log('Log entry:', JSON.stringify(logWithMetadata, null, 2))
    return true
  } catch (error) {
    console.error('Failed to save log to file:', error)
    return false
  }
}

// Helper function to save activity logs to file
function saveActivityLogToFile(logEntry: any) {
  try {
    // Get current date in local timezone for consistent date handling
    const now = new Date()
    const timestamp = now.toISOString()
    
    // Use local date for file naming to match UI expectations
    const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
    const dateString = localDate.toISOString().split('T')[0] // YYYY-MM-DD format in local time
    
    // Add timestamp and ID if not present
    const logWithMetadata = {
      ...logEntry,
      timestamp: logEntry.timestamp || timestamp,
      id: logEntry.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: dateString, // Add explicit date field for filtering
      local_date: dateString // Also add local_date for clarity
    }

    // Create logs directory if it doesn't exist
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    // Create activity log file using the local date format
    const logFile = path.join(logDir, `activity-logs-${dateString}.log`)
    
    // Append log entry to file
    const logLine = JSON.stringify(logWithMetadata) + '\n'
    fs.appendFileSync(logFile, logLine)
    
    console.log('Activity log saved to file:', logFile)
    console.log('Activity log entry saved for local date:', dateString)
    console.log('Activity log entry:', JSON.stringify(logWithMetadata, null, 2))
    return true
  } catch (error) {
    console.error('Failed to save activity log to file:', error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { year, quarter, month, filePath, fileType } = body

    // Get webhook URL from saved configuration
    const webhookUrl = await getWebhookUrl()
    console.log('Using webhook URL:', webhookUrl)

    console.log('Processing file:', {
      filePath,
      fileName: filePath ? path.basename(filePath) : 'N/A',
      exists: filePath ? fs.existsSync(filePath) : false,
      size: filePath && fs.existsSync(filePath) ? fs.statSync(filePath).size : 'N/A'
    })

    // Validate file path
    if (!filePath || filePath.trim() === '') {
      return Response.json({
        success: false,
        error: 'No file path provided',
        message: 'Please select an Excel file first using the file picker in setup.'
      }, { status: 400 })
    }

    // Check if file exists and is accessible
    try {
      if (!fs.existsSync(filePath)) {
        return Response.json({
          success: false,
          error: 'File not found',
          message: `The file "${filePath}" does not exist. Please check the file path and try again.`
        }, { status: 400 })
      }

      // Check if file is accessible (try to read file stats)
      const stats = fs.statSync(filePath)
      if (!stats.isFile()) {
        return Response.json({
          success: false,
          error: 'Invalid file',
          message: `"${filePath}" is not a valid file.`
        }, { status: 400 })
      }

      // Check file extension
      const fileExtension = path.extname(filePath).toLowerCase()
      if (!['.xlsx', '.xls', '.csv'].includes(fileExtension)) {
        return Response.json({
          success: false,
          error: 'Unsupported file format',
          message: `File "${filePath}" must be an Excel (.xlsx, .xls) or CSV (.csv) file.`
        }, { status: 400 })
      }

    } catch (fsError) {
      const errorMessage = fsError instanceof Error ? fsError.message : 'Unknown file system error'
      return Response.json({
        success: false,
        error: 'File access error',
        message: `Cannot access file "${filePath}". Error: ${errorMessage}`
      }, { status: 400 })
    }

    // Get file extension for processing
    const fileExtension = path.extname(filePath).toLowerCase()
    console.log('File extension detected:', fileExtension)

    // Read Excel or CSV file
    let workbook: XLSX.WorkBook
    let totalRows = 0
    let processedRows = 0
    let errors: string[] = []
    
    try {
      if (fileExtension === '.csv') {
        // For CSV files, read as text first then parse
        console.log('Reading CSV file...')
        const csvContent = fs.readFileSync(filePath, 'utf8')
        workbook = XLSX.read(csvContent, { type: 'string' })
      } else {
        // For Excel files, read as buffer first
        console.log('Reading Excel file...')
        const fileBuffer = fs.readFileSync(filePath)
        workbook = XLSX.read(fileBuffer, { type: 'buffer' })
      }
      
      console.log('File read successfully, worksheets:', workbook.SheetNames)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('File reading error:', errorMessage)
      return Response.json({
        success: false,
        error: 'Failed to read file',
        message: `Error reading file "${path.basename(filePath)}": ${errorMessage}. Please ensure the file is not open in Excel and try again.`
      }, { status: 400 })
    }

    // Get the first sheet (or you can specify sheet name)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Convert sheet to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    if (jsonData.length === 0) {
      return Response.json({
        success: false,
        error: 'Empty file',
        message: 'The Excel file contains no data'
      }, { status: 400 })
    }

    // Get headers from first row
    const headers = jsonData[0] as string[]
    totalRows = jsonData.length - 1 // Exclude header row

    console.log(`Found ${totalRows} data rows in Excel file`)

    // Log the start of processing to activity logs
    const processingStartLog = {
      "activity": "GSTR2B Processing Started",
      "message": `Started processing GSTR2B file with ${totalRows} rows`,
      "file": path.basename(filePath),
      "period": `${year}-${quarter}-${month}`,
      "total_rows": totalRows,
      "status": "started"
    }
    saveActivityLogToFile(processingStartLog)

    // Reset stop flag at start of processing
    setProcessStopFlag(false)

    // Process each row (skip header)
    let captchaErrorOccurred = false
    let captchaErrorMessage = ''
    
    for (let i = 1; i < jsonData.length; i++) {
      // Check if stop was requested before processing this row
      console.log(`Checking stop flag before processing row ${i + 1}...`)
      if (shouldStopProcessing()) {
        console.log(`Processing stopped at row ${i + 1} by user request`)
        const stopMessage = `Process stopped by user at row ${i + 1}. ${i} rows were processed successfully.`
        
        const stopLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'warning',
          message: stopMessage,
          details: `Total rows: ${jsonData.length - 1}, Processed: ${i}, Remaining: ${jsonData.length - 1 - i}`
        }
        saveActivityLogToFile(stopLog)
        
        return Response.json({ 
          success: false, 
          message: stopMessage,
          processedRows: i,
          totalRows: jsonData.length - 1,
          stopped: true
        })
      }
      
      console.log(`Stop flag check passed - processing row ${i + 1}`)
      
      // Update current process info for monitoring
      setCurrentProcessInfo({
        currentRow: i + 1,
        totalRows: jsonData.length - 1,
        status: 'processing'
      })
      
      // Stop processing if captcha error occurred
      if (captchaErrorOccurred) {
        console.log(`Skipping row ${i} due to captcha error`)
        errors.push(`Row ${i}: Skipped due to captcha recharge exhaustion`)
        continue
      }
      
      const rowData = jsonData[i] as any[]
      
      // Create row object with headers
      const rowObject: Record<string, any> = {}
      headers.forEach((header, index) => {
        rowObject[header] = rowData[index] || ''
      })

      // Add metadata
      const enrichedData = {
        ...rowObject,
        metadata: {
          year,
          quarter,
          month,
          rowNumber: i,
          totalRows,
          filePath,
          fileType,
          processedAt: new Date().toISOString()
        }
      }

      // Step 1: Prepare automation payload (moved outside try block for error handling)
      const automationPayload = {
        username: rowObject['ID'] || rowObject['id'] || '',
        password: rowObject['PASSWORD'] || rowObject['password'] || '',
        quarter: quarter,
        month: month,
        year: year,
        client_folder: rowObject['File No.'] || rowObject['file_no'] || ''
      }

      try {
        console.log(`Processing row ${i} - calling local automation API first...`)
        
        console.log('Automation payload:', automationPayload)
        
        // Create AbortController for local automation timeout
        const automationController = new AbortController()
        const automationTimeoutId = setTimeout(() => automationController.abort(), 300000) // 5 minute timeout
        
        const automationResponse = await fetch('http://localhost:3001/api/gstr2b-automation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(automationPayload),
          signal: automationController.signal
        })
        
        clearTimeout(automationTimeoutId)
        
        if (!automationResponse.ok) {
          const errorText = await automationResponse.text()
          let parsedError = null
          let detailedMessage = errorText
          
          // Try to parse error response as JSON for better error handling
          try {
            parsedError = JSON.parse(errorText)
            if (parsedError.error) {
              detailedMessage = parsedError.error
            } else if (parsedError.message) {
              detailedMessage = parsedError.message
            }
          } catch (parseError) {
            console.log(`Failed to parse automation error response as JSON: ${parseError}`)
          }
          
          errors.push(`Row ${i}: Local automation failed - ${detailedMessage}`)
          console.error(`Failed automation for row ${i}:`, {
            status: automationResponse.status,
            statusText: automationResponse.statusText,
            errorText: errorText,
            parsedError: parsedError
          })
          
          // Check for specific error types (captcha, network, etc.)
          let errorType = 'automation_error'
          if (detailedMessage.toLowerCase().includes('captcha')) {
            errorType = 'captcha_error'
          } else if (detailedMessage.toLowerCase().includes('timeout')) {
            errorType = 'timeout_error'
          } else if (detailedMessage.toLowerCase().includes('network')) {
            errorType = 'network_error'
          } else if (detailedMessage.toLowerCase().includes('authentication') || detailedMessage.toLowerCase().includes('login')) {
            errorType = 'auth_error'
          }
          
          // Log detailed automation error
          const errorLog = {
            "Client Name": rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`,
            "status": automationResponse.status,
            "message": `Local automation failed: ${detailedMessage}`,
            "step": "local_automation",
            "error_type": errorType,
            "error_details": {
              "status_code": automationResponse.status,
              "status_text": automationResponse.statusText,
              "raw_error": errorText,
              "parsed_error": parsedError,
              "automation_payload": automationPayload
            },
            "automation_url": "http://localhost:3001/api/gstr2b-automation"
          }
          saveLogToFile(errorLog)
          continue // Skip to next row if automation fails
        }
        
        // Get automation result (should contain base64 file data)
        let automationResult
        try {
          automationResult = await automationResponse.json()
          console.log('Automation completed for row', i, 'result summary:', {
            success: automationResult.success,
            hasData: !!automationResult.data,
            filePath: automationResult.filePath
          })
          
          // Check if automation was successful but returned an error
          if (automationResult.success === false) {
            const errorMessage = automationResult.error || automationResult.message || 'Unknown automation error'
            errors.push(`Row ${i}: Automation returned error - ${errorMessage}`)
            
            const errorLog = {
              "Client Name": rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`,
              "status": "automation_error",
              "message": `Automation returned error: ${errorMessage}`,
              "step": "local_automation_result",
              "error_details": automationResult,
              "automation_payload": automationPayload
            }
            saveLogToFile(errorLog)
            continue // Skip to next row if automation returned an error
          }
          
        } catch (jsonError) {
          const errorMessage = `Failed to parse automation response as JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`
          errors.push(`Row ${i}: ${errorMessage}`)
          console.error(`JSON parse error for automation response for row ${i}:`, jsonError)
          
          const errorLog = {
            "Client Name": rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`,
            "status": "json_parse_error",
            "message": errorMessage,
            "step": "local_automation_parse",
            "error_details": {
              "parse_error": jsonError instanceof Error ? jsonError.message : 'Unknown error',
              "automation_payload": automationPayload
            }
          }
          saveLogToFile(errorLog)
          continue // Skip to next row if we can't parse the automation response
        }
        
        // Step 2: Send result to external n8n webhook
        const webhookPayload = {
          ...enrichedData,
          automation_result: automationResult
        }
        
        console.log(`Sending row ${i} to external webhook...`)
        
        // Create AbortController for webhook timeout
        const webhookController = new AbortController()
        const webhookTimeoutId = setTimeout(() => webhookController.abort(), 180000) // 3 minute timeout
        
        // Send to external webhook
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
          signal: webhookController.signal
        })
        
        clearTimeout(webhookTimeoutId)

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text()
          errors.push(`Row ${i}: External webhook failed - ${errorText}`)
          console.error(`Failed to send row ${i} to external webhook:`, errorText)
          console.error(`External webhook response status:`, webhookResponse.status)
          console.error(`External webhook response headers:`, Object.fromEntries(webhookResponse.headers.entries()))
          
          // Determine appropriate error message based on status code
          let errorMessage = errorText || `HTTP ${webhookResponse.status}`
          if (webhookResponse.status === 404) {
            errorMessage = `Webhook endpoint not found (404): ${errorText || 'Endpoint unavailable'}`
          } else if (webhookResponse.status === 500) {
            errorMessage = `Webhook server error (500): ${errorText || 'Internal server error'}`
          } else if (webhookResponse.status === 503) {
            errorMessage = `Webhook service unavailable (503): ${errorText || 'Service temporarily unavailable'}`
          }
          
          // Log webhook error response with more details
          const errorLog = {
            "Client Name": rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`,
            "status": webhookResponse.status,
            "message": errorMessage,
            "webhook_url": webhookUrl,
            "step": "external_webhook",
            "error_details": {
              "status_code": webhookResponse.status,
              "status_text": webhookResponse.statusText,
              "response_body": errorText
            }
          }
          console.log('External Webhook Error Log:', JSON.stringify(errorLog, null, 2))
          
          // Save error log to file
          saveLogToFile(errorLog)
          
        } else {
          processedRows++
          
          try {
            const responseText = await webhookResponse.text()
            console.log(`Raw external webhook response for row ${i}:`, responseText)
            
            let webhookResult
            let logMessage = "Success - Processed through local automation and external webhook"
            let clientName = rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`
            
            // Try to parse response as JSON
            try {
              webhookResult = JSON.parse(responseText)
              console.log(`Parsed external webhook response for row ${i}:`, webhookResult)
              
              // Extract data from external webhook response format
              if (webhookResult['Client Name']) {
                clientName = webhookResult['Client Name']
              }
              
              // Extract meaningful message from webhook response - prefer email info over generic webhook message
              if (webhookResult.email_sent === true || webhookResult.message?.toLowerCase().includes('email')) {
                logMessage = `Email: ${webhookResult.message || 'Email sent successfully'}`
              } else if (webhookResult.message) {
                // Check if message contains meaningful info, avoid showing generic "External webhook:" prefix
                const message = webhookResult.message
                if (message.toLowerCase().includes('email') || message.toLowerCase().includes('sent') || message.toLowerCase().includes('delivered')) {
                  logMessage = `Email: ${message}`
                } else if (webhookResult.status === 200 || webhookResult.status === "200") {
                  // For successful webhook responses (200 status), assume it's email-related since this is an email webhook
                  logMessage = `Email: ${message}`
                } else {
                  logMessage = message
                }
              } else if (webhookResult.status === 200 || webhookResult.status === "200") {
                // Success response without message
                logMessage = "Email: Successfully processed"
              }
              
            } catch (parseError) {
              console.log(`External webhook response for row ${i} is not JSON, treating as plain text`)
              webhookResult = { message: responseText }
              // For plain text responses, check if they contain email-related keywords
              if (responseText.toLowerCase().includes('email') || responseText.toLowerCase().includes('sent') || responseText.toLowerCase().includes('delivered')) {
                logMessage = `Email: ${responseText}`
              } else if (webhookResponse.ok) {
                // For successful webhook responses (2xx status), assume it's email-related since this is an email webhook
                logMessage = `Email: ${responseText || 'Successfully processed'}`
              } else {
                logMessage = responseText || "Success - Processed through local automation and external webhook"
              }
            }
            
            // Log successful processing
            const successLog = {
              "Client Name": clientName,
              "status": "success",
              "message": logMessage,
              "automation_data": automationResult,
              "webhook_response": webhookResult
            }
            console.log('Success Log:', JSON.stringify(successLog, null, 2))
            
            // Save success log to file
            saveLogToFile(successLog)
            
          } catch (parseError) {
            console.log(`Row ${i} - Error processing external webhook response:`, parseError)
            
            // Save basic success log with error info
            const basicSuccessLog = {
              "Client Name": rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`,
              "status": webhookResponse.status,
              "message": `Success - External webhook response processing error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
              "webhook_url": webhookUrl,
              "automation_data": automationResult
            }
            saveLogToFile(basicSuccessLog)
          }
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error processing row ${i}:`, errorMessage)
        console.error(`Full error details:`, error)
        
        // Determine which step failed based on error details
        let failedStep = 'unknown'
        let errorUrl = 'unknown'
        
        if (errorMessage.includes('localhost:3001') || errorMessage.includes('automation')) {
          failedStep = 'local_automation'
          errorUrl = 'http://localhost:3001/api/gstr2b-automation'
        } else if (errorMessage.includes('webhook') || errorMessage.includes('n8nautonerve')) {
          failedStep = 'external_webhook'
          errorUrl = webhookUrl
        }
        
        // Categorize error types
        let errorType = 'general_error'
        if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
          errorType = 'timeout_error'
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
          errorType = 'connection_error'
        } else if (errorMessage.includes('fetch')) {
          errorType = 'network_error'
        }
        
        // Log error in specified format with comprehensive context
        const errorLog = {
          "Client Name": rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`,
          "status": 500, // Internal error status
          "message": `${failedStep} failed: ${errorMessage}`,
          "step": failedStep,
          "error_type": errorType,
          "error_details": {
            "error_message": errorMessage,
            "error_name": error instanceof Error ? error.constructor.name : 'Unknown',
            "error_stack": error instanceof Error ? error.stack : String(error),
            "automation_payload": failedStep === 'local_automation' ? automationPayload : undefined
          },
          "target_url": errorUrl
        }
        console.log('Processing Error Log:', JSON.stringify(errorLog, null, 2))
        
        // Save error log to file
        saveLogToFile(errorLog)
        
        // Add user-friendly error messages
        if (errorType === 'timeout_error') {
          if (failedStep === 'local_automation') {
            errors.push(`Row ${i}: Local automation timeout - Process took longer than 5 minutes`)
          } else {
            errors.push(`Row ${i}: External webhook timeout - Request took longer than 3 minutes`)
          }
        } else if (errorType === 'connection_error') {
          if (failedStep === 'local_automation') {
            errors.push(`Row ${i}: Cannot connect to local automation server (http://localhost:3001)`)
          } else {
            errors.push(`Row ${i}: Cannot connect to external webhook server - Service may be unavailable`)
          }
        } else if (failedStep === 'external_webhook' && errorMessage.includes('404')) {
          errors.push(`Row ${i}: Webhook endpoint not found (404) - Service configuration issue`)
        } else {
          errors.push(`Row ${i}: ${errorMessage}`)
        }
      }

      // Small delay to avoid overwhelming the servers
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Save processing summary log
    const summaryMessage = captchaErrorOccurred 
      ? `Processing stopped due to captcha error. Processed ${processedRows}/${totalRows} rows before stopping.`
      : `Processed ${processedRows}/${totalRows} rows. Success rate: ${((processedRows / totalRows) * 100).toFixed(2)}%`
    
    const summaryLog = {
      "Client Name": "PROCESSING_SUMMARY",
      "status": captchaErrorOccurred ? 400 : 200,
      "message": summaryMessage,
      "summary": {
        totalRows,
        processedRows,
        errorCount: errors.length,
        successRate: totalRows > 0 ? ((processedRows / totalRows) * 100).toFixed(2) + '%' : '0%',
        period: `${year}-${quarter}-${month}`,
        filePath: path.basename(filePath),
        processedAt: new Date().toISOString(),
        captchaError: captchaErrorOccurred,
        captchaErrorMessage: captchaErrorOccurred ? captchaErrorMessage : undefined,
        stoppedEarly: captchaErrorOccurred
      }
    }
    saveActivityLogToFile(summaryLog)

    // Clear stop flag and process info on completion
    setProcessStopFlag(false)
    setCurrentProcessInfo({
      currentRow: 0,
      totalRows: 0,
      status: 'completed'
    })

    // Return summary
    return Response.json({
      success: !captchaErrorOccurred, // Mark as failed if captcha error occurred
      message: captchaErrorOccurred 
        ? 'GSTR2B processing stopped due to captcha service limitation'
        : 'GSTR2B file processing completed',
      captchaError: captchaErrorOccurred,
      captchaErrorMessage: captchaErrorOccurred ? captchaErrorMessage : undefined,
      summary: {
        totalRows,
        processedRows,
        errorCount: errors.length,
        successRate: totalRows > 0 ? ((processedRows / totalRows) * 100).toFixed(2) + '%' : '0%',
        stoppedEarly: captchaErrorOccurred
      },
      details: {
        year,
        quarter,
        month,
        filePath,
        sheetName,
        headers,
        processedAt: new Date().toISOString()
      },
      errors: errors.length > 0 ? errors : undefined,
      troubleshooting: captchaErrorOccurred ? {
        issue: 'Captcha service credits exhausted',
        solutions: [
          '1. Check your TrueCaptcha account balance and add credits',
          '2. Verify your AntiCaptcha account has sufficient balance',
          '3. Consider running automation in non-headless mode for manual captcha solving',
          '4. Wait for captcha service credits to refresh (if applicable)'
        ],
        serviceUrls: {
          trueCaptcha: 'https://apitruecaptcha.org',
          antiCaptcha: 'https://anti-captcha.com'
        }
      } : undefined
    })

  } catch (error) {
    console.error('API error:', error)
    
    // Clear stop flag and process info on error
    setProcessStopFlag(false)
    setCurrentProcessInfo({
      currentRow: 0,
      totalRows: 0,
      status: 'error'
    })
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return Response.json({
      success: false,
      error: errorMessage,
      message: 'Failed to process GSTR2B file'
    }, { status: 500 })
  }
}
