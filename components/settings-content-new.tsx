"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { FolderOpen, FileSpreadsheet, RotateCcw, Moon, Save } from "lucide-react"
import { useTheme } from "next-themes"

interface SettingsContentProps {
  config: { excelPath: string; storagePath: string }
  onConfigUpdate: (config: { excelPath: string; storagePath: string }) => void
}

export function SettingsContent({ config, onConfigUpdate }: SettingsContentProps) {
  const [excelPath, setExcelPath] = useState(config.excelPath)
  const [storagePath, setStoragePath] = useState(config.storagePath)
  const [isSaving, setIsSaving] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setExcelPath(config.excelPath)
    setStoragePath(config.storagePath)
  }, [config])

  const handleFileSelect = async (type: "excel" | "storage") => {
    try {
      if (type === "excel") {
        // Simulate Excel file selection
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".xlsx,.xls,.csv"
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            setExcelPath(file.name)
          }
        }
        input.click()
      } else {
        // Simulate folder selection
        const input = document.createElement("input")
        input.type = "file"
        input.webkitdirectory = true
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files
          if (files && files.length > 0) {
            const path = files[0].webkitRelativePath.split("/")[0]
            setStoragePath(path)
          }
        }
        input.click()
      }
    } catch (error) {
      console.error("File selection error:", error)
    }
  }

  const handleSaveConfig = async () => {
    if (!excelPath || !storagePath) {
      alert("Please select both Excel file and storage folder")
      return
    }

    setIsSaving(true)
    try {
      // Save new Excel file location
      await fetch('/api/save-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: excelPath, type: 'file' })
      })

      // Save new storage folder location
      await fetch('/api/save-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: storagePath, type: 'folder' })
      })

      const newConfig = { excelPath, storagePath }
      localStorage.setItem("gstr2bConfig", JSON.stringify(newConfig))
      onConfigUpdate(newConfig)
      
      alert("Configuration saved successfully!")
    } catch (error) {
      console.error("Failed to save configuration:", error)
      alert("Failed to save configuration. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetConfig = async () => {
    if (confirm("Are you sure you want to reset all configuration? This will clear all saved paths.")) {
      try {
        // Clear localStorage
        localStorage.removeItem("gstr2bConfig")
        
        // Clear local state
        setExcelPath("")
        setStoragePath("")
        onConfigUpdate({ excelPath: "", storagePath: "" })
        
        alert("Configuration reset successfully!")
      } catch (error) {
        console.error("Failed to reset configuration:", error)
        alert("Failed to reset configuration. Please try again.")
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">File Paths</CardTitle>
          <CardDescription>Update the Excel file and storage folder locations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="excel-path">Excel File Location</Label>
            <div className="flex gap-2">
              <Input 
                id="excel-path" 
                value={excelPath} 
                placeholder="Select Excel file..." 
                readOnly 
                className="flex-1 font-mono text-sm" 
              />
              <Button variant="outline" size="icon" onClick={() => handleFileSelect("excel")}>
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            </div>
            {excelPath && (
              <p className="text-sm text-muted-foreground">Current: {excelPath}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="storage-path">Storage Folder Location</Label>
            <div className="flex gap-2">
              <Input
                id="storage-path"
                value={storagePath}
                placeholder="Select storage folder..."
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={() => handleFileSelect("storage")}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            {storagePath && (
              <p className="text-sm text-muted-foreground">Current: {storagePath}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveConfig} disabled={isSaving} className="flex-1">
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Configuration"}
            </Button>
            <Button variant="outline" onClick={handleResetConfig} disabled={isSaving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Appearance</CardTitle>
          <CardDescription>Customize the application appearance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">Toggle between light and dark themes</p>
            </div>
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Future Configuration</CardTitle>
          <CardDescription>Additional settings will be available here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Outlook integration and other features coming soon...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
