import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { setProcessStopFlag, shouldStopProcessing, setCurrentProcessInfo } from './stop/route'

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

      try {
        console.log(`Sending row ${i} to webhook...`)
        
        // Create AbortController for timeout (increased to 3 minutes for GSTR-2B automation)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minute timeout (180 seconds)

        // Send to n8n webhook (updated URL format)
        const webhookResponse = await fetch('http://127.0.0.1:5678/webhook/gstr2b-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(enrichedData),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text()
          errors.push(`Row ${i}: Webhook failed - ${errorText}`)
          console.error(`Failed to send row ${i} to webhook:`, errorText)
          console.error(`Webhook response status:`, webhookResponse.status)
          console.error(`Webhook response headers:`, Object.fromEntries(webhookResponse.headers.entries()))
          
          // Check for captcha errors in error response
          if (errorText.toLowerCase().includes('captcha recharge') || 
              errorText.toLowerCase().includes('captcha limit') ||
              errorText.includes('CAPTCHA_LIMIT')) {
            captchaErrorOccurred = true
            captchaErrorMessage = errorText
            console.log('CAPTCHA ERROR DETECTED in error response - Stopping further processing')
          }
          
          // Log webhook error response with more details
          const errorLog = {
            "Client Name": rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`,
            "status": webhookResponse.status,
            "message": errorText || `HTTP ${webhookResponse.status}`,
            "webhook_url": "http://127.0.0.1:5678/webhook/gstr2b-email",
            "error_details": {
              "status_code": webhookResponse.status,
              "status_text": webhookResponse.statusText,
              "response_body": errorText
            }
          }
          console.log('Webhook Error Log:', JSON.stringify(errorLog, null, 2))
          
          // Save error log to file
          saveLogToFile(errorLog)
          
        } else {
          processedRows++
          
          try {
            const responseText = await webhookResponse.text()
            console.log(`Raw webhook response for row ${i}:`, responseText)
            
            let webhookResult
            let logMessage = "Success"
            let clientName = rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`
            
            // Try to parse response as JSON
            try {
              webhookResult = JSON.parse(responseText)
              console.log(`Parsed webhook response for row ${i}:`, webhookResult)
              
              // Extract data from n8n webhook response format
              if (webhookResult['Client Name']) {
                clientName = webhookResult['Client Name']
              }
              
              // Extract meaningful message from webhook response
              if (webhookResult.message) {
                logMessage = webhookResult.message
                
                // Parse nested error messages from automation server
                if (typeof webhookResult.message === 'string' && webhookResult.message.includes('{"success":false')) {
                  try {
                    // Extract the JSON error from the string
                    const errorMatch = webhookResult.message.match(/\{.*\}/);
                    if (errorMatch) {
                      const nestedError = JSON.parse(errorMatch[0]);
                      if (nestedError.message) {
                        logMessage = nestedError.message;
                        console.log(`Extracted nested error message: ${logMessage}`);
                        
                        // Check for captcha-related errors
                        if (nestedError.message.toLowerCase().includes('captcha recharge') || 
                            nestedError.message.toLowerCase().includes('captcha limit') ||
                            nestedError.errorCode === 'CAPTCHA_LIMIT') {
                          captchaErrorOccurred = true
                          captchaErrorMessage = nestedError.message
                          console.log('CAPTCHA ERROR DETECTED - Stopping further processing')
                        }
                      }
                      if (nestedError.errorCode) {
                        console.log(`Error code: ${nestedError.errorCode}`);
                      }
                    }
                  } catch (parseError) {
                    console.log('Failed to parse nested error:', parseError);
                  }
                }
              } else if (webhookResult.error && webhookResult.error.name) {
                logMessage = webhookResult.error.name
              } else if (webhookResult.result) {
                logMessage = webhookResult.result
              } else if (webhookResult.status) {
                logMessage = webhookResult.status
              } else if (webhookResult.data) {
                logMessage = JSON.stringify(webhookResult.data)
              } else {
                // If the response structure doesn't match expected format, log the full response
                logMessage = JSON.stringify(webhookResult)
              }
            } catch (jsonError) {
              console.log(`JSON parse error for row ${i}:`, jsonError)
              // If not JSON, use the raw response text
              logMessage = responseText || "Success"
            }
            
            // Log webhook success response with n8n format
            const successLog = {
              "Client Name": clientName,
              "status": webhookResult?.status || webhookResponse.status,
              "message": logMessage,
              "webhook_response": responseText, // Include raw response for debugging
              "webhook_url": "http://127.0.0.1:5678/webhook/gstr2b-email",
              "n8n_response": webhookResult // Include parsed n8n response
            }
            console.log('Webhook Success Log:', JSON.stringify(successLog, null, 2))
            console.log(`Row ${i} sent successfully to webhook. Response:`, responseText)
            
            // Save success log to file
            saveLogToFile(successLog)
            
          } catch (parseError) {
            console.log(`Row ${i} - Error processing webhook response:`, parseError)
            
            // Save basic success log with error info
            const basicSuccessLog = {
              "Client Name": rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`,
              "status": webhookResponse.status,
              "message": `Success - Response processing error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
              "webhook_url": "http://127.0.0.1:5678/webhook/gstr2b-email"
            }
            saveLogToFile(basicSuccessLog)
          }
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error sending row ${i} to webhook:`, errorMessage)
        console.error(`Full error details:`, error)
        
        // Log error in specified format with more context
        const errorLog = {
          "Client Name": rowObject['Client Name'] || rowObject['client_name'] || `Row ${i}`,
          "status": 500, // Internal error status
          "message": errorMessage,
          "webhook_url": "http://127.0.0.1:5678/webhook/gstr2b-email",
          "error_type": error instanceof Error ? error.constructor.name : 'Unknown',
          "error_details": {
            "full_error": error instanceof Error ? error.stack : String(error)
          }
        }
        console.log('Webhook Error Log:', JSON.stringify(errorLog, null, 2))
        
        // Save error log to file
        saveLogToFile(errorLog)
        
        if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
          errors.push(`Row ${i}: Request timeout - GSTR-2B automation took longer than 3 minutes`)
        } else if (errorMessage.includes('ECONNREFUSED')) {
          errors.push(`Row ${i}: n8n server not reachable`)
        } else {
          errors.push(`Row ${i}: ${errorMessage}`)
        }
      }

      // Small delay to avoid overwhelming the webhook
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
