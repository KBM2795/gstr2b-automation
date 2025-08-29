// Type definitions for Electron API
declare global {
  interface Window {
    electronAPI: {
      openFileDialog: () => Promise<string | null>
      openDirectoryDialog: () => Promise<string | null>
      saveLocation: (data: { path: string; type: 'file' | 'folder' }) => Promise<any>
      getLocations: () => Promise<any[]>
      clearLocations: () => Promise<boolean>
      getLocationByType: (type: string) => Promise<any>
      updateLocation: (data: { id: string; path: string; type: string }) => Promise<any>
      deleteLocation: (id: string) => Promise<boolean>
      getAPIPort: () => number
      getAPIBase: () => string
      isElectron: () => boolean
      getAppVersion: () => string
      getAppPath: () => Promise<string>
      openExternal: (url: string) => Promise<any>
      getSetupStatus: () => Promise<{
        setupComplete: boolean
        firstRun: boolean
        setupDate?: string
        version?: string
      }>
      runSetup: () => Promise<{
        success: boolean
        message: string
      }>
      readLogFile: (date: string) => Promise<{
        success: boolean
        logs?: any[]
        count?: number
        date?: string
        message?: string
        error?: string
      }>
      clearLogFile: (date: string, options: {
        all?: boolean
        ids?: string[]
      }) => Promise<{
        success: boolean
        message?: string
        error?: string
        cleared?: string | string[]
        remaining?: number
      }>
    }
  }
}

export {}
