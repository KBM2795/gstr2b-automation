const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { app, dialog } = require('electron')

class FirstRunSetup {
  constructor() {
    this.userDataPath = app.getPath('userData')
    this.setupConfigPath = path.join(this.userDataPath, 'setup-config.json')
    this.isFirstRun = this.checkIfFirstRun()
  }

  checkIfFirstRun() {
    // Check if setup config exists
    if (!fs.existsSync(this.setupConfigPath)) {
      return true
    }

    try {
      const setupConfig = JSON.parse(fs.readFileSync(this.setupConfigPath, 'utf8'))
      return !setupConfig.playwrightInstalled || !setupConfig.initialSetupComplete
    } catch (error) {
      return true
    }
  }

  async runFirstTimeSetup(mainWindow) {
    if (!this.isFirstRun) {
      return { success: true, message: 'Setup already completed' }
    }

    console.log('Running first-time setup...')
    
    try {
      // Show setup dialog to user
      const response = await this.showSetupDialog(mainWindow)
      if (!response) {
        return { success: false, message: 'Setup cancelled by user' }
      }

      // Install Playwright Chromium
      const playwrightResult = await this.installPlaywrightChromium(mainWindow)
      if (!playwrightResult.success) {
        return playwrightResult
      }

      // Mark setup as complete
      await this.markSetupComplete()
      
      return { 
        success: true, 
        message: 'First-time setup completed successfully' 
      }
    } catch (error) {
      console.error('First-time setup failed:', error)
      return { 
        success: false, 
        message: `Setup failed: ${error.message}` 
      }
    }
  }

  async showSetupDialog(mainWindow) {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'GSTR2B App - First Time Setup',
      message: 'Welcome to GSTR2B Automation App!',
      detail: 'This is your first time running the app. We need to install some required components for browser automation (Playwright Chromium). This may take a few minutes depending on your internet connection.\n\nDo you want to proceed with the setup?',
      buttons: ['Install Now', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })

    return response.response === 0
  }

  async installPlaywrightChromium(mainWindow) {
    return new Promise((resolve) => {
      console.log('Installing Playwright Chromium...')
      
      // Show progress dialog
      this.showProgressDialog(mainWindow, 'Installing browser components...')

      try {
        // Use npx to install playwright chromium
        const installCommand = process.platform === 'win32' 
          ? 'npx.cmd playwright install chromium' 
          : 'npx playwright install chromium'

        console.log('Running command:', installCommand)
        
        const installProcess = spawn('npx', ['playwright', 'install', 'chromium'], {
          cwd: process.cwd(),
          stdio: 'pipe',
          shell: true
        })

        let output = ''
        let errorOutput = ''

        installProcess.stdout.on('data', (data) => {
          const text = data.toString()
          output += text
          console.log('Playwright install output:', text)
        })

        installProcess.stderr.on('data', (data) => {
          const text = data.toString()
          errorOutput += text
          console.log('Playwright install error:', text)
        })

        installProcess.on('close', (code) => {
          console.log(`Playwright installation process exited with code ${code}`)
          
          if (code === 0) {
            console.log('Playwright Chromium installed successfully')
            resolve({
              success: true,
              message: 'Playwright Chromium installed successfully'
            })
          } else {
            console.error('Playwright installation failed with code:', code)
            console.error('Error output:', errorOutput)
            resolve({
              success: false,
              message: `Playwright installation failed. Exit code: ${code}\nError: ${errorOutput}`
            })
          }
        })

        installProcess.on('error', (error) => {
          console.error('Failed to start playwright installation:', error)
          resolve({
            success: false,
            message: `Failed to start installation: ${error.message}`
          })
        })

        // Set timeout for installation (10 minutes)
        setTimeout(() => {
          if (!installProcess.killed) {
            installProcess.kill()
            resolve({
              success: false,
              message: 'Installation timed out after 10 minutes'
            })
          }
        }, 10 * 60 * 1000)

      } catch (error) {
        console.error('Error during playwright installation:', error)
        resolve({
          success: false,
          message: `Installation error: ${error.message}`
        })
      }
    })
  }

  showProgressDialog(mainWindow, message) {
    // Create a simple progress window
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.executeJavaScript(`
        // Show a simple progress indicator
        if (!document.getElementById('setup-progress')) {
          const progressDiv = document.createElement('div');
          progressDiv.id = 'setup-progress';
          progressDiv.style.cssText = \`
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
          \`;
          progressDiv.innerHTML = \`
            <div style="text-align: center;">
              <div style="font-size: 24px; margin-bottom: 20px;">Setting up GSTR2B App</div>
              <div style="font-size: 16px; margin-bottom: 30px;">${message}</div>
              <div style="width: 300px; height: 6px; background: #333; border-radius: 3px; overflow: hidden;">
                <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #4ade80, #22c55e); animation: progress 2s ease-in-out infinite;">
                </div>
              </div>
              <style>
                @keyframes progress {
                  0% { transform: translateX(-100%); }
                  50% { transform: translateX(0%); }
                  100% { transform: translateX(100%); }
                }
              </style>
              <div style="font-size: 14px; margin-top: 20px; opacity: 0.8;">This may take a few minutes...</div>
            </div>
          \`;
          document.body.appendChild(progressDiv);
        }
      `).catch(err => console.log('Could not show progress dialog:', err))
    }
  }

  hideProgressDialog(mainWindow) {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.executeJavaScript(`
        const progressDiv = document.getElementById('setup-progress');
        if (progressDiv) {
          progressDiv.remove();
        }
      `).catch(err => console.log('Could not hide progress dialog:', err))
    }
  }

  async markSetupComplete() {
    const setupConfig = {
      playwrightInstalled: true,
      initialSetupComplete: true,
      setupDate: new Date().toISOString(),
      version: '1.0.0'
    }

    fs.writeFileSync(this.setupConfigPath, JSON.stringify(setupConfig, null, 2))
    console.log('Setup marked as complete')
  }

  getSetupStatus() {
    try {
      if (!fs.existsSync(this.setupConfigPath)) {
        return { setupComplete: false, firstRun: true }
      }

      const setupConfig = JSON.parse(fs.readFileSync(this.setupConfigPath, 'utf8'))
      return {
        setupComplete: setupConfig.playwrightInstalled && setupConfig.initialSetupComplete,
        firstRun: false,
        setupDate: setupConfig.setupDate,
        version: setupConfig.version
      }
    } catch (error) {
      return { setupComplete: false, firstRun: true }
    }
  }
}

module.exports = FirstRunSetup
