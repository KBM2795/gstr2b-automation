"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FolderOpen, FileSpreadsheet, Settings } from "lucide-react"

interface SetupWizardProps {
  onComplete: (config: { excelPath: string; storagePath: string; webhookUrl: string }) => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [excelPath, setExcelPath] = useState("")
  const [storagePath, setStoragePath] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("https://n8nautonerve-fjdudrhtahe3bje7.southeastasia-01.azurewebsites.net/webhook-test/gstr2b-email")
  const [hideWizard, setHideWizard] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // Check if locations are already saved
    const checkSavedLocations = async () => {
      try {
        // Check Electron storage if available
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          const locations = await (window as any).electronAPI.getLocations()
          const hasFile = locations.some((loc: any) => loc.type === 'file')
          const hasFolder = locations.some((loc: any) => loc.type === 'folder')
          const hasWebhook = locations.some((loc: any) => loc.type === 'webhook')
          if (hasFile && hasFolder && hasWebhook) setHideWizard(true)
        } else {
          // Check localStorage as fallback
          const savedConfig = localStorage.getItem("gstr2bConfig")
          if (savedConfig) {
            const config = JSON.parse(savedConfig)
            if (config.excelPath && config.storagePath && config.webhookUrl) {
              setHideWizard(true)
            }
          }
        }
      } catch (error) {
        console.error('Failed to check saved locations:', error)
      }
    }

    checkSavedLocations()
  }, [mounted]);

  const handleFileSelect = async (type: "excel" | "storage") => {
    try {
      // Check if we're in Electron environment
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        if (type === "excel") {
          // Use native Electron file dialog for Excel files
          const filePath = await (window as any).electronAPI.openFileDialog()
          if (filePath) {
            setExcelPath(filePath)
          }
        } else {
          // Use native Electron directory dialog for folder selection
          const folderPath = await (window as any).electronAPI.openDirectoryDialog()
          if (folderPath) {
            setStoragePath(folderPath)
          }
        }
      } else {
        // Fallback for web environment
        if (type === "excel") {
          const input = document.createElement("input")
          input.type = "file"
          input.accept = ".xlsx,.xls,.csv"
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) {
              setExcelPath(file.name) // Note: web browsers can only provide file name, not full path
            }
          }
          input.click()
        } else {
          const input = document.createElement("input")
          input.type = "file"
          input.webkitdirectory = true
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files
            if (files && files.length > 0) {
              const path = files[0].webkitRelativePath.split("/")[0]
              setStoragePath(path) // Note: web browsers can only provide relative path
            }
          }
          input.click()
        }
      }
    } catch (error) {
      console.error("File selection error:", error)
    }
  }


  const handleContinue = async () => {
    if (excelPath && storagePath && webhookUrl) {
      try {
        // Check if we're in Electron
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          // Use Electron storage
          await (window as any).electronAPI.saveLocation({ path: excelPath, type: 'file' })
          await (window as any).electronAPI.saveLocation({ path: storagePath, type: 'folder' })
          await (window as any).electronAPI.saveLocation({ path: webhookUrl, type: 'webhook' })
        }
        
        if (mounted && typeof window !== 'undefined') {
          localStorage.setItem("gstr2bConfig", JSON.stringify({ excelPath, storagePath, webhookUrl }))
        }
        onComplete({ excelPath, storagePath, webhookUrl })
      } catch (error) {
        console.error('Failed to save locations:', error)
        // Still proceed if there's an error
        onComplete({ excelPath, storagePath, webhookUrl })
      }
    }
  }

  if (hideWizard) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border-2">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Settings className="h-8 w-8 text-primary" />
            <CardTitle className="font-sans text-2xl font-bold">GSTR2B Automation</CardTitle>
          </div>
          <CardDescription className="text-base">
            Configure your GST return filing automation system with required file paths
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="excel-path" className="text-sm font-medium">
              GST Data Excel File
            </Label>
            <div className="flex gap-2">
              <Input
                id="excel-path"
                value={excelPath}
                placeholder="Click browse to select Excel file (full path will be saved)..."
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={() => handleFileSelect("excel")} className="shrink-0">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="storage-path" className="text-sm font-medium">
              Output Storage Directory
            </Label>
            <div className="flex gap-2">
              <Input
                id="storage-path"
                value={storagePath}
                placeholder="Click browse to select storage folder (full path will be saved)..."
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={() => handleFileSelect("storage")} className="shrink-0">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="webhook-url" className="text-sm font-medium">
              External Webhook URL
            </Label>
            <Input
              id="webhook-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="Enter webhook URL for email notifications..."
              className="font-mono text-sm"
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              This webhook will receive automation results and send email notifications
            </p>
          </div>

          <Button
            onClick={handleContinue}
            disabled={!excelPath || !storagePath || !webhookUrl}
            className="w-full font-medium"
            size="lg"
          >
            Initialize GSTR2B System
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
