import { NextRequest, NextResponse } from 'next/server'

// Global variable to track processing state
let isProcessingStopped = false
let currentProcessInfo: any = null

// Function to set the stop flag (called from main process route)
export function setProcessStopFlag(stopped: boolean) {
  console.log(`Setting process stop flag to: ${stopped}`)
  isProcessingStopped = stopped
}

// Function to check if processing should stop
export function shouldStopProcessing() {
  console.log(`Checking stop flag - current value: ${isProcessingStopped}`)
  return isProcessingStopped
}

// Function to set current process info
export function setCurrentProcessInfo(info: any) {
  currentProcessInfo = info
}

// Function to get current process info
export function getCurrentProcessInfo() {
  return currentProcessInfo
}

// POST endpoint to stop the processing
export async function POST(request: NextRequest) {
  try {
    console.log('Stop processing request received')

    // Set the stop flag
    console.log('Setting stop flag to true...')
    isProcessingStopped = true
    console.log(`Stop flag set - current value: ${isProcessingStopped}`)

    // Clear current process info
    currentProcessInfo = null

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
    isStopped: isProcessingStopped,
    processInfo: currentProcessInfo,
    timestamp: new Date().toISOString()
  })
}
