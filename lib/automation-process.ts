// Utility functions for managing automation process state

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

// Function to clear the automation process
export function clearAutomationProcess() {
  automationProcess = null
}
