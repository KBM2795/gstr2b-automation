import { NextRequest, NextResponse } from 'next/server'
import { getAutomationProcess, clearAutomationProcess } from '@/lib/automation-process'

// Force Node.js runtime to avoid fetch errors in Electron/production
export const runtime = 'nodejs'

// POST endpoint to stop the automation
export async function POST(request: NextRequest) {
  try {
    console.log('Stop automation request received')

    // Check if automation is running
    const automationProcess = getAutomationProcess()
    if (!automationProcess) {
      return NextResponse.json({
        success: false,
        message: 'No active automation process found',
        stopped: false
      }, { status: 404 })
    }

    // Try to abort the process
    try {
      if (automationProcess.abort && typeof automationProcess.abort === 'function') {
        // Call the abort function to cancel the fetch request
        automationProcess.abort()
        console.log('Automation process aborted via AbortController')
      } else if (automationProcess.signal && !automationProcess.signal.aborted) {
        // If we have direct access to the signal, abort it
        automationProcess.signal.abort?.()
        console.log('Automation process aborted via signal')
      }

      // Clear the process reference
      clearAutomationProcess()

      return NextResponse.json({
        success: true,
        message: 'Automation process has been stopped successfully',
        stopped: true,
        timestamp: new Date().toISOString()
      })

    } catch (abortError) {
      console.error('Error stopping automation process:', abortError)
      
      // Clear the process reference anyway
      clearAutomationProcess()

      return NextResponse.json({
        success: true,
        message: 'Automation process reference cleared (process may have already ended)',
        stopped: true,
        warning: 'Could not directly abort process, but cleared reference',
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Stop automation error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to stop automation process',
      error: error instanceof Error ? error.message : 'Unknown error',
      stopped: false
    }, { status: 500 })
  }
}

// GET endpoint to check if automation is running
export async function GET() {
  const automationProcess = getAutomationProcess()
  const isRunning = automationProcess !== null
  
  return NextResponse.json({
    success: true,
    message: 'Automation status check',
    isRunning,
    processInfo: automationProcess ? {
      status: automationProcess.status,
      startTime: automationProcess.timestamp,
      hasAbortController: typeof automationProcess.abort === 'function',
      isSignalAborted: automationProcess.signal?.aborted || false
    } : null,
    timestamp: new Date().toISOString()
  })
}
