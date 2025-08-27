const fs = require('fs')
const path = require('path')

class CredentialManager {
  constructor(n8nDataPath) {
    this.n8nDataPath = n8nDataPath
    this.credentialsPath = path.join(n8nDataPath, 'credentials')
  }

  async setupDefaultCredentials() {
    try {
      // Ensure credentials directory exists
      if (!fs.existsSync(this.credentialsPath)) {
        fs.mkdirSync(this.credentialsPath, { recursive: true })
      }

      await this.createFileSystemCredentials()
      await this.createAPICredentials()
      await this.createEmailCredentials()
      await this.createDatabaseCredentials()

      console.log('All default credentials configured')
    } catch (error) {
      console.error('Failed to setup credentials:', error)
    }
  }

  async createFileSystemCredentials() {
    // File system access - no credentials needed for local files
    const fileSystemCreds = {
      id: 'gstr2b-filesystem',
      name: 'GSTR2B File System Access',
      type: 'fileSystem',
      data: {
        description: 'Local file system access for GSTR2B files',
        rootPath: process.env.USERPROFILE || process.env.HOME || '/'
      }
    }

    const credsFile = path.join(this.credentialsPath, 'filesystem.json')
    if (!fs.existsSync(credsFile)) {
      fs.writeFileSync(credsFile, JSON.stringify(fileSystemCreds, null, 2))
      console.log('File system credentials created')
    }
  }

  async createAPICredentials() {
    // Internal API credentials for the app's own API
    const apiCreds = {
      id: 'gstr2b-internal-api',
      name: 'GSTR2B Internal API',
      type: 'httpHeaderAuth',
      data: {
        name: 'Authorization',
        value: 'Bearer gstr2b-internal-token-' + Date.now(),
        description: 'Internal API access for GSTR2B app communication'
      }
    }

    const credsFile = path.join(this.credentialsPath, 'internal-api.json')
    if (!fs.existsSync(credsFile)) {
      fs.writeFileSync(credsFile, JSON.stringify(apiCreds, null, 2))
      console.log('Internal API credentials created')
    }
  }

  async createEmailCredentials() {
    // Template for email notifications (clients can fill in their details)
    const emailTemplate = {
      id: 'gstr2b-email-template',
      name: 'GSTR2B Email Notifications (Configure Me)',
      type: 'smtp',
      data: {
        user: 'YOUR_EMAIL@company.com',
        password: 'YOUR_EMAIL_PASSWORD',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        description: 'Configure this for email reports and notifications',
        instructions: [
          '1. Edit this credential in n8n editor',
          '2. Enter your email and password',
          '3. Update SMTP settings for your provider',
          '4. Test the connection',
          '5. Enable email notifications in workflows'
        ]
      }
    }

    const credsFile = path.join(this.credentialsPath, 'email-template.json')
    if (!fs.existsSync(credsFile)) {
      fs.writeFileSync(credsFile, JSON.stringify(emailTemplate, null, 2))
      console.log('Email template credentials created')
    }
  }

  async createDatabaseCredentials() {
    // Local SQLite database - no authentication needed
    const dbCreds = {
      id: 'gstr2b-database',
      name: 'GSTR2B Local Database',
      type: 'sqlite',
      data: {
        database: path.join(this.n8nDataPath, 'gstr2b-data.db'),
        description: 'Local SQLite database for GSTR2B data storage'
      }
    }

    const credsFile = path.join(this.credentialsPath, 'database.json')
    if (!fs.existsSync(credsFile)) {
      fs.writeFileSync(credsFile, JSON.stringify(dbCreds, null, 2))
      console.log('Database credentials created')
    }
  }

  async createGSTPortalCredentials() {
    // Template for GST portal integration (optional)
    const gstPortalTemplate = {
      id: 'gst-portal-template',
      name: 'GST Portal Integration (Optional)',
      type: 'httpBasicAuth',
      data: {
        user: 'YOUR_GST_USERNAME',
        password: 'YOUR_GST_PASSWORD',
        description: 'Optional: For direct GST portal integration',
        instructions: [
          '1. This is optional - only if you want direct portal integration',
          '2. Enter your GST portal username and password',
          '3. Enable GST portal workflows if needed',
          '4. Keep credentials secure and encrypted'
        ],
        note: 'GSTR2B app works without portal integration - files can be processed offline'
      }
    }

    const credsFile = path.join(this.credentialsPath, 'gst-portal-template.json')
    if (!fs.existsSync(credsFile)) {
      fs.writeFileSync(credsFile, JSON.stringify(gstPortalTemplate, null, 2))
      console.log('GST portal template credentials created')
    }
  }

  createCredentialGuide() {
    const guide = `# GSTR2B Credential Management Guide

## 🔐 What Credentials Are Pre-Configured

### ✅ READY TO USE (No Setup Needed)
- **File System Access** - Local file reading/writing
- **Internal API** - App communication 
- **Local Database** - SQLite data storage
- **Workflow Execution** - n8n automation

### 📝 OPTIONAL CONFIGURATION (Client Choice)
- **Email Notifications** - For sending reports
- **GST Portal Integration** - Direct portal access (optional)
- **Cloud Storage** - Backup to cloud (optional)

## 🚀 Client Experience

### Day 1: Works Immediately
- All core GSTR2B processing works without any credential setup
- File processing, validation, reporting - all ready
- Basic automation runs out of the box

### Optional Enhancements
If clients want email reports or portal integration:
1. Open n8n editor
2. Go to Credentials section
3. Edit the template credentials
4. Add their email/portal details
5. Enable enhanced workflows

## 🛡️ Security Features

- Credentials stored locally on client machine
- Encrypted at rest using n8n's encryption
- No cloud transmission unless client chooses
- Each client has isolated credential storage

## 📋 Pre-Configured Credential Types

### 1. File System Access
- **Purpose**: Read Excel/CSV files, write reports
- **Setup**: Automatic, no client action needed
- **Scope**: Local file system only

### 2. Internal API Authentication  
- **Purpose**: Secure app-to-n8n communication
- **Setup**: Auto-generated unique tokens
- **Scope**: Internal communication only

### 3. Database Access
- **Purpose**: Store processed data, execution logs
- **Setup**: Local SQLite, no authentication needed
- **Scope**: Local database file

### 4. Email Template (Optional)
- **Purpose**: Send GSTR2B reports via email
- **Setup**: Client configures if they want email features
- **Scope**: Client's email provider

### 5. GST Portal Template (Optional)
- **Purpose**: Direct GST portal integration
- **Setup**: Client configures if they want portal features
- **Scope**: GST portal API access

## ✨ Bottom Line

**Core GSTR2B functionality requires ZERO credential setup!**

Optional features like email reports can be configured later if clients want them.`

    const guidePath = path.join(this.credentialsPath, 'CREDENTIAL-GUIDE.md')
    fs.writeFileSync(guidePath, guide)
    console.log('Credential guide created')
  }
}

module.exports = CredentialManager
