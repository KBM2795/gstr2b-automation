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
      console.log('Creating GSTR2B workflow...')
      console.log('Resources path:', this.resourcesPath)
      
      // Load the workflow template from resources
      const templatePath = path.join(this.resourcesPath, 'n8n-templates', 'gstr2b-workflow.json')
      console.log('Template path:', templatePath)
      console.log('Template exists:', fs.existsSync(templatePath))
      
      if (!fs.existsSync(templatePath)) {
        // List available files for debugging
        const templatesDir = path.join(this.resourcesPath, 'n8n-templates')
        console.log('Templates directory exists:', fs.existsSync(templatesDir))
        if (fs.existsSync(templatesDir)) {
          console.log('Files in templates directory:', fs.readdirSync(templatesDir))
        }
        console.log('Resources directory exists:', fs.existsSync(this.resourcesPath))
        if (fs.existsSync(this.resourcesPath)) {
          console.log('Files in resources directory:', fs.readdirSync(this.resourcesPath))
        }
        throw new Error(`GSTR2B workflow template not found at: ${templatePath}`)
      }

      const workflowTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf8'))
      console.log('Workflow template loaded:', workflowTemplate.name)
      
      // Ensure we have a name for the workflow
      const templateName = workflowTemplate.name || 'GSTR2B Complete Automation'
      
      // Create a unique workflow instance
      const workflowData = {
        ...workflowTemplate,
        name: `${templateName} - ${new Date().toISOString().split('T')[0]}`,
        active: true
      }

      console.log('GSTR2B workflow template loaded successfully')
      
      // If n8n is running, try to import the workflow directly
      if (this.isRunning) {
        try {
          console.log('Attempting to import workflow into running n8n instance...')
          const importResult = await this.importWorkflowToN8n(workflowData)
          if (importResult.success) {
            return {
              success: true,
              workflow: workflowData,
              imported: true,
              workflowId: importResult.workflowId,
              message: 'Workflow successfully created and imported into n8n!',
              webhookUrl: `http://localhost:${this.n8nPort}/webhook/gstr2b-trigger`
            }
          }
        } catch (importError) {
          console.log('Failed to import workflow automatically:', importError.message)
        }
      }
      
      return {
        success: true,
        workflow: workflowData,
        imported: false,
        message: 'Workflow template ready. Import it manually in the n8n editor.',
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

  // Import workflow directly into n8n via API
  async importWorkflowToN8n(workflowData) {
    try {
      console.log('Attempting to import workflow via n8n REST API...')
      
      // Ensure we have node-fetch available
      let fetch
      try {
        fetch = require('node-fetch')
      } catch (e) {
        // Fallback to dynamic import for newer Node.js versions
        const module = await import('node-fetch')
        fetch = module.default
      }
      
      // Use the correct n8n API v1 endpoint
      const apiUrl = `http://localhost:${this.n8nPort}/api/v1/workflows`
      console.log('Using n8n API endpoint:', apiUrl)
      
      // Prepare the workflow data for n8n API v1
      const n8nWorkflowData = {
        name: workflowData.name,
        nodes: workflowData.nodes,
        connections: workflowData.connections,
        active: workflowData.active || false,
        settings: workflowData.settings || {},
        staticData: workflowData.staticData || {},
        pinData: workflowData.pinData || {},
        versionId: workflowData.versionId || undefined,
        meta: workflowData.meta || {}
      }
      
      console.log('Sending workflow to n8n API v1...')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(n8nWorkflowData)
      })

      console.log('n8n API response status:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('Workflow imported successfully with ID:', result.id)
        return {
          success: true,
          workflowId: result.id,
          workflowName: result.name
        }
      } else {
        const errorText = await response.text()
        console.error('n8n API error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
      }
    } catch (error) {
      console.error('Failed to import workflow to n8n:', error.message)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Inject workflow directly into n8n - enhanced version
  async injectWorkflowToN8n() {
    try {
      console.log('Starting workflow injection process...')
      
      // Check if n8n is running
      if (!this.isRunning) {
        throw new Error('n8n server is not running. Please start n8n first.')
      }
      
      // Load the workflow template
      const templatePath = path.join(this.resourcesPath, 'n8n-templates', 'gstr2b-workflow.json')
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Workflow template not found at: ${templatePath}`)
      }
      
      const workflowTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf8'))
      const templateName = workflowTemplate.name || 'GSTR2B Complete Automation'
      
      // Create workflow with unique name
      const timestamp = new Date().toISOString().split('T')[0]
      const workflowData = {
        ...workflowTemplate,
        name: `${templateName} - ${timestamp}`,
        active: true // Activate the workflow immediately
      }
      
      console.log('Injecting workflow:', workflowData.name)
      
      // Import the workflow
      const importResult = await this.importWorkflowToN8n(workflowData)
      
      if (importResult.success) {
        console.log('✅ Workflow successfully injected into n8n!')
        return {
          success: true,
          workflowId: importResult.workflowId,
          workflowName: importResult.workflowName || workflowData.name,
          message: 'Workflow successfully injected and activated in n8n!',
          webhookUrl: `http://localhost:${this.n8nPort}/webhook/gstr2b-trigger`,
          editorUrl: `http://localhost:${this.n8nPort}/workflow/${importResult.workflowId}`
        }
      } else {
        throw new Error(importResult.error || 'Failed to import workflow')
      }
      
    } catch (error) {
      console.error('Failed to inject workflow:', error.message)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Create workflow from custom JSON data
  async createWorkflowFromJSON(workflowJSON) {
    try {
      console.log('Creating workflow from custom JSON...')
      
      // Check if n8n is running
      if (!this.isRunning) {
        throw new Error('n8n server is not running. Please start n8n first.')
      }
      
      // Parse JSON if it's a string
      let workflowData
      if (typeof workflowJSON === 'string') {
        workflowData = JSON.parse(workflowJSON)
      } else {
        workflowData = workflowJSON
      }
      
      // Ensure we have a name
      if (!workflowData.name) {
        workflowData.name = `Custom Workflow - ${new Date().toISOString().split('T')[0]}`
      }
      
      // Set as active by default
      workflowData.active = workflowData.active !== undefined ? workflowData.active : true
      
      console.log('Creating workflow:', workflowData.name)
      
      // Import the workflow
      const importResult = await this.importWorkflowToN8n(workflowData)
      
      if (importResult.success) {
        console.log('✅ Custom workflow successfully created in n8n!')
        return {
          success: true,
          workflowId: importResult.workflowId,
          workflowName: importResult.workflowName || workflowData.name,
          message: 'Custom workflow successfully created and activated in n8n!',
          editorUrl: `http://localhost:${this.n8nPort}/workflow/${importResult.workflowId}`
        }
      } else {
        throw new Error(importResult.error || 'Failed to import workflow')
      }
      
    } catch (error) {
      console.error('Failed to create workflow from JSON:', error.message)
      return {
        success: false,
        error: error.message
      }
    }
  }
}


module.exports = N8nServer
