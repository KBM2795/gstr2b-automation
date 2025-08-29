// Utility functions for managing GSTR2B processing state

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
