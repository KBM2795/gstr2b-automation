const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const WorkflowInstaller = require('./workflow-installer')
const ProcessManager = require('./process-manager')

class N8nServer {
  constructor(configPath) {
    this.configPath = configPath
    this.n8nPort = 5678
    this.n8nProcess = null
    this.isRunning = false
    this.userDataPath = path.dirname(configPath)
    this.n8nDataPath = path.join(this.userDataPath, '.n8n')
    this.resourcesPath = path.join(__dirname, '..', 'resources')
    
    // Initialize workflow installer
    this.workflowInstaller = new WorkflowInstaller(this.n8nDataPath, this.resourcesPath)
  }

  async start() {
    try {
      // Ensure n8n data directory exists
      if (!fs.existsSync(this.n8nDataPath)) {
        fs.mkdirSync(this.n8nDataPath, { recursive: true })
      }

      // Install default workflows and configuration
      await this.workflowInstaller.installAll()

      console.log(`Starting n8n server on port ${this.n8nPort}...`)
      console.log(`n8n data directory: ${this.n8nDataPath}`)

      // Start n8n using spawn
      await this.startN8nProcess()

      this.isRunning = true
      console.log(`n8n server started successfully on http://localhost:${this.n8nPort}`)
      
      return {
        port: this.n8nPort,
        url: `http://localhost:${this.n8nPort}`,
        dataPath: this.n8nDataPath
      }
    } catch (error) {
      console.error('Failed to start n8n server:', error)
      // Don't throw error - just continue without n8n
      return {
        port: this.n8nPort,
        url: `http://localhost:${this.n8nPort}`,
        dataPath: this.n8nDataPath,
        error: error.message
      }
    }
  }

  async startN8nProcess() {
    return new Promise((resolve, reject) => {
      // Use the Windows-compatible n8n executable
      const n8nCommand = process.platform === 'win32' ? 'npx' : 'n8n'
      const n8nArgs = process.platform === 'win32' ? ['n8n', 'start'] : ['start']
      
      // Set environment variables
      const env = {
        ...process.env,
        N8N_USER_FOLDER: this.n8nDataPath,
        N8N_PORT: this.n8nPort,
        N8N_HOST: '127.0.0.1',
        N8N_PROTOCOL: 'http',
        N8N_LOG_LEVEL: 'warn',
        N8N_BASIC_AUTH_ACTIVE: 'false',
        DB_SQLITE_POOL_SIZE: '10',
        N8N_RUNNERS_ENABLED: 'true'
      }

      // Start n8n process
      this.n8nProcess = spawn(n8nCommand, n8nArgs, {
        env,
        stdio: 'pipe',
        cwd: process.cwd(),
        shell: process.platform === 'win32'
      })

      let startupComplete = false

      this.n8nProcess.stdout.on('data', (data) => {
        const output = data.toString()
        console.log('n8n:', output.trim())
        
        // Check if n8n has started successfully with more patterns
        if (output.includes('Editor is now accessible') || 
            output.includes('Webhook URLs base') ||
            output.includes('n8n ready on') ||
            output.includes('Server started') ||
            output.includes(`localhost:${this.n8nPort}`) ||
            output.includes('n8n is ready') ||
            output.includes('Migrations finished')) {
          if (!startupComplete) {
            startupComplete = true
            console.log('n8n startup detected, marking as ready')
            resolve()
          }
        }
      })

      this.n8nProcess.stderr.on('data', (data) => {
        const error = data.toString()
        console.error('n8n error:', error.trim())
      })

      this.n8nProcess.on('error', (error) => {
        if (!startupComplete) {
          reject(error)
        }
      })

      this.n8nProcess.on('exit', (code) => {
        console.log(`n8n process exited with code ${code}`)
        this.isRunning = false
        this.n8nProcess = null
      })

      // Timeout after 25 seconds (reduced from 60)
      setTimeout(() => {
        if (!startupComplete) {
          console.log('n8n startup timeout reached, but continuing anyway...')
          startupComplete = true
          resolve() // Resolve anyway - n8n might be working even without detection
        }
      }, 25000)
    })
  }

  async stop() {
    return new Promise(async (resolve) => {
      try {
        if (this.n8nProcess) {
          console.log('Stopping n8n server...')
          
          // Set up timeout for forceful kill
          const forceKillTimeout = setTimeout(async () => {
            if (this.n8nProcess) {
              console.log('Force killing n8n process...')
              this.n8nProcess.kill('SIGKILL')
              
              // Also try to kill any remaining processes on the port
              await ProcessManager.killProcessOnPort(this.n8nPort)
            }
          }, 5000) // 5 second timeout

          // Listen for process exit
          this.n8nProcess.on('exit', (code) => {
            clearTimeout(forceKillTimeout)
            console.log(`n8n process exited with code ${code}`)
            this.n8nProcess = null
            this.isRunning = false
            resolve()
          })

          // Try graceful shutdown first
          this.n8nProcess.kill('SIGTERM')
          
          // On Windows, SIGTERM might not work, so try SIGINT
          if (process.platform === 'win32') {
            setTimeout(() => {
              if (this.n8nProcess) {
                this.n8nProcess.kill('SIGINT')
              }
            }, 1000)
          }
        } else {
          console.log('n8n server was not running, cleaning up any remaining processes...')
          // Even if we don't have a process reference, try to clean up port
          await ProcessManager.killProcessOnPort(this.n8nPort)
          this.isRunning = false
          resolve()
        }
      } catch (error) {
        console.error('Error stopping n8n server:', error)
        this.isRunning = false
        this.n8nProcess = null
        resolve()
      }
    })
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.n8nPort,
      url: `http://localhost:${this.n8nPort}`,
      dataPath: this.n8nDataPath
    }
  }

  // Create a workflow for GSTR2B processing
  async createGSTR2BWorkflow() {
    try {
      // Load the workflow template from resources
      const templatePath = path.join(this.resourcesPath, 'n8n-templates', 'gstr2b-workflow.json')
      
      if (!fs.existsSync(templatePath)) {
        throw new Error('GSTR2B workflow template not found')
      }

      const workflowTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf8'))
      
      // Create a unique workflow instance
      const workflowData = {
        ...workflowTemplate,
        name: `${workflowTemplate.name} - ${new Date().toISOString().split('T')[0]}`,
        active: true
      }

      console.log('GSTR2B workflow template loaded successfully')
      return {
        success: true,
        workflow: workflowData,
        message: 'Workflow template ready. Start n8n to import it.',
        webhookUrl: `http://localhost:${this.n8nPort}/webhook/gstr2b-trigger`
      }
    } catch (error) {
      console.error('Failed to create GSTR2B workflow:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = N8nServer
