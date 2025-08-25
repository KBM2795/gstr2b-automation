// Utility for making API calls in Electron app
class ElectronAPIClient {
  private baseURL: string
  private isElectron: boolean

  constructor() {
    this.baseURL = 'http://localhost:3001/api'
    this.isElectron = typeof window !== 'undefined' && (window as any).electronAPI
  }

  // Locations API
  async getLocations() {
    if (this.isElectron) {
      try {
        return await (window as any).electronAPI.getLocations()
      } catch (error) {
        console.log('IPC failed, falling back to HTTP:', error)
      }
    }
    
    const response = await fetch(`${this.baseURL}/locations`)
    const data = await response.json()
    return data.locations || []
  }

  async saveLocation(path: string, type: 'file' | 'folder') {
    if (this.isElectron) {
      try {
        return await (window as any).electronAPI.saveLocation({ path, type })
      } catch (error) {
        console.log('IPC failed, falling back to HTTP:', error)
      }
    }
    
    const response = await fetch(`${this.baseURL}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, type })
    })
    return await response.json()
  }

  async getLocationByType(type: 'file' | 'folder') {
    if (this.isElectron) {
      try {
        return await (window as any).electronAPI.getLocationByType(type)
      } catch (error) {
        console.log('IPC failed, falling back to HTTP:', error)
      }
    }
    
    const response = await fetch(`${this.baseURL}/locations/${type}`)
    const data = await response.json()
    return data.location
  }

  async deleteLocation(id: string) {
    if (this.isElectron) {
      try {
        return await (window as any).electronAPI.deleteLocation(id)
      } catch (error) {
        console.log('IPC failed, falling back to HTTP:', error)
      }
    }
    
    const response = await fetch(`${this.baseURL}/locations/${id}`, {
      method: 'DELETE'
    })
    return await response.json()
  }

  // Settings API
  async getSettings() {
    const response = await fetch(`${this.baseURL}/settings`)
    const data = await response.json()
    return data.settings || {}
  }

  async saveSettings(settings: Record<string, any>) {
    const response = await fetch(`${this.baseURL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    return await response.json()
  }

  // Logs API
  async getLogs() {
    const response = await fetch(`${this.baseURL}/logs`)
    const data = await response.json()
    return data.logs || []
  }

  async addLog(message: string, level: 'info' | 'warn' | 'error' = 'info', category: string = 'general') {
    const response = await fetch(`${this.baseURL}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, level, category })
    })
    return await response.json()
  }

  // Health check
  async health() {
    const response = await fetch(`${this.baseURL}/health`)
    return await response.json()
  }

  // File dialogs (Electron only)
  async openFileDialog() {
    if (this.isElectron) {
      return await (window as any).electronAPI.openFileDialog()
    }
    throw new Error('File dialog only available in Electron')
  }

  async openDirectoryDialog() {
    if (this.isElectron) {
      return await (window as any).electronAPI.openDirectoryDialog()
    }
    throw new Error('Directory dialog only available in Electron')
  }
}

export const electronAPI = new ElectronAPIClient()
export default electronAPI
