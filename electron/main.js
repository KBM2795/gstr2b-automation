const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const ElectronAPI = require('./api-server')
const N8nServer = require('./n8n-server')
const { GSTR2BAutomationServer } = require('./gstr2b-automation-server')
const FirstRunSetup = require('./first-run-setup')
const AutoUpdater = require('./updater')
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
let gstr2bAutomationServer
let firstRunSetup
let autoUpdater

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

// Initialize auto-updater
function initializeAutoUpdater() {
  try {
    autoUpdater = new AutoUpdater(mainWindow)
    
    // Start periodic checks every 4 hours
    autoUpdater.startPeriodicCheck(4)
    
    // Check for updates 15 seconds after app start
    setTimeout(() => {
      console.log('Checking for updates...')
      autoUpdater.checkForUpdates()
    }, 15000)
    
    console.log('Auto-updater initialized successfully')
  } catch (error) {
    console.error('Failed to initialize auto-updater:', error)
  }
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
    
    // Initialize auto-updater after window is ready (only in production)
    if (!isDev) {
      initializeAutoUpdater()
    }
    
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
  try {
    if (!n8nServer) {
      // Try to initialize n8nServer if it doesn't exist
      console.log('n8nServer not initialized, attempting to create...')
      n8nServer = new N8nServer(configPath)
    }
    
    const result = await n8nServer.createGSTR2BWorkflow()
    console.log('Create workflow result:', result)
    return result
  } catch (error) {
    console.error('Failed to create workflow:', error)
    return {
      success: false,
      error: `Failed to create workflow: ${error.message}`,
      details: error.stack
    }
  }
})

// IPC handler for injecting workflow directly into n8n
ipcMain.handle('n8n:injectWorkflow', async () => {
  try {
    if (!n8nServer) {
      console.log('n8nServer not initialized, attempting to create...')
      n8nServer = new N8nServer(configPath)
    }
    
    const result = await n8nServer.injectWorkflowToN8n()
    console.log('Inject workflow result:', result)
    return result
  } catch (error) {
    console.error('Failed to inject workflow:', error)
    return {
      success: false,
      error: `Failed to inject workflow: ${error.message}`,
      details: error.stack
    }
  }
})

