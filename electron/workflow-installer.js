const fs = require('fs')
const path = require('path')
const CredentialManager = require('./credential-manager')

class WorkflowInstaller {
  constructor(n8nDataPath, resourcesPath) {
    this.n8nDataPath = n8nDataPath
    this.templatesPath = path.join(resourcesPath, 'n8n-templates')
    this.workflowsPath = path.join(n8nDataPath, 'workflows')
    this.installedMarker = path.join(n8nDataPath, '.workflows-installed')
    
    // Initialize credential manager
    this.credentialManager = new CredentialManager(n8nDataPath)
  }

  async installDefaultWorkflows() {
    try {
      // Check if workflows are already installed
      if (fs.existsSync(this.installedMarker)) {
        console.log('Default workflows already installed')
        return
      }

      // Ensure workflows directory exists
      if (!fs.existsSync(this.workflowsPath)) {
        fs.mkdirSync(this.workflowsPath, { recursive: true })
      }

      // Copy template workflows
      if (fs.existsSync(this.templatesPath)) {
        const templates = fs.readdirSync(this.templatesPath)
        
        for (const template of templates) {
          if (template.endsWith('.json')) {
            const sourcePath = path.join(this.templatesPath, template)
            const destPath = path.join(this.workflowsPath, template)
            
            console.log(`Installing workflow template: ${template}`)
            fs.copyFileSync(sourcePath, destPath)
          }
        }

        // Create marker file
        fs.writeFileSync(this.installedMarker, new Date().toISOString())
        console.log('Default workflows installed successfully')
      } else {
        console.log('No workflow templates found')
      }
    } catch (error) {
      console.error('Failed to install default workflows:', error)
    }
  }

  async createWorkflowsDatabase() {
    try {
      const dbPath = path.join(this.n8nDataPath, 'database.sqlite')
      
      // Create basic database structure if it doesn't exist
      if (!fs.existsSync(dbPath)) {
        console.log('Creating n8n database structure...')
        // n8n will create the database on first run
        // We just ensure the directory exists
      }
    } catch (error) {
      console.error('Failed to create workflows database:', error)
    }
  }

  async setupDefaultCredentials() {
    try {
      // Use the comprehensive credential manager
      await this.credentialManager.setupDefaultCredentials()
      this.credentialManager.createCredentialGuide()
      console.log('Advanced credential setup completed')
    } catch (error) {
      console.error('Failed to setup default credentials:', error)
    }
  }

  async installAll() {
    console.log('Installing default n8n configuration...')
    await this.createWorkflowsDatabase()
    await this.setupDefaultCredentials()
    await this.installDefaultWorkflows()
    console.log('n8n setup completed')
  }
}

module.exports = WorkflowInstaller
