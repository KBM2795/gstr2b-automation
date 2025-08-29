import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Force Node.js runtime to avoid infinite redirects in Electron/production
export const runtime = 'nodejs'

// POST endpoint to log webhook responses
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientName, status, message, timestamp = new Date().toISOString() } = body

    // Create log entry in the format you specified
    const logEntry = {
      "Client Name": clientName,
      "status": status,
      "message": message,
      "timestamp": timestamp,
      "id": Date.now().toString() // Add unique ID for log management
    }

    // Log to console
    console.log('Webhook Response Log:', JSON.stringify(logEntry, null, 2))

    // Optional: Save to log file
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    const logFile = path.join(logDir, `webhook-responses-${new Date().toISOString().split('T')[0]}.log`)
    const logLine = JSON.stringify(logEntry) + '\n'
    
    fs.appendFileSync(logFile, logLine)

    return NextResponse.json({
      success: true,
      message: 'Log entry saved',
      logEntry
    })

  } catch (error) {
    console.error('Webhook logging error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to log webhook response',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to retrieve logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedDate = searchParams.get('date')
    
    // Use requested date or default to today in YYYY-MM-DD format
    let date: string
    if (requestedDate) {
      // Validate and normalize the date format
      const parsedDate = new Date(requestedDate)
      if (isNaN(parsedDate.getTime())) {
        // Invalid date, use today
        date = new Date().toISOString().split('T')[0]
        console.warn('Invalid date requested:', requestedDate, 'Using today:', date)
      } else {
        // Use the normalized date format
        date = parsedDate.toISOString().split('T')[0]
      }
    } else {
      date = new Date().toISOString().split('T')[0]
    }
    
    console.log('Fetching logs for date:', date)
    
    const logDir = path.join(process.cwd(), 'logs')
    const logFile = path.join(logDir, `webhook-responses-${date}.log`)
    
    console.log('Looking for log file:', logFile)

    if (!fs.existsSync(logFile)) {
      console.log('Log file does not exist:', logFile)
      
      // Check if logs directory exists and list available log files
      if (fs.existsSync(logDir)) {
        const availableFiles = fs.readdirSync(logDir)
          .filter(file => file.startsWith('webhook-responses-') && file.endsWith('.log'))
        console.log('Available log files:', availableFiles)
      }
      
      return NextResponse.json({
        success: true,
        logs: [],
        message: `No logs found for ${date}`,
        date,
        logFile
      })
    }

    const logContent = fs.readFileSync(logFile, 'utf8')
    console.log('Log file size:', logContent.length, 'characters')
    
    const logLines = logContent.trim().split('\n').filter(line => line.trim() !== '')
    console.log('Number of log lines:', logLines.length)
    
    const logs = logLines.map((line, index) => {
      try {
        const parsed = JSON.parse(line)
        // Add index-based ID if not present
        if (!parsed.id) {
          parsed.id = `${date}-${index}`
        }
        // Ensure date field is present for filtering
        if (!parsed.date) {
          parsed.date = date
        }
        return parsed
      } catch (parseError) {
        console.error('Failed to parse log line:', line, 'Error:', parseError)
        return { 
          id: `${date}-${index}`,
          'Client Name': 'PARSE_ERROR',
          message: line, 
          timestamp: new Date().toISOString(),
          status: 'parse_error',
          date: date
        }
      }
    })

    console.log('Successfully parsed logs:', logs.length)

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      date,
      logFile,
      message: logs.length > 0 ? `Found ${logs.length} logs for ${date}` : `No logs found for ${date}`
    })

  } catch (error) {
    console.error('Failed to retrieve logs:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE endpoint to clear logs
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const logIds = searchParams.get('ids') // Comma-separated log IDs
    const clearAll = searchParams.get('all') === 'true'

    const logDir = path.join(process.cwd(), 'logs')
    const logFile = path.join(logDir, `webhook-responses-${date}.log`)

    if (!fs.existsSync(logFile)) {
      return NextResponse.json({
        success: false,
        error: 'Log file not found',
        message: `No log file found for ${date}`
      }, { status: 404 })
    }

    if (clearAll) {
      // Clear all logs for the date
      fs.unlinkSync(logFile)
      console.log(`All logs cleared for ${date}`)
      
      return NextResponse.json({
        success: true,
        message: `All logs cleared for ${date}`,
        date,
        cleared: 'all'
      })
    }

    if (logIds) {
      // Clear specific logs
      const idsToDelete = logIds.split(',').map(id => id.trim())
      const logContent = fs.readFileSync(logFile, 'utf8')
      const logs = logContent.trim().split('\n')
      
      const filteredLogs = logs.filter((line, index) => {
        try {
          const parsed = JSON.parse(line)
          const logId = parsed.id || `${date}-${index}`
          return !idsToDelete.includes(logId)
        } catch {
          const logId = `${date}-${index}`
          return !idsToDelete.includes(logId)
        }
      })

      // Write filtered logs back to file
      if (filteredLogs.length === 0) {
        fs.unlinkSync(logFile)
      } else {
        fs.writeFileSync(logFile, filteredLogs.join('\n') + '\n')
      }

      console.log(`Deleted ${logs.length - filteredLogs.length} specific logs for ${date}`)
      
      return NextResponse.json({
        success: true,
        message: `Deleted ${logs.length - filteredLogs.length} specific logs`,
        date,
        cleared: idsToDelete,
        remaining: filteredLogs.length
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid delete request',
      message: 'Please specify either all=true or provide specific log ids'
    }, { status: 400 })

  } catch (error) {
    console.error('Failed to clear logs:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to clear logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