// IPC handler for creating workflow from custom JSON
ipcMain.handle('n8n:createWorkflowFromJSON', async (event, workflowJSON) => {
  try {
    if (!n8nServer) {
      console.log('n8nServer not initialized, attempting to create...')
      n8nServer = new N8nServer(configPath)
    }
    
    const result = await n8nServer.createWorkflowFromJSON(workflowJSON)
    console.log('Create workflow from JSON result:', result)
    return result
  } catch (error) {
    console.error('Failed to create workflow from JSON:', error)
    return {
      success: false,
      error: `Failed to create workflow from JSON: ${error.message}`,
      details: error.stack
    }
  }
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

// IPC handlers for setup status
ipcMain.handle('setup:getStatus', async () => {
  if (firstRunSetup) {
    return firstRunSetup.getSetupStatus()
  }
  return { setupComplete: false, firstRun: true }
})

ipcMain.handle('setup:runSetup', async () => {
  if (firstRunSetup) {
    return await firstRunSetup.runFirstTimeSetup(mainWindow)
  }
  return { success: false, message: 'Setup not initialized' }
})

// IPC handlers for log file operations
ipcMain.handle('logs:readFile', async (event, date) => {
  try {
    const logDir = path.join(userDataPath, 'logs')
    const logFile = path.join(logDir, `webhook-responses-${date}.log`)
    
    if (!fs.existsSync(logFile)) {
      return {
        success: true,
        logs: [],
        message: `No logs found for ${date}`,
        date
      }
    }

    const logContent = fs.readFileSync(logFile, 'utf8')
    const logs = logContent.trim().split('\n').map((line, index) => {
      try {
        const parsed = JSON.parse(line)
        if (!parsed.id) {
          parsed.id = `${date}-${index}`
        }
        return parsed
      } catch {
        return { 
          id: `${date}-${index}`,
          message: line, 
          timestamp: new Date().toISOString(),
          status: 'unknown',
          'Client Name': 'Unknown'
        }
      }
    })

    return {
      success: true,
      logs,
      count: logs.length,
      date
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to read log file',
      message: error.message
    }
  }
})

ipcMain.handle('logs:clearFile', async (event, date, options = {}) => {
  try {
    const logDir = path.join(userDataPath, 'logs')
    const logFile = path.join(logDir, `webhook-responses-${date}.log`)
    
    if (!fs.existsSync(logFile)) {
      return {
        success: false,
        error: 'Log file not found',
        message: `No log file found for ${date}`
      }
    }

    if (options.all) {
      // Clear all logs
      fs.unlinkSync(logFile)
      return {
        success: true,
        message: `All logs cleared for ${date}`,
        date,
        cleared: 'all'
      }
    }

    if (options.ids && Array.isArray(options.ids)) {
      // Clear specific logs
      const logContent = fs.readFileSync(logFile, 'utf8')
      const logs = logContent.trim().split('\n')
      
      const filteredLogs = logs.filter((line, index) => {
        try {
          const parsed = JSON.parse(line)
          const logId = parsed.id || `${date}-${index}`
          return !options.ids.includes(logId)
        } catch {
          const logId = `${date}-${index}`
          return !options.ids.includes(logId)
        }
      })

      if (filteredLogs.length === 0) {
        fs.unlinkSync(logFile)
      } else {
        fs.writeFileSync(logFile, filteredLogs.join('\n') + '\n')
      }

      return {
        success: true,
        message: `Deleted ${logs.length - filteredLogs.length} specific logs`,
        date,
        cleared: options.ids,
        remaining: filteredLogs.length
      }
    }

    return {
      success: false,
      error: 'Invalid clear options',
      message: 'Please specify either all=true or provide specific log ids'
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to clear logs',
      message: error.message
    }
  }
})

// Auto-updater IPC handlers
ipcMain.handle('updater:check', async () => {
  if (autoUpdater && !isDev) {
    autoUpdater.checkForUpdates()
    return { success: true, message: 'Checking for updates...' }
  } else {
    return { success: false, message: 'Auto-updater not available in development mode' }
  }
})

ipcMain.handle('updater:download', async () => {
  if (autoUpdater && !isDev) {
    autoUpdater.downloadUpdate()
    return { success: true, message: 'Starting update download...' }
  } else {
    return { success: false, message: 'Auto-updater not available in development mode' }
  }
})

ipcMain.handle('updater:install', async () => {
  if (autoUpdater && !isDev) {
    autoUpdater.installUpdate()
    return { success: true, message: 'Installing update and restarting...' }
  } else {
    return { success: false, message: 'Auto-updater not available in development mode' }
  }
})

ipcMain.handle('app:getVersion', async () => {
  return require('../package.json').version
})

app.whenReady().then(async () => {
  initConfig()
  
  // Initialize first-run setup
  firstRunSetup = new FirstRunSetup()
  
  // Check if this is first run and setup is needed
  const setupStatus = firstRunSetup.getSetupStatus()
  console.log('Setup status:', setupStatus)
  
  // Start internal API server
  try {
    apiServer = new ElectronAPI(configPath)
    await apiServer.start()
    console.log('Internal API server started on port 3002')
  } catch (error) {
    console.error('Failed to start API server:', error)
  }

  // Create window first
  createWindow()
  
  // Run first-time setup if needed
  if (!setupStatus.setupComplete) {
    console.log('Running first-time setup...')
    const setupResult = await firstRunSetup.runFirstTimeSetup(mainWindow)
    
    if (setupResult.success) {
      console.log('First-time setup completed successfully')
      // Hide progress dialog
      firstRunSetup.hideProgressDialog(mainWindow)
      
      // Show completion message
      setTimeout(() => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Setup Complete',
          message: 'GSTR2B App Setup Complete!',
          detail: 'All required components have been installed successfully. The app is now ready to use.',
          buttons: ['OK']
        })
      }, 1000)
    } else {
      console.error('First-time setup failed:', setupResult.message)
      // Hide progress dialog
      firstRunSetup.hideProgressDialog(mainWindow)
      
      // Show error message
      setTimeout(() => {
        dialog.showErrorBox(
          'Setup Failed', 
          `Setup failed: ${setupResult.message}\n\nThe app may not work correctly. Please restart the app to try again.`
        )
      }, 1000)
    }
  }

  // Start GSTR-2B automation server (after setup is complete)
  try {
    gstr2bAutomationServer = new GSTR2BAutomationServer()
    await gstr2bAutomationServer.start()
    console.log('GSTR-2B automation server started on port 3003')
  } catch (error) {
    console.error('Failed to start GSTR-2B automation server:', error)
  }

  // Start n8n server
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
  
  if (gstr2bAutomationServer) {
    try {
      await gstr2bAutomationServer.stop()
      console.log('GSTR-2B automation server stopped successfully')
    } catch (error) {
      console.error('Failed to stop GSTR-2B automation server:', error)
    }
  }
  
  // Stop auto-updater periodic checks
  if (autoUpdater) {
    autoUpdater.stopPeriodicCheck()
    console.log('Auto-updater stopped')
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
  
  if (gstr2bAutomationServer && gstr2bAutomationServer.isRunning()) {
    event.preventDefault()
    
    try {
      await gstr2bAutomationServer.stop()
      console.log('GSTR-2B automation server stopped on quit')
    } catch (error) {
      console.error('Failed to stop GSTR-2B automation on quit:', error)
    }
  }
  
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
