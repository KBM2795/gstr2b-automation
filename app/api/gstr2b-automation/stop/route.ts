import { NextRequest, NextResponse } from 'next/server'

// Global variable to track automation process
let automationProcess: any = null

// Function to set the automation process (called from main automation route)
export function setAutomationProcess(process: any) {
  automationProcess = process
}

// Function to get the automation process (for other modules to access)
export function getAutomationProcess() {
  return automationProcess
}

// POST endpoint to stop the automation
export async function POST(request: NextRequest) {
  try {
    console.log('Stop automation request received')

    // Check if automation is running
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
      automationProcess = null

      return NextResponse.json({
        success: true,
        message: 'Automation process has been stopped successfully',
        stopped: true,
        timestamp: new Date().toISOString()
      })

    } catch (abortError) {
      console.error('Error stopping automation process:', abortError)
      
      // Clear the process reference anyway
      automationProcess = null

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
