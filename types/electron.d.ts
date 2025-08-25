// Type definitions for Electron API
declare global {
  interface Window {
    electronAPI: {
      openFileDialog: () => Promise<string | null>
      openDirectoryDialog: () => Promise<string | null>
      saveLocation: (data: { path: string; type: 'file' | 'folder' }) => Promise<any>
      getLocations: () => Promise<any[]>
      clearLocations: () => Promise<boolean>
    }
  }
}

export {}
