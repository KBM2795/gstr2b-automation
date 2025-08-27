"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Eye, EyeOff, AlertCircle, CheckCircle, Clock } from "lucide-react"

interface GSTR2BAutomationProps {
  config: { excelPath: string; storagePath: string }
}

export function GSTR2BAutomation({ config }: GSTR2BAutomationProps) {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    year: "",
    quarter: "",
    month: "",
    client_folder: ""
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Financial year options
  const financialYears = [
    "2024-25",
    "2023-24", 
    "2022-23",
    "2021-22",
    "2020-21"
  ]

  // Quarter options
  const quarters = [
    { value: "Q1", label: "Q1 (Apr-Jun)" },
    { value: "Q2", label: "Q2 (Jul-Sep)" },
    { value: "Q3", label: "Q3 (Oct-Dec)" },
    { value: "Q4", label: "Q4 (Jan-Mar)" }
  ]

  // Quarter months mapping
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Reset month when quarter changes
    if (field === 'quarter') {
      setFormData(prev => ({ ...prev, month: "" }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.username || !formData.password || !formData.year || !formData.quarter || !formData.month || !formData.client_folder) {
      setResult({
        success: false,
        message: "Please fill in all required fields including client folder name"
      })
      return
    }

    setIsProcessing(true)
    setResult(null)

    try {
      const response = await fetch('/api/gstr2b-automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        console.log('GSTR-2B downloaded successfully:', data.data?.filePath)
      }

    } catch (error) {
      console.error('GSTR-2B automation error:', error)
      setResult({
        success: false,
        message: 'Network error: Unable to connect to automation service'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusIcon = () => {
    if (isProcessing) return <Clock className="h-4 w-4 animate-spin" />
    if (result?.success) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (result && !result.success) return <AlertCircle className="h-4 w-4 text-red-600" />
    return <Download className="h-4 w-4" />
  }

  const getStatusColor = () => {
    if (result?.success) return "text-green-600"
    if (result && !result.success) return "text-red-600"
    return "text-blue-600"
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          GSTR-2B Automation
        </CardTitle>
        <CardDescription>
          Automatically download GSTR-2B files from GST portal using your credentials
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* GST Credentials */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium text-sm">GST Portal Credentials</h3>
            
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username *
              </Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="Enter your GST username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password *
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Enter your GST password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Period Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="year" className="text-sm font-medium">
                Financial Year *
              </Label>
              <Select value={formData.year} onValueChange={(value) => handleInputChange('year', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select financial year" />
                </SelectTrigger>
                <SelectContent>
                  {financialYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quarter" className="text-sm font-medium">
                Quarter *
              </Label>
              <Select value={formData.quarter} onValueChange={(value) => handleInputChange('quarter', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  {quarters.map((quarter) => (
                    <SelectItem key={quarter.value} value={quarter.value}>
                      {quarter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month" className="text-sm font-medium">
                Month *
              </Label>
              <Select 
                value={formData.month} 
                onValueChange={(value) => handleInputChange('month', value)} 
                disabled={!formData.quarter}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.quarter ? "Select month" : "Select quarter first"} />
                </SelectTrigger>
                <SelectContent>
                  {formData.quarter && quarterMonths[formData.quarter as keyof typeof quarterMonths]?.map((monthOption) => (
                    <SelectItem key={monthOption.value} value={monthOption.value}>
                      {monthOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Client Folder */}
          <div className="space-y-2">
            <Label htmlFor="client_folder" className="text-sm font-medium">
              Client Folder Name *
            </Label>
            <Input
              id="client_folder"
              type="text"
              value={formData.client_folder}
              onChange={(e) => handleInputChange('client_folder', e.target.value)}
              placeholder="Enter client folder name (e.g., ClientABC)"
              required
            />
            <p className="text-xs text-muted-foreground">
              Files will be organized as: {config.storagePath ? `${config.storagePath}/` : ''}{formData.year || 'YYYY'}/{formData.quarter || 'QX'}/{formData.month || 'Month'}/{formData.client_folder || 'ClientName'}/
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isProcessing}
          >
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              {isProcessing ? 'Downloading GSTR-2B...' : 'Download GSTR-2B'}
            </div>
          </Button>

          {/* Result Display */}
          {result && (
            <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${getStatusColor()}`}>
                    {result.message}
                  </p>
                  {result.data?.filePath && (
                    <p className="text-sm text-muted-foreground mt-1">
                      File saved: {result.data.filePath}
                    </p>
                  )}
                  {result.data?.folderStructure && (
                    <div className="text-sm text-muted-foreground mt-2">
                      <p className="font-medium">Organized Structure:</p>
                      <p className="font-mono text-xs bg-muted p-2 rounded mt-1">
                        📁 {result.data.folderStructure.year}<br/>
                        └── 📁 {result.data.folderStructure.quarter}<br/>
                        &nbsp;&nbsp;&nbsp;&nbsp;└── 📁 {result.data.folderStructure.month}<br/>
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📁 {result.data.folderStructure.client_folder}<br/>
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📄 GSTR-2B file
                      </p>
                    </div>
                  )}
                  {result.data?.organizationError && (
                    <p className="text-sm text-amber-600 mt-1">
                      ⚠️ Organization Warning: {result.data.organizationError}
                    </p>
                  )}
                  {result.data?.durationMs && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Completed in {Math.round(result.data.durationMs / 1000)}s
                    </p>
                  )}
                  {result.data?.errorCode && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Error Code: {result.data.errorCode}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
