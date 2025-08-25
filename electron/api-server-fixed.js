const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

class ElectronAPI {
  constructor(configPath) {
    this.app = express()
    this.port = 3002
    this.configPath = configPath
    this.server = null
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
      try {
        const data = this.readData()
        res.json(data.locations)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    this.app.post('/api/locations', (req, res) => {
      try {
        const data = this.readData()
        const newLocation = {
          id: Date.now().toString(),
          ...req.body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        data.locations.push(newLocation)
        this.writeData(data)
        res.json(newLocation)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    // Settings API
    this.app.get('/api/settings', (req, res) => {
      try {
        const data = this.readData()
        res.json(data.settings)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    this.app.post('/api/settings', (req, res) => {
      try {
        const data = this.readData()
        data.settings = { ...data.settings, ...req.body }
        this.writeData(data)
        res.json(data.settings)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    // Logs API
    this.app.get('/api/logs', (req, res) => {
      try {
        const data = this.readData()
        res.json(data.logs)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    this.app.post('/api/logs', (req, res) => {
      try {
        const data = this.readData()
        const newLog = {
          id: Date.now().toString(),
          ...req.body,
          timestamp: new Date().toISOString()
        }
        data.logs.push(newLog)
        this.writeData(data)
        res.json(newLog)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, 'localhost', (error) => {
        if (error) {
          reject(error)
        } else {
          console.log(`API server listening on http://localhost:${this.port}`)
          resolve()
        }
      })
    })
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('API server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

module.exports = ElectronAPI
