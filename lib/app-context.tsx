"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface AppConfig {
  excelPath: string
  storagePath: string
}

interface AppContextType {
  config: AppConfig
  setConfig: (config: AppConfig) => void
  isLoading: boolean
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>({ excelPath: "", storagePath: "" })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load config from localStorage and Electron storage
    const loadConfig = async () => {
      try {
        // First check localStorage
        const savedConfig = localStorage.getItem("gstr2bConfig")
        if (savedConfig) {
          const parsedConfig = JSON.parse(savedConfig)
          setConfig(parsedConfig)
        }

        // Then check Electron storage if available
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          try {
            // Try IPC first
            const locations = await (window as any).electronAPI.getLocations()
            
            const fileLocation = locations.find((loc: any) => loc.type === 'file')
            const folderLocation = locations.find((loc: any) => loc.type === 'folder')
            
            if (fileLocation || folderLocation) {
              const electronConfig = {
                excelPath: fileLocation?.path || "",
                storagePath: folderLocation?.path || ""
              }
              setConfig(electronConfig)
              localStorage.setItem("gstr2bConfig", JSON.stringify(electronConfig))
            }
          } catch (ipcError) {
            console.log('IPC failed, trying HTTP API:', ipcError)
            // Fallback to HTTP API
            try {
              const response = await fetch('http://localhost:3001/api/locations')
              if (response.ok) {
                const data = await response.json()
                const locations = data.locations || []
                
                const fileLocation = locations.find((loc: any) => loc.type === 'file')
                const folderLocation = locations.find((loc: any) => loc.type === 'folder')
                
                if (fileLocation || folderLocation) {
                  const apiConfig = {
                    excelPath: fileLocation?.path || "",
                    storagePath: folderLocation?.path || ""
                  }
                  setConfig(apiConfig)
                  localStorage.setItem("gstr2bConfig", JSON.stringify(apiConfig))
                }
              }
            } catch (httpError) {
              console.log('HTTP API also failed:', httpError)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [])

  const updateConfig = (newConfig: AppConfig) => {
    setConfig(newConfig)
    localStorage.setItem("gstr2bConfig", JSON.stringify(newConfig))
  }

  return (
    <AppContext.Provider value={{ config, setConfig: updateConfig, isLoading }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppConfig() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppConfig must be used within an AppProvider')
  }
  return context
}
