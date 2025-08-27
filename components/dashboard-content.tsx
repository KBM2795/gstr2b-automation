"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { N8nIntegration } from "@/components/n8n-integration"
import { GSTR2BAutomation } from "@/components/gstr2b-automation"
import { SetupStatusCard } from "@/components/setup-status-card"
import { FileSpreadsheet, FolderOpen, Calculator, FileText, Download } from "lucide-react"

interface DashboardContentProps {
  config: { excelPath: string; storagePath: string }
}

export function DashboardContent({ config }: DashboardContentProps) {
  const [activeTab, setActiveTab] = useState("process")
  const [year, setYear] = useState("")
  const [quarter, setQuarter] = useState("")
  const [month, setMonth] = useState("")

  // Define months for each quarter (financial year basis)
  const quarterMonths = {
    Q1: [
      { value: "April", label: "April" },
      { value: "May", label: "May" },
      { value: "June", label: "June" }
    ],
    Q2: [
      { value: "July", label: "July" },
      { value: "August", label: "August" },
      { value: "September", label: "September" }
    ],
    Q3: [
      { value: "October", label: "October" },
      { value: "November", label: "November" },
      { value: "December", label: "December" }
    ],
    Q4: [
      { value: "January", label: "January" },
      { value: "February", label: "February" },
      { value: "March", label: "March" }
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
      // Process GSTR2B file row by row
      const response = await fetch('/api/process-gstr2b', {
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
        console.log('GSTR2B processing completed:', result)
        alert(
          `GSTR2B processing completed!\n\n` +
          `Total Rows: ${result.summary.totalRows}\n` +
          `Processed: ${result.summary.processedRows}\n` +
          `Success Rate: ${result.summary.successRate}\n` +
          `${result.summary.errorCount > 0 ? `Errors: ${result.summary.errorCount}` : ''}`
        )
      } else {
        console.error('Processing failed:', result)
        
        // Special handling for captcha errors
        if (result.captchaError) {
          alert(
            `🚫 CAPTCHA SERVICE EXHAUSTED\n\n` +
            `Processing stopped early to avoid wasting resources.\n\n` +
            `📊 PROGRESS SUMMARY:\n` +
            `• Total Rows: ${result.summary?.totalRows || 0}\n` +
            `• Processed: ${result.summary?.processedRows || 0}\n` +
            `• Success Rate: ${result.summary?.successRate || '0%'}\n` +
            `• Stopped Early: ${result.summary?.stoppedEarly ? 'Yes' : 'No'}\n\n` +
            `🔧 SOLUTION:\n` +
            `1. Check TrueCaptcha balance: https://apitruecaptcha.org\n` +
            `2. Check AntiCaptcha balance: https://anti-captcha.com\n` +
            `3. Add credits to your captcha service account\n` +
            `4. Try processing again once credits are added\n\n` +
            `Error: ${result.captchaErrorMessage || 'Captcha service credits exhausted'}`
          )
        } else {
          alert(`Processing failed: ${result.error}\n\n${result.message}`)
        }
      }
    } catch (error) {
      console.error('Failed to process GSTR2B:', error)
      alert('Failed to process GSTR2B file. Please check if the file exists and try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Setup Status */}
      <SetupStatusCard />

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
            <p className="text-sm text-muted-foreground font-mono truncate" title={config.excelPath}>
              {config.excelPath || 'No file selected'}
            </p>
            {!config.excelPath && (
              <p className="text-xs text-red-500 mt-1">
                Please select an Excel/CSV file in the setup wizard first
              </p>
            )}
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

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <button
          onClick={() => setActiveTab("process")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "process"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calculator className="h-4 w-4" />
          Process Existing File
        </button>
        <button
          onClick={() => setActiveTab("download")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "download"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Download className="h-4 w-4" />
          Auto Download GSTR-2B
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "process" && (
        <div className="space-y-6">
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
            disabled={!year || !quarter || !month || !config.excelPath || isProcessing}
          >
            <FileText className="h-4 w-4 mr-2" />
            {isProcessing ? 'Processing Excel File...' : 'Process GSTR2B Excel File'}
          </Button>
          
          {!config.excelPath && (
            <p className="text-sm text-amber-600 text-center mt-2">
              Please select an Excel/CSV file in the setup wizard before processing
            </p>
          )}
        </CardContent>
      </Card>

      {/* n8n Workflow Integration */}
      <N8nIntegration />
        </div>
      )}

      {activeTab === "download" && (
        <GSTR2BAutomation config={config} />
      )}
    </div>
  )
}
