const { autoUpdater } = require('electron-updater')
const { dialog } = require('electron')
const log = require('electron-log')

// Configure logging
log.transports.file.level = 'debug'
autoUpdater.logger = log

class AutoUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow
    this.updateCheckInterval = null
    
    // Configure auto-updater
    this.configureUpdater()
    this.setupEventHandlers()
  }
  
  configureUpdater() {
    // Set update server URL (GitHub releases)
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'YOUR_GITHUB_USERNAME', // Replace with your GitHub username
      repo: 'gstr2b-automation', // Replace with your repo name
      private: false, // Set to true if private repo
      releaseType: 'release' // Use 'prerelease' for beta versions
    })
    
    // Auto-download updates
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    
    // Check for updates every 4 hours
    autoUpdater.checkForUpdatesAndNotify()
  }
  
  setupEventHandlers() {
    // When checking for updates
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...')
      this.sendStatusToWindow('Checking for updates...')
    })
    
    // When update is available
    autoUpdater.on('update-available', (updateInfo) => {
      log.info('Update available:', updateInfo)
      this.sendStatusToWindow(`Update available: v${updateInfo.version}`)
      
      // Show notification to user
      this.showUpdateAvailableDialog(updateInfo)
    })
    
    // When no update is available
    autoUpdater.on('update-not-available', (updateInfo) => {
      log.info('Update not available')
      this.sendStatusToWindow('App is up to date')
    })
    
    // When update is being downloaded
    autoUpdater.on('download-progress', (progressObj) => {
      const message = `Downloading update: ${Math.round(progressObj.percent)}%`
      log.info(message)
      this.sendStatusToWindow(message)
      
      // Update progress in UI if needed
      if (this.mainWindow) {
        this.mainWindow.webContents.send('download-progress', progressObj)
      }
    })
    
    // When update is downloaded and ready
    autoUpdater.on('update-downloaded', (updateInfo) => {
      log.info('Update downloaded:', updateInfo)
      this.sendStatusToWindow('Update downloaded - restart to apply')
      
      // Show restart dialog
      this.showUpdateReadyDialog(updateInfo)
    })
    
    // When update check fails
    autoUpdater.on('error', (error) => {
      log.error('Update error:', error)
      this.sendStatusToWindow('Update check failed')
    })
  }
  
  showUpdateAvailableDialog(updateInfo) {
    const options = {
      type: 'info',
      title: 'Update Available',
      message: `GSTR2B Automation v${updateInfo.version} is available!`,
      detail: `Current version: v${require('../package.json').version}\nNew version: v${updateInfo.version}\n\nRelease notes:\n${updateInfo.releaseNotes || 'No release notes available'}`,
      buttons: ['Download Now', 'Download in Background', 'Skip This Version'],
      defaultId: 0,
      cancelId: 2
    }
    
    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        // Download now - show progress
        this.showDownloadProgress()
      } else if (result.response === 1) {
        // Download in background - just continue
        log.info('Downloading update in background')
      } else {
        // Skip this version
        log.info('User skipped update')
        autoUpdater.autoDownload = false
      }
    })
  }
  
  showUpdateReadyDialog(updateInfo) {
    const options = {
      type: 'info',
      title: 'Update Ready',
      message: `GSTR2B Automation v${updateInfo.version} has been downloaded`,
      detail: 'The update will be applied when you restart the application.\n\nWould you like to restart now?',
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1
    }
    
    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        // Restart and install update
        autoUpdater.quitAndInstall()
      } else {
        // User chose to restart later
        log.info('User chose to restart later')
      }
    })
  }
  
  showDownloadProgress() {
    // Create a simple progress dialog (you can enhance this)
    const progressDialog = dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Downloading Update',
      message: 'Downloading update, please wait...',
      detail: 'Progress: 0%',
      buttons: ['Cancel'],
      cancelId: 0
    })
  }
  
  sendStatusToWindow(message) {
    log.info('Update Status:', message)
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-status', message)
    }
  }
  
  // Manual update check
  checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify()
  }
  
  // Start periodic update checks
  startPeriodicCheck(intervalHours = 4) {
    // Clear existing interval
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
    }
    
    // Set new interval
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates()
    }, intervalHours * 60 * 60 * 1000) // Convert hours to milliseconds
    
    log.info(`Started periodic update checks every ${intervalHours} hours`)
  }
  
  // Stop periodic update checks
  stopPeriodicCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
      this.updateCheckInterval = null
      log.info('Stopped periodic update checks')
    }
  }
  
  // Force download update
  downloadUpdate() {
    autoUpdater.downloadUpdate()
  }
  
  // Install update and restart
  installUpdate() {
    autoUpdater.quitAndInstall()
  }
}

module.exports = AutoUpdater
