'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Trash2, TrashIcon, RefreshCw, Calendar, CheckSquare, Square, Play, Pause } from 'lucide-react'

interface LogEntry {
  id: string
  'Client Name': string
  status: number
  message: string
  timestamp: string
}

export function LogsManagement() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  
  // Ensure we use local date consistently
  const getLocalDateString = () => {
    const now = new Date()
    // Adjust for timezone to get local date
    const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
    return localDate.toISOString().split('T')[0]
  }
  
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [message, setMessage] = useState<string>('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  console.log('LogsManagement initialized with local date:', getLocalDateString())

  useEffect(() => {
    console.log('Date changed to:', selectedDate)
    fetchLogs()
    // Test if API is accessible
    testAPIConnection()
  }, [selectedDate])

  // Auto-refresh logs every 5 seconds when enabled
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (autoRefresh) {
      interval = setInterval(() => {
        console.log('Auto-refreshing logs for date:', selectedDate)
        fetchLogs()
        setLastRefresh(new Date())
      }, 5000) // Refresh every 5 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [autoRefresh, selectedDate])

  const testAPIConnection = async () => {
    try {
      console.log('Testing API connection...')
      const response = await fetch('/api/webhook-logs')
      console.log('API test response status:', response.status)
      console.log('API test response headers:', Object.fromEntries(response.headers.entries()))
      
      if (response.ok) {
        const data = await response.json()
        console.log('API test response data:', data)
      } else {
        const text = await response.text()
        console.log('API test error response:', text)
      }
    } catch (error) {
      console.error('API test failed:', error)
    }
  }

  const fetchLogs = async () => {
    setIsLoading(true)
    setMessage('')
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(selectedDate)) {
      setMessage('Invalid date format. Please select a valid date.')
      setIsLoading(false)
      return
    }
    
    console.log('Fetching logs for date:', selectedDate)
    
    try {
      // Try Next.js API first
      const apiUrl = `/api/webhook-logs?date=${selectedDate}`
      console.log('API request URL:', apiUrl)
      
      const response = await fetch(apiUrl)
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        throw new Error('Server returned non-JSON response (API endpoint may not exist)')
      }
      
      const data = await response.json()
      console.log('API response:', data)
      
      if (data.success) {
        setLogs(data.logs || [])
        setSelectedLogs(new Set()) // Clear selections when fetching new logs
        if (data.logs.length === 0) {
          setMessage(`No logs found for ${selectedDate}`)
        } else {
          setMessage(`Found ${data.logs.length} logs for ${selectedDate}`)
        }
      } else {
        setMessage(`Error: ${data.message}`)
        setLogs([])
      }
    } catch (error) {
      console.error('Next.js API failed, trying Electron API...', error)
      
      // Fallback to Electron API
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.readLogFile) {
        try {
          const result = await window.electronAPI.readLogFile(selectedDate)
          if (result.success) {
            setLogs(result.logs || [])
            setSelectedLogs(new Set())
            if ((result.logs || []).length === 0) {
              setMessage(`No logs found for ${selectedDate}`)
            } else {
              setMessage(`Loaded ${result.logs?.length} logs via Electron API`)
            }
          } else {
            setMessage(`Electron API error: ${result.message}`)
            setLogs([])
          }
        } catch (electronError) {
          console.error('Electron API also failed:', electronError)
          if (error instanceof Error) {
            if (error.message.includes('SyntaxError') || error.message.includes('Unexpected token')) {
              setMessage('API endpoint not available. Logs may still be saved to files in the background.')
            } else if (error.message.includes('Failed to fetch')) {
              setMessage('Cannot connect to API server. Please check if the app is running properly.')
            } else {
              setMessage(`Failed to fetch logs: ${error.message}`)
            }
          } else {
            setMessage('Unknown error occurred while fetching logs')
          }
          setLogs([])
        }
      } else {
        // No fallback available
        if (error instanceof Error) {
          if (error.message.includes('SyntaxError') || error.message.includes('Unexpected token')) {
            setMessage('API endpoint not available. Make sure the Next.js dev server is running on port 3001.')
          } else if (error.message.includes('Failed to fetch')) {
            setMessage('Cannot connect to API server. Please check if the app is running properly.')
          } else {
            setMessage(`Failed to fetch logs: ${error.message}`)
          }
        } else {
          setMessage('Unknown error occurred while fetching logs')
        }
        setLogs([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const clearAllLogs = async () => {
    if (!window.confirm(`Are you sure you want to clear ALL logs for ${selectedDate}? This action cannot be undone.`)) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      // Try Next.js API first
      const response = await fetch(`/api/webhook-logs?date=${selectedDate}&all=true`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setMessage(`All logs cleared for ${selectedDate}`)
        setLogs([])
        setSelectedLogs(new Set())
      } else {
        setMessage(`Error clearing logs: ${data.message}`)
      }
    } catch (error) {
      console.error('Next.js API failed, trying Electron API...', error)
      
      // Fallback to Electron API
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.clearLogFile) {
        try {
          const result = await window.electronAPI.clearLogFile(selectedDate, { all: true })
          if (result.success) {
            setMessage(`All logs cleared for ${selectedDate} (via Electron API)`)
            setLogs([])
            setSelectedLogs(new Set())
          } else {
            setMessage(`Electron API error: ${result.message}`)
          }
        } catch (electronError) {
          console.error('Electron API also failed:', electronError)
          setMessage(`Failed to clear logs: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      } else {
        console.error('Clear all logs error:', error)
        if (error instanceof Error) {
          setMessage(`Failed to clear logs: ${error.message}`)
        } else {
          setMessage('Unknown error occurred while clearing logs')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const clearSelectedLogs = async () => {
    if (selectedLogs.size === 0) {
      setMessage('Please select logs to delete')
      return
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedLogs.size} selected log(s)? This action cannot be undone.`)) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      // Try Next.js API first
      const logIds = Array.from(selectedLogs).join(',')
      const response = await fetch(`/api/webhook-logs?date=${selectedDate}&ids=${logIds}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setMessage(`Deleted ${selectedLogs.size} log(s)`)
        await fetchLogs() // Refresh logs
      } else {
        setMessage(`Error deleting logs: ${data.message}`)
      }
    } catch (error) {
      console.error('Next.js API failed, trying Electron API...', error)
      
      // Fallback to Electron API
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.clearLogFile) {
        try {
          const logIds = Array.from(selectedLogs)
          const result = await window.electronAPI.clearLogFile(selectedDate, { ids: logIds })
          if (result.success) {
            setMessage(`Deleted ${selectedLogs.size} log(s) (via Electron API)`)
            await fetchLogs() // Refresh logs
          } else {
            setMessage(`Electron API error: ${result.message}`)
          }
        } catch (electronError) {
          console.error('Electron API also failed:', electronError)
          setMessage(`Failed to delete logs: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      } else {
        console.error('Clear selected logs error:', error)
        if (error instanceof Error) {
          setMessage(`Failed to delete logs: ${error.message}`)
        } else {
          setMessage('Unknown error occurred while deleting logs')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const toggleLogSelection = (logId: string) => {
    const newSelection = new Set(selectedLogs)
    if (newSelection.has(logId)) {
      newSelection.delete(logId)
    } else {
      newSelection.add(logId)
    }
    setSelectedLogs(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedLogs.size === logs.length) {
      setSelectedLogs(new Set()) // Deselect all
    } else {
      setSelectedLogs(new Set(logs.map(log => log.id))) // Select all
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600'
    if (status >= 400 && status < 500) return 'text-red-600'
    if (status >= 500) return 'text-red-800'
    return 'text-gray-600'
  }

  const getStatusBadge = (status: number) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium'
    if (status >= 200 && status < 300) return `${baseClasses} bg-green-100 text-green-800`
    if (status >= 400 && status < 500) return `${baseClasses} bg-red-100 text-red-800`
    if (status >= 500) return `${baseClasses} bg-red-100 text-red-900`
    return `${baseClasses} bg-gray-100 text-gray-800`
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Webhook Logs Management
        </CardTitle>
        <CardDescription>
          View and manage webhook response logs by date
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Selection and Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="date-select">Select Date</Label>
            <div className="flex gap-2">
              <Input
                id="date-select"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  console.log('Date input changed to:', e.target.value)
                  setSelectedDate(e.target.value)
                }}
                className="w-auto"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = getLocalDateString()
                  console.log('Setting date to today (local):', today)
                  setSelectedDate(today)
                }}
                className="px-3"
              >
                Today
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={fetchLogs} 
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button 
              onClick={() => setAutoRefresh(!autoRefresh)} 
              disabled={isLoading}
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
            >
              {autoRefresh ? (
                <Pause className="h-4 w-4 mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Auto-refresh
            </Button>
            
            <Button 
              onClick={testAPIConnection} 
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              Test API
            </Button>
            
            <Button 
              onClick={clearSelectedLogs}
              disabled={isLoading || selectedLogs.size === 0}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Selected ({selectedLogs.size})
            </Button>
            
            <Button 
              onClick={clearAllLogs}
              disabled={isLoading || logs.length === 0}
              variant="destructive"
              size="sm"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-3 rounded border ${
            message.includes('Error') || message.includes('Failed') || message.includes('not available')
              ? 'bg-red-50 border-red-200 text-red-800'
              : message.includes('API endpoint not available') || message.includes('Cannot connect')
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="font-medium mb-1">
              {message.includes('not available') || message.includes('Cannot connect') ? '⚠️ Connection Issue' : 
               message.includes('Error') || message.includes('Failed') ? '❌ Error' : 'ℹ️ Info'}
            </div>
            <div className="text-sm">{message}</div>
            {message.includes('not available') && (
              <div className="text-xs mt-2 opacity-75">
                💡 Tip: Logs are saved to files in the background. Manual log management requires the API server.
              </div>
            )}
          </div>
        )}

        {/* Fallback message when API is not available */}
        {!isLoading && logs.length === 0 && !message && (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No Webhook Logs</h3>
            <p className="text-muted-foreground mb-4">
              No webhook logs found for {selectedDate}.
            </p>
            <p className="text-sm text-muted-foreground">
              Logs are automatically created when you process Excel files with webhooks.
            </p>
          </div>
        )}

        {/* Logs Table */}
        {logs.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleSelectAll}
                      className="p-0 h-6 w-6"
                    >
                      {selectedLogs.size === logs.length ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className={selectedLogs.has(log.id) ? 'bg-primary/10 dark:bg-primary/20' : ''}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLogSelection(log.id)}
                        className="p-0 h-6 w-6"
                      >
                        {selectedLogs.has(log.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {log['Client Name'] || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <span className={getStatusBadge(log.status)}>
                        {log.status}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={log.message}>
                      {log.message}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary */}
        {logs.length > 0 && (
          <div className="text-sm text-gray-600 flex justify-between items-center">
            <span>Total logs: {logs.length} | Selected: {selectedLogs.size} | Date: {selectedDate}</span>
            {autoRefresh && (
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Auto-refreshing | Last: {lastRefresh.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
