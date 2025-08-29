import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { config } from 'process'
import { setAutomationProcess } from './stop/route'

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'GSTR-2B Automation API is running',
    endpoints: {
      POST: '/api/gstr2b-automation'
    },
    requiredFields: ['username', 'password', 'year', 'quarter', 'month', 'client_folder'],
    example: {
      username: 'your_gst_username',
      password: 'your_gst_password',
      year: '2024-25',
      quarter: 'Q1',
      month: 'April',
      client_folder: 'ClientABC'
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    let body
    const contentType = request.headers.get('content-type') || ''
    
    console.log('Request content-type:', contentType)
    console.log('Request method:', request.method)
    
    // Handle different content types
    if (contentType.includes('application/json')) {
      try {
        body = await request.json()
        console.log('Parsed JSON body:', JSON.stringify(body, null, 2))
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError)
        return NextResponse.json({
          success: false,
          error: 'Invalid JSON',
          message: 'Request body is not valid JSON format'
        }, { status: 400 })
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Handle form data
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries())
      console.log('Parsed form data:', JSON.stringify(body, null, 2))
    } else {
      // Try to parse as text and then JSON
      try {
        const text = await request.text()
        console.log('Raw request body:', text)
        
        if (text) {
          body = JSON.parse(text)
          console.log('Parsed text as JSON:', JSON.stringify(body, null, 2))
        } else {
          body = {}
        }
      } catch (error) {
        console.error('Failed to parse request body:', error)
        return NextResponse.json({
          success: false,
          error: 'Invalid request format',
          message: 'Request body must be valid JSON or form data'
        }, { status: 400 })
      }
    }
    
    // Debug: Log the entire request body
    console.log('Final parsed body:', JSON.stringify(body, null, 2))
    
    const { username, password, year, quarter, month, client_folder } = body

    console.log('GSTR-2B automation request:', {
      username: username ? '***' : 'missing',
      password: password ? '***' : 'missing',
      year,
      quarter,
      month,
      client_folder
    })

    // Validate required fields
    if (!username || !password || !year || !quarter || !month || !client_folder) {
      const missingFields = []
      if (!username) missingFields.push('username')
      if (!password) missingFields.push('password')
      if (!year) missingFields.push('year')
      if (!quarter) missingFields.push('quarter')
      if (!month) missingFields.push('month')
      if (!client_folder) missingFields.push('client_folder')
      
      console.log('Missing required fields:', missingFields)
      
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        message: `Please provide: ${missingFields.join(', ')}`,
        receivedFields: Object.keys(body),
        missingFields
      }, { status: 400 })
    }

    // Get user's storage path from config
    let storagePath = ''
    try {
      // Try to get from API server first
      const configResponse = await fetch('http://localhost:3002/config', {
        method: 'GET'
      })
      console.log(configResponse);
      
      if (configResponse.ok) {
        const configData = await configResponse.json()
        storagePath = configData.storagePath || ''
        console.log('Storage path from API server:', storagePath)
      }
    } catch (error) {
      console.error('Error fetching storage path from API server:', error)
    }

    // Fallback: Try to get storage path from LowDB directly
    if (!storagePath) {
      try {
        const { getLocations } = await import('@/lib/location-db')
        const locations = await getLocations()
        const storageLocation = locations.find((loc: any) => loc.type === 'folder')
        storagePath = storageLocation?.path || ''
        console.log('Storage path from LowDB fallback:', storagePath)
      } catch (dbError) {
        console.error('Error fetching storage path from LowDB:', dbError)
      }
    }

    // Final fallback: Check localStorage or default path
    if (!storagePath) {
      console.log('No storage path found in API server or database')
    }

    if (!storagePath) {
      return NextResponse.json({
        success: false,
        error: 'Storage path not configured',
        message: 'Please configure storage path in setup wizard first. Go to Settings → Browse Storage Folder and select a folder for saving downloaded files.',
        troubleshooting: {
          steps: [
            '1. Open the app Settings tab',
            '2. Click "Browse Storage Folder"', 
            '3. Select a folder where you want to save GSTR-2B files',
            '4. Click "Save Configuration"',
            '5. Try the automation again'
          ],
          note: 'The storage path is used to organize downloaded files by year/quarter/month/client structure'
        }
      }, { status: 400 })
    }

    // Convert year to financial year format (e.g., "2024-25" to "2024-2025")
    let finYear = year
    if (year.includes('-') && year.length <= 7) {
      const parts = year.split('-')
      if (parts.length === 2 && parts[1].length === 2) {
        finYear = `20${parts[0].slice(-2)}-20${parts[1]}`
      }
    }

    console.log('Automation request details:', {
      finYear,
      quarter,
      month,
      client_folder,
      storagePath,
      automationServerUrl: 'http://localhost:3003/gstr2b'
    })

    console.log('Final storage path configuration:')
    console.log('- Storage path:', storagePath)
    console.log('- Is absolute:', path.isAbsolute(storagePath))
    console.log('- Full resolved path:', path.resolve(storagePath))

    // Ensure we use an absolute path for storage
    const absoluteStoragePath = path.isAbsolute(storagePath) ? storagePath : path.resolve(storagePath)
    console.log('- Using absolute storage path:', absoluteStoragePath)

    // Call the GSTR-2B automation server
    console.log('Starting GSTR-2B automation process...')
    
    // Create an AbortController to track and potentially stop the process
    const abortController = new AbortController()
    
    // Track the automation process for stopping
    setAutomationProcess({
      signal: abortController.signal,
      abort: () => abortController.abort(),
      timestamp: new Date().toISOString(),
      status: 'running'
    })

    const automationResponse = await fetch('http://localhost:3003/gstr2b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal, // Add abort signal
      body: JSON.stringify({
        username,
        password,
        quarter,
        month,
        finYear, // Use finYear instead of year
        client_folder,
        storagePath: absoluteStoragePath, // Use absolute path
        headless: true, // Run in headless mode
        returnFile: true, // Return file content in base64 format
        cleanupDownloads: false // Keep the downloaded files
      })
    })

    if (!automationResponse.ok) {
      const errorData = await automationResponse.json().catch(() => ({}))
      
      // Clear the automation process reference
      setAutomationProcess(null)
      
      return NextResponse.json({
        success: false,
        error: 'Automation server error',
        message: errorData.error || 'Failed to communicate with automation server',
        errorCode: errorData.errorCode || 'AUTOMATION_ERROR'
      }, { status: automationResponse.status })
    }

    const result = await automationResponse.json()

    if (!result.success) {
      // Clear the automation process reference
      setAutomationProcess(null)
      
      return NextResponse.json({
        success: false,
        message: result.error || 'Download failed',
        data: {
          durationMs: result.durationMs,
          errorCode: result.errorCode,
          errorDetail: result.errorDetail
        }
      })
    }

    // The automation server already saves the file to the correct location with proper folder structure
    // No need to reorganize the file here since it's already in the right place
    
    // Clear the automation process reference
    setAutomationProcess(null)
    
    return NextResponse.json({
      success: true,
      message: 'GSTR-2B downloaded and organized successfully',
      data: {
        filePath: result.filePath, // File is already in the correct location
        fileBase64: result.fileBase64, // Include base64 data
        durationMs: result.durationMs,
        folderStructure: {
          year,
          quarter,
          month,
          client_folder,
          fullPath: result.filePath ? path.dirname(result.filePath) : null
        }
      }
    })

  } catch (error) {
    console.error('GSTR-2B automation API error:', error)
    
    // Clear the automation process reference on error
    setAutomationProcess(null)
    
    // Check if error is due to abort (user stopped)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        error: 'Process stopped by user',
        message: 'GSTR-2B automation was stopped by user request'
      }, { status: 499 }) // 499 Client Closed Request
    }
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}
