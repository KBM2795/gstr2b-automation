"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { LogsManagement } from "@/components/logs-management"
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

interface LogEntry {
  id: number
  clientName: string
  status: "success" | "failed"
  message: string
  timestamp: string
}

interface ActivityLogEntry {
  id: string
  activity: string
  message: string
  timestamp: string
  status: string
  [key: string]: any // Allow additional fields
}

export function LogsContent() {
  const [activeTab, setActiveTab] = useState("webhook-logs")
  const [currentPage, setCurrentPage] = useState(1)
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return now.toISOString().split('T')[0] // YYYY-MM-DD format
  })
  const itemsPerPage = 10

  // Real logs would come from your actual activity tracking
  // For now, showing empty state since webhook logs are the main feature
  const logs: LogEntry[] = []

  const totalPages = Math.ceil(logs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentLogs = logs.slice(startIndex, endIndex)

  // Activity logs pagination
  const activityTotalPages = Math.ceil(activityLogs.length / itemsPerPage)
  const activityStartIndex = (currentPage - 1) * itemsPerPage
  const activityEndIndex = activityStartIndex + itemsPerPage
  const currentActivityLogs = activityLogs.slice(activityStartIndex, activityEndIndex)

  // Fetch activity logs
  const fetchActivityLogs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/activity-logs?date=${selectedDate}`)
      if (response.ok) {
        const data = await response.json()
        setActivityLogs(data.logs || [])
      } else {
        console.error('Failed to fetch activity logs:', response.statusText)
        setActivityLogs([])
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      setActivityLogs([])
    } finally {
      setIsLoading(false)
    }
  }

  // Load activity logs when tab changes or date changes
  useEffect(() => {
    if (activeTab === "activity-logs") {
      fetchActivityLogs()
    }
  }, [activeTab, selectedDate])

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab("webhook-logs")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "webhook-logs"
              ? "bg-white text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Webhook Logs
        </button>
        <button
          onClick={() => setActiveTab("activity-logs")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "activity-logs"
              ? "bg-white text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Activity Logs
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "webhook-logs" && (
        <LogsManagement />
      )}

      {activeTab === "activity-logs" && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Activity Logs</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="activity-date" className="text-sm font-medium">Date:</label>
                <input
                  id="activity-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
                <Button 
                  onClick={fetchActivityLogs} 
                  disabled={isLoading}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 text-gray-400 animate-spin" />
                <p className="text-gray-500">Loading activity logs...</p>
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity Logs</h3>
                <p className="text-gray-500 mb-4">
                  Activity logs for {selectedDate} will appear here when you perform GSTR-2B processing.
                </p>
                <p className="text-sm text-gray-400">
                  For webhook logs from Excel processing, check the "Webhook Logs" tab above.
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Activity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentActivityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.activity || log.message}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {log.status === "success" || log.status === "started" || log.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className={`text-sm font-medium ${
                              log.status === "success" || log.status === "started" || log.status === "completed"
                                ? "text-green-700" 
                                : "text-red-700"
                            }`}>
                              {log.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={log.message}>
                            {log.message}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {activityTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-700">
                      Showing {activityStartIndex + 1} to {Math.min(activityEndIndex, activityLogs.length)} of{" "}
                      {activityLogs.length} activity logs
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {activityTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === activityTotalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
