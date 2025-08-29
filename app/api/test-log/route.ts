import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Force Node.js runtime to avoid fetch errors in Electron/production
export const runtime = 'nodejs'

// Test endpoint to create a log entry manually
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientName = 'TEST_CLIENT', status = 200, message = 'Test log entry' } = body

    // Create log entry
    const logEntry = {
      "Client Name": clientName,
      "status": status,
      "message": message,
      "timestamp": new Date().toISOString(),
      "id": Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }

    // Create logs directory if it doesn't exist
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    // Create log file for today
    const today = new Date().toISOString().split('T')[0]
    const logFile = path.join(logDir, `webhook-responses-${today}.log`)
    
    // Append log entry to file
    const logLine = JSON.stringify(logEntry) + '\n'
    fs.appendFileSync(logFile, logLine)
    
    console.log('Test log saved to file:', logFile)
    console.log('Test log entry:', JSON.stringify(logEntry, null, 2))

    return NextResponse.json({
      success: true,
      message: 'Test log entry created successfully',
      logEntry,
      logFile,
      date: today
    })

  } catch (error) {
    console.error('Test log error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create test log',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to create a simple test log
export async function GET(request: NextRequest) {
  try {
    // Create a simple test log entry
    const logEntry = {
      "Client Name": "TEST_GET_CLIENT",
      "status": 200,
      "message": "Test GET log entry",
      "timestamp": new Date().toISOString(),
      "id": Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }

    // Create logs directory if it doesn't exist
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    // Create log file for today
    const today = new Date().toISOString().split('T')[0]
    const logFile = path.join(logDir, `webhook-responses-${today}.log`)
    
    // Append log entry to file
    const logLine = JSON.stringify(logEntry) + '\n'
    fs.appendFileSync(logFile, logLine)
    
    console.log('Test GET log saved to file:', logFile)

    return NextResponse.json({
      success: true,
      message: 'Test GET log entry created successfully',
      logEntry,
      logFile,
      date: today
    })

  } catch (error) {
    console.error('Test GET log error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create test GET log',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
