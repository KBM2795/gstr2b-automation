import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Force Node.js runtime to avoid fetch errors in Electron/production
export const runtime = 'nodejs'

// GET endpoint to retrieve activity logs
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
    
    console.log('Fetching activity logs for date:', date)
    
    const logDir = path.join(process.cwd(), 'logs')
    const logFile = path.join(logDir, `activity-logs-${date}.log`)
    
    console.log('Looking for activity log file:', logFile)

    if (!fs.existsSync(logFile)) {
      console.log('Activity log file does not exist:', logFile)
      
      // Check if logs directory exists and list available log files
      if (fs.existsSync(logDir)) {
        const availableFiles = fs.readdirSync(logDir)
          .filter(file => file.startsWith('activity-logs-') && file.endsWith('.log'))
        console.log('Available activity log files:', availableFiles)
      }
      
      return NextResponse.json({
        success: true,
        logs: [],
        message: `No activity logs found for ${date}`,
        date,
        logFile
      })
    }

    const logContent = fs.readFileSync(logFile, 'utf8')
    console.log('Activity log file size:', logContent.length, 'characters')
    
    const logLines = logContent.trim().split('\n').filter(line => line.trim() !== '')
    console.log('Number of activity log lines:', logLines.length)
    
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
        console.error('Failed to parse activity log line:', line, 'Error:', parseError)
        return { 
          id: `${date}-${index}`,
          activity: 'PARSE_ERROR',
          message: line, 
          timestamp: new Date().toISOString(),
          status: 'parse_error',
          date: date
        }
      }
    })

    console.log('Successfully parsed activity logs:', logs.length)

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      date,
      logFile,
      message: logs.length > 0 ? `Found ${logs.length} activity logs for ${date}` : `No activity logs found for ${date}`
    })

  } catch (error) {
    console.error('Failed to retrieve activity logs:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve activity logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE endpoint to clear activity logs
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const logIds = searchParams.get('ids') // Comma-separated log IDs
    const clearAll = searchParams.get('all') === 'true'

    const logDir = path.join(process.cwd(), 'logs')
    const logFile = path.join(logDir, `activity-logs-${date}.log`)

    if (!fs.existsSync(logFile)) {
      return NextResponse.json({
        success: false,
        error: 'Activity log file not found',
        message: `No activity log file found for ${date}`
      }, { status: 404 })
    }

    if (clearAll) {
      // Clear all activity logs for the date
      fs.unlinkSync(logFile)
      console.log(`All activity logs cleared for ${date}`)
      
      return NextResponse.json({
        success: true,
        message: `All activity logs cleared for ${date}`,
        date,
        cleared: 'all'
      })
    }

    if (logIds) {
      // Clear specific activity logs
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

      console.log(`Deleted ${logs.length - filteredLogs.length} specific activity logs for ${date}`)
      
      return NextResponse.json({
        success: true,
        message: `Deleted ${logs.length - filteredLogs.length} specific activity logs`,
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
    console.error('Failed to clear activity logs:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to clear activity logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
