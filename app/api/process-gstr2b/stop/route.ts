import { NextRequest, NextResponse } from 'next/server'
import { setProcessStopFlag, getCurrentProcessInfo, shouldStopProcessing, setCurrentProcessInfo } from '@/lib/process-state'

// Force Node.js runtime to avoid fetch errors in Electron/production
export const runtime = 'nodejs'

// POST endpoint to stop the processing
export async function POST(request: NextRequest) {
  try {
    console.log('Stop processing request received')

    // Set the stop flag
    console.log('Setting stop flag to true...')
    setProcessStopFlag(true)
    console.log(`Stop flag set - current value: true`)

    // Clear current process info
    setCurrentProcessInfo(null)

    return NextResponse.json({
      success: true,
      message: 'Processing stop signal sent. Current row will complete, but no further rows will be processed.',
      stopped: true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Stop processing error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to stop processing',
      error: error instanceof Error ? error.message : 'Unknown error',
      stopped: false
    }, { status: 500 })
  }
}

// GET endpoint to check processing status
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Processing status check',
    isStopped: shouldStopProcessing(),
    processInfo: getCurrentProcessInfo(),
    timestamp: new Date().toISOString()
  })
}
