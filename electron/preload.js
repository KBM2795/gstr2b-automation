const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File dialog methods
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  
  // Storage methods (IPC)
  saveLocation: (data) => ipcRenderer.invoke('storage:saveLocation', data),
  getLocations: () => ipcRenderer.invoke('storage:getLocations'),
  getLocationByType: (type) => ipcRenderer.invoke('storage:getLocationByType', type),
  updateLocation: (data) => ipcRenderer.invoke('storage:updateLocation', data),
  deleteLocation: (id) => ipcRenderer.invoke('storage:deleteLocation', id),
  clearLocations: () => ipcRenderer.invoke('storage:clearLocations'),
  
  // API server info
  getAPIPort: () => 3002, // Updated to match new API server port
  getAPIBase: () => 'http://localhost:3002/api',
  
  // Utility methods
  isElectron: () => true,
  getAppVersion: () => require('electron').remote?.app.getVersion() || '1.0.0',
  getAppPath: () => ipcRenderer.invoke('app:getPath'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Setup methods
  getSetupStatus: () => ipcRenderer.invoke('setup:getStatus'),
  runSetup: () => ipcRenderer.invoke('setup:runSetup'),
  
  // Logs methods
  readLogFile: (date) => ipcRenderer.invoke('logs:readFile', date),
  clearLogFile: (date, options) => ipcRenderer.invoke('logs:clearFile', date, options),
  
  // Auto-updater methods
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // Listen for update events
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-status')
    ipcRenderer.removeAllListeners('download-progress')
  }
})
