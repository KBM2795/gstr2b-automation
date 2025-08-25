const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const ElectronAPI = require('./api-server')
const N8nServer = require('./n8n-server')
const isDev = process.env.NODE_ENV === 'development'

// Suppress Chromium warnings and errors
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor')
app.commandLine.appendSwitch('--disable-logging')
app.commandLine.appendSwitch('--log-level', '3')
app.commandLine.appendSwitch('--disable-dev-shm-usage')
app.commandLine.appendSwitch('--no-sandbox')

let mainWindow
let apiServer
let n8nServer

// Path for storing app data
const userDataPath = app.getPath('userData')
const configPath = path.join(userDataPath, 'config.json')

// Initialize config file
function initConfig() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ locations: [] }))
  }
}

// Read config
function readConfig() {
  try {
    const data = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { locations: [] }
  }
}

// Write config
function writeConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Add your app icon
    show: false,
    titleBarStyle: 'default'
  })

  // Load the Next.js app
  const startUrl = isDev 
    ? 'http://localhost:3001' // Changed to port 3001
    : `file://${path.join(__dirname, '../out/index.html')}`
  
  mainWindow.loadURL(startUrl)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    if (isDev) {
      mainWindow.webContents.openDevTools()
      
      // Suppress autofill warnings in DevTools
      mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (message.includes('Autofill.enable') || message.includes('Autofill.setAddresses')) {
          event.preventDefault()
        }
      })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Handle file dialog requests
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  
  if (canceled) {
    return null
  } else {
    return filePaths[0]
  }
})

// Handle folder dialog requests
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  
  if (canceled) {
    return null
  } else {
    return filePaths[0]
  }
})

// Handle saving locations
ipcMain.handle('storage:saveLocation', async (event, { path, type }) => {
  const config = readConfig()
  
  // Remove existing location of the same type
  config.locations = config.locations.filter(loc => loc.type !== type)
  
  const location = {
    id: Date.now().toString(),
    path,
    type,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  config.locations.push(location)
  writeConfig(config)
  return location
})

// Handle getting locations
ipcMain.handle('storage:getLocations', async () => {
  const config = readConfig()
  return config.locations
})

// Handle getting location by type
ipcMain.handle('storage:getLocationByType', async (event, type) => {
  const config = readConfig()
  return config.locations.find(loc => loc.type === type) || null
})

// Handle clearing locations
ipcMain.handle('storage:clearLocations', async () => {
  writeConfig({ locations: [] })
  return true
})

// Handle updating location
ipcMain.handle('storage:updateLocation', async (event, { id, path, type }) => {
  const config = readConfig()
  const locationIndex = config.locations.findIndex(loc => loc.id === id)
  
  if (locationIndex !== -1) {
    config.locations[locationIndex] = {
      ...config.locations[locationIndex],
      path,
      type,
      updatedAt: new Date().toISOString()
    }
    writeConfig(config)
    return config.locations[locationIndex]
  }
  return null
})

// Handle deleting location
ipcMain.handle('storage:deleteLocation', async (event, id) => {
  const config = readConfig()
  const initialLength = config.locations.length
  config.locations = config.locations.filter(loc => loc.id !== id)
  
  if (config.locations.length < initialLength) {
    writeConfig(config)
    return true
  }
  return false
})

// Handle n8n operations
ipcMain.handle('n8n:getStatus', async () => {
  if (n8nServer) {
    return n8nServer.getStatus()
  }
  return { isRunning: false }
})

ipcMain.handle('n8n:createWorkflow', async () => {
  if (n8nServer) {
    return await n8nServer.createGSTR2BWorkflow()
  }
  return null
})

// IPC handler for starting n8n
ipcMain.handle('n8n:start', async () => {
  try {
    if (!n8nServer) {
      n8nServer = new N8nServer(configPath)
    }
    const result = await n8nServer.start()
    return { success: true, ...result }
  } catch (error) {
    console.error('Failed to start n8n:', error)
    return { success: false, error: error.message }
  }
})

// IPC handler for stopping n8n
ipcMain.handle('n8n:stop', async () => {
  try {
    if (n8nServer) {
      await n8nServer.stop()
      return { success: true }
    }
    return { success: true, message: 'n8n was not running' }
  } catch (error) {
    console.error('Failed to stop n8n:', error)
    return { success: false, error: error.message }
  }
})

// IPC handler for opening external URLs
ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron')
  await shell.openExternal(url)
  return { success: true }
})

app.whenReady().then(async () => {
  initConfig()
  
  // Start internal API server
  try {
    apiServer = new ElectronAPI(configPath)
    await apiServer.start()
    console.log('Internal API server started on port 3002')
  } catch (error) {
    console.error('Failed to start API server:', error)
  }

  // Start n8n server (temporarily disabled for testing)
  /*
  try {
    n8nServer = new N8nServer(configPath)
    const n8nInfo = await n8nServer.start()
    if (n8nInfo.error) {
      console.log('n8n server failed to start, continuing without workflow automation:', n8nInfo.error)
    } else {
      console.log('n8n server started successfully:', n8nInfo)
    }
  } catch (error) {
    console.log('n8n server is unavailable, continuing without workflow automation:', error.message)
    // Don't let n8n failure block the app
    n8nServer = null
  }
  */
  
  createWindow()
})

app.on('window-all-closed', async () => {
  console.log('Cleaning up servers before exit...')
  
  if (apiServer) {
    try {
      await apiServer.stop()
      console.log('API server stopped successfully')
    } catch (error) {
      console.error('Failed to stop API server:', error)
    }
  }
  
  if (n8nServer) {
    try {
      await n8nServer.stop()
      console.log('n8n server stopped successfully')
    } catch (error) {
      console.error('Failed to stop n8n server:', error)
    }
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  console.log('App is quitting, stopping all servers...')
  
  if (n8nServer && n8nServer.isRunning) {
    event.preventDefault()
    
    try {
      await n8nServer.stop()
      console.log('n8n server stopped on quit')
    } catch (error) {
      console.error('Failed to stop n8n on quit:', error)
    }
    
    // Allow the app to quit after cleanup
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
