"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react"

interface LogEntry {
  id: number
  clientName: string
  status: "success" | "failed"
  message: string
  timestamp: string
}

export function LogsContent() {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Mock data - in real app this would come from your API
  const logs: LogEntry[] = [
    {
      id: 1,
      clientName: "Client A",
      status: "success",
      message: "Downloaded successfully",
      timestamp: "2024-01-15 10:30:00",
    },
    { id: 2, clientName: "Client B", status: "failed", message: "Login failed", timestamp: "2024-01-15 10:25:00" },
    { id: 3, clientName: "Client C", status: "success", message: "Data processed", timestamp: "2024-01-15 10:20:00" },
    { id: 4, clientName: "Client D", status: "success", message: "File uploaded", timestamp: "2024-01-15 10:15:00" },
    {
      id: 5,
      clientName: "Client E",
      status: "failed",
      message: "Connection timeout",
      timestamp: "2024-01-15 10:10:00",
    },
  ]

  const totalPages = Math.ceil(logs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentLogs = logs.slice(startIndex, endIndex)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Activity Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.clientName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {log.status === "success" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={log.status === "success" ? "text-green-600" : "text-red-600"}>
                      {log.status === "success" ? "Done" : "Failed"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{log.message}</TableCell>
                <TableCell className="text-muted-foreground">{log.timestamp}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, logs.length)} of {logs.length} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
