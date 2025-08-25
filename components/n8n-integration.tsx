"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
// Update the import path below if Badge is located elsewhere, e.g. "@/components/Badge"
// import { Badge } from "@/components/Badge"
import { Badge } from "@/components/ui/badge"
import { Settings, Play, Square, ExternalLink, Workflow } from "lucide-react"

interface N8nStatus {
  isRunning: boolean
  port: number
  url: string
  dataPath: string
}

export function N8nIntegration() {
  const [n8nStatus, setN8nStatus] = useState<N8nStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

  useEffect(() => {
    checkN8nStatus()
    // Check status every 5 seconds
    const interval = setInterval(checkN8nStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const checkN8nStatus = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const status = await (window as any).electronAPI.getN8nStatus()
        setN8nStatus(status)
      }
    } catch (error) {
      console.error('Failed to get n8n status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startN8n = async () => {
    setIsStarting(true)
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.startN8n()
        if (result.success) {
          await checkN8nStatus() // Refresh status
        } else {
          alert(`Failed to start n8n: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('Failed to start n8n:', error)
      alert('Failed to start n8n. Please check the console.')
    } finally {
      setIsStarting(false)
    }
  }

  const stopN8n = async () => {
    setIsStopping(true)
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.stopN8n()
        if (result.success) {
          await checkN8nStatus() // Refresh status
        } else {
          alert(`Failed to stop n8n: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('Failed to stop n8n:', error)
      alert('Failed to stop n8n. Please check the console.')
    } finally {
      setIsStopping(false)
    }
  }

  const openN8nEditor = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.openExternal('http://localhost:5678')
    } else {
      window.open('http://localhost:5678', '_blank')
    }
  }

  const openN8nInstructions = () => {
    alert(`To start n8n workflow automation:

1. Open a new terminal/command prompt
2. Navigate to your project folder
3. Run: npm run n8n:standalone
4. Wait for "Editor is now accessible via..."
5. Click "Open n8n Editor" button

n8n will be available at http://localhost:5678`)
  }

  const createWorkflow = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const workflow = await (window as any).electronAPI.createN8nWorkflow()
        console.log('Created workflow:', workflow)
        alert('GSTR2B workflow template created! Check the n8n editor.')
      }
    } catch (error) {
      console.error('Failed to create workflow:', error)
      alert('Failed to create workflow. Please check the console.')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            n8n Workflow Automation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading n8n status...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          n8n Workflow Automation
          <Badge variant={n8nStatus?.isRunning ? "default" : "secondary"}>
            {n8nStatus?.isRunning ? "Running" : "Stopped"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Automate your GSTR2B processing with powerful workflows
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {n8nStatus?.isRunning ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">n8n Server Running</p>
                <p className="text-sm text-green-600 dark:text-green-300">
                  Port: {n8nStatus.port} | URL: {n8nStatus.url}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 dark:text-green-300">Active</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                onClick={openN8nEditor}
                variant="outline"
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open n8n Editor
              </Button>
              
              <Button
                onClick={createWorkflow}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Create GSTR2B Workflow
              </Button>

              <Button
                onClick={stopN8n}
                disabled={isStopping}
                variant="destructive"
                className="w-full"
              >
                <Square className="h-4 w-4 mr-2" />
                {isStopping ? 'Stopping...' : 'Stop n8n'}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Data Path:</strong> {n8nStatus.dataPath}</p>
              <p><strong>Features Available:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Automated Excel file processing</li>
                <li>GST data validation and reconciliation</li>
                <li>Report generation and email notifications</li>
                <li>Custom webhook integrations</li>
                <li>Scheduled workflow execution</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="flex items-center justify-center w-16 h-16 bg-muted rounded-full mx-auto">
              <Square className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">n8n Workflow Automation Available</p>
              <p className="text-sm text-muted-foreground">
                Start n8n for powerful workflow automation
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                onClick={startN8n}
                disabled={isStarting}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                {isStarting ? 'Starting...' : 'Start n8n'}
              </Button>
              <Button
                onClick={openN8nInstructions}
                variant="outline"
              >
                <Settings className="h-4 w-4 mr-2" />
                How to Start n8n
              </Button>
              <Button
                onClick={openN8nEditor}
                variant="outline"
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open n8n Editor
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1 text-left bg-muted/50 p-3 rounded">
              <p><strong>Quick Start:</strong></p>
              <p>1. Open terminal and run: <code className="bg-background px-1 rounded">npm run n8n:standalone</code></p>
              <p>2. Wait for startup message</p>
              <p>3. Click "Open n8n Editor" above</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
