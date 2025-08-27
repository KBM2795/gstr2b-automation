const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

class ElectronAPI {
  constructor(configPath) {
    this.app = express()
    this.port = 3002 // Changed from 3001 to 3002 to avoid conflict with Next.js
    this.configPath = configPath
    this.setupMiddleware()
    this.setupRoutes()
  }

  setupMiddleware() {
    this.app.use(cors())
    this.app.use(express.json())
  }

  readData() {
    try {
      if (!this.configPath || !fs.existsSync(this.configPath)) {
        return { locations: [], settings: {}, logs: [] }
      }
      const data = fs.readFileSync(this.configPath, 'utf8')
      const parsed = JSON.parse(data)
      return {
        locations: parsed.locations || [],
        settings: parsed.settings || {},
        logs: parsed.logs || []
      }
    } catch (error) {
      console.error('Error reading data:', error)
      return { locations: [], settings: {}, logs: [] }
    }
  }

  writeData(data) {
    try {
      if (!this.configPath) return false
      fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2))
      return true
    } catch (error) {
      console.error('Error writing data:', error)
      return false
    }
  }

  setupRoutes() {
    // Locations API
    this.app.get('/api/locations', (req, res) => {
      const data = this.readData()
      res.json({ locations: data.locations })
    })

    this.app.post('/api/locations', (req, res) => {
      const { path, type } = req.body
      const data = this.readData()
      
      // Remove existing location of same type
      data.locations = data.locations.filter(loc => loc.type !== type)
      
      const location = {
        id: Date.now().toString(),
        path,
        type,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      data.locations.push(location)
      
      if (this.writeData(data)) {
        res.json({ success: true, location })
      } else {
        res.status(500).json({ error: 'Failed to save location' })
      }
    })

    this.app.get('/api/locations/:type', (req, res) => {
      const { type } = req.params
      const data = this.readData()
      const location = data.locations.find(loc => loc.type === type)
      res.json({ location: location || null })
    })

    this.app.delete('/api/locations/:id', (req, res) => {
      const { id } = req.params
      const data = this.readData()
      const initialLength = data.locations.length
      data.locations = data.locations.filter(loc => loc.id !== id)
      
      if (data.locations.length < initialLength && this.writeData(data)) {
        res.json({ success: true })
      } else {
        res.status(404).json({ error: 'Location not found' })
      }
    })

    // Settings API
    this.app.get('/api/settings', (req, res) => {
      const data = this.readData()
      res.json({ settings: data.settings })
    })

    this.app.post('/api/settings', (req, res) => {
      const settings = req.body
      const data = this.readData()
      data.settings = { ...data.settings, ...settings }
      
      if (this.writeData(data)) {
        res.json({ success: true, settings: data.settings })
      } else {
        res.status(500).json({ error: 'Failed to save settings' })
      }
    })

    // Config API for getting app configuration (excel and storage paths)
    this.app.get('/config', (req, res) => {
      const data = this.readData()
      const excelLocation = data.locations.find(loc => loc.type === 'file')
      const storageLocation = data.locations.find(loc => loc.type === 'folder')
      
      res.json({
        excelPath: excelLocation ? excelLocation.path : '',
        storagePath: storageLocation ? storageLocation.path : ''
      })
    })

    // Logs API
    this.app.get('/api/logs', (req, res) => {
      const data = this.readData()
      res.json({ logs: data.logs })
    })

    this.app.post('/api/logs', (req, res) => {
      const { message, level = 'info', category = 'general' } = req.body
      const data = this.readData()
      
      const logEntry = {
        id: Date.now().toString(),
        message,
        level,
        category,
        timestamp: new Date().toISOString()
      }
      
      if (!data.logs) data.logs = []
      data.logs.unshift(logEntry)
      
      // Keep only last 1000 logs
      if (data.logs.length > 1000) {
        data.logs = data.logs.slice(0, 1000)
      }
      
      if (this.writeData(data)) {
        res.json({ success: true, log: logEntry })
      } else {
        res.status(500).json({ error: 'Failed to save log' })
      }
    })

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        configPath: this.configPath 
      })
    })
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, 'localhost', (err) => {
        if (err) {
          reject(err)
        } else {
          console.log(`Electron API server running on http://localhost:${this.port}`)
          resolve(this.port)
        }
      })
    })
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Electron API server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

module.exports = ElectronAPI
