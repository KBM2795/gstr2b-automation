'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface SetupStatus {
  setupComplete: boolean
  firstRun: boolean
  setupDate?: string
  version?: string
}

export function SetupStatusCard() {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [isRunningSetup, setIsRunningSetup] = useState(false)
  const [setupMessage, setSetupMessage] = useState<string>('')

  useEffect(() => {
    checkSetupStatus()
  }, [])

  const checkSetupStatus = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const status = await window.electronAPI.getSetupStatus()
        setSetupStatus(status)
      }
    } catch (error) {
      console.error('Failed to get setup status:', error)
    }
  }

  const runSetup = async () => {
    if (!window.electronAPI) return

    setIsRunningSetup(true)
    setSetupMessage('Installing browser components...')

    try {
      const result = await window.electronAPI.runSetup()
      
      if (result.success) {
        setSetupMessage('Setup completed successfully!')
        await checkSetupStatus() // Refresh status
      } else {
        setSetupMessage(`Setup failed: ${result.message}`)
      }
    } catch (error) {
      setSetupMessage(`Setup error: ${error}`)
    } finally {
      setIsRunningSetup(false)
    }
  }

  if (!setupStatus) {
    return null
  }

  if (setupStatus.setupComplete) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">✓ Setup Complete</CardTitle>
          <CardDescription>
            All required components are installed and ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {setupStatus.setupDate && (
            <p className="text-sm text-gray-600">
              Setup completed on: {new Date(setupStatus.setupDate).toLocaleString()}
            </p>
          )}
          {setupStatus.version && (
            <p className="text-sm text-gray-600">
              Version: {setupStatus.version}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-orange-600">⚠ Setup Required</CardTitle>
        <CardDescription>
          Browser automation components need to be installed for GSTR-2B automation to work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>This will install Playwright Chromium browser for automation.</p>
          <p>The installation may take a few minutes depending on your internet connection.</p>
        </div>
        
        {setupMessage && (
          <div className={`p-3 rounded border ${
            setupMessage.includes('successfully') 
              ? 'bg-green-50 border-green-200 text-green-800'
              : setupMessage.includes('failed') || setupMessage.includes('error')
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {setupMessage}
          </div>
        )}
        
        <Button 
          onClick={runSetup} 
          disabled={isRunningSetup}
          className="w-full"
        >
          {isRunningSetup ? 'Installing...' : 'Install Components'}
        </Button>
      </CardContent>
    </Card>
  )
}
