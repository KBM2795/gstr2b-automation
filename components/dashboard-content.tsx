"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { N8nIntegration } from "@/components/n8n-integration"
import { FileSpreadsheet, FolderOpen, Calculator, FileText } from "lucide-react"

interface DashboardContentProps {
  config: { excelPath: string; storagePath: string }
}

export function DashboardContent({ config }: DashboardContentProps) {
  const [year, setYear] = useState("")
  const [quarter, setQuarter] = useState("")
  const [month, setMonth] = useState("")

  // Define months for each quarter (financial year basis)
  const quarterMonths = {
    Q1: [
      { value: "04", label: "April" },
      { value: "05", label: "May" },
      { value: "06", label: "June" }
    ],
    Q2: [
      { value: "07", label: "July" },
      { value: "08", label: "August" },
      { value: "09", label: "September" }
    ],
    Q3: [
      { value: "10", label: "October" },
      { value: "11", label: "November" },
      { value: "12", label: "December" }
    ],
    Q4: [
      { value: "01", label: "January" },
      { value: "02", label: "February" },
      { value: "03", label: "March" }
    ]
  }

  const [isProcessing, setIsProcessing] = useState(false)

  // Reset month when quarter changes
  useEffect(() => {
    setMonth("")
  }, [quarter])

  const handleProcessGSTR2B = async () => {
    setIsProcessing(true)
    const formData = { year, quarter, month }
    console.log("[v0] GSTR2B processing initiated:", formData)
    
    try {
      // Trigger n8n workflow
      const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year,
          quarter,
          month,
          filePath: config.excelPath,
          fileType: 'excel'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        console.log('Workflow triggered successfully:', result)
        alert('GSTR2B workflow started successfully! Check the n8n editor for progress.')
      } else {
        console.error('Workflow failed:', result)
        alert(`Workflow failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to trigger workflow:', error)
      alert('Failed to start workflow. Make sure n8n is running.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Configuration Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              GST Data Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground font-mono truncate">{config.excelPath}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-secondary" />
              Output Directory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground font-mono truncate">{config.storagePath}</p>
          </CardContent>
        </Card>
      </div>

      {/* GSTR2B Processing Form */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            GSTR2B Return Processing
          </CardTitle>
          <CardDescription>Configure parameters for automated GST return filing and reconciliation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="year" className="text-sm font-medium">
              Financial Year
            </Label>
            <Input
              id="year"
              placeholder="Enter financial year (e.g., 2024-25)"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quarter" className="text-sm font-medium">
              Quarter (Financial Year)
            </Label>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger>
                <SelectValue placeholder="Select quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Q1">Q1 (April - June)</SelectItem>
                <SelectItem value="Q2">Q2 (July - September)</SelectItem>
                <SelectItem value="Q3">Q3 (October - December)</SelectItem>
                <SelectItem value="Q4">Q4 (January - March)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="month" className="text-sm font-medium">
              Month
            </Label>
            <Select value={month} onValueChange={setMonth} disabled={!quarter}>
              <SelectTrigger>
                <SelectValue placeholder={quarter ? "Select month" : "Select quarter first"} />
              </SelectTrigger>
              <SelectContent>
                {quarter && quarterMonths[quarter as keyof typeof quarterMonths]?.map((monthOption) => (
                  <SelectItem key={monthOption.value} value={monthOption.value}>
                    {monthOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleProcessGSTR2B}
            className="w-full font-medium"
            size="lg"
            disabled={!year || !quarter || !month || isProcessing}
          >
            <FileText className="h-4 w-4 mr-2" />
            {isProcessing ? 'Starting Workflow...' : 'Process GSTR2B Return'}
          </Button>
        </CardContent>
      </Card>

      {/* n8n Workflow Integration */}
      <N8nIntegration />
    </div>
  )
}
