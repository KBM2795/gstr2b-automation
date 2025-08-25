const { spawn } = require('child_process')

class ProcessManager {
  static async killProcessOnPort(port) {
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        // Windows: Use netstat and taskkill
        const netstat = spawn('netstat', ['-ano'])
        let output = ''

        netstat.stdout.on('data', (data) => {
          output += data.toString()
        })

        netstat.on('close', () => {
          const lines = output.split('\n')
          const portLine = lines.find(line => 
            line.includes(`:${port}`) && line.includes('LISTENING')
          )

          if (portLine) {
            const parts = portLine.trim().split(/\s+/)
            const pid = parts[parts.length - 1]
            
            if (pid && !isNaN(pid)) {
              console.log(`Killing process ${pid} on port ${port}`)
              const taskkill = spawn('taskkill', ['/PID', pid, '/F'])
              
              taskkill.on('close', (code) => {
                console.log(`Process ${pid} killed with code ${code}`)
                resolve(code === 0)
              })
            } else {
              resolve(false)
            }
          } else {
            console.log(`No process found on port ${port}`)
            resolve(true)
          }
        })
      } else {
        // Unix-like systems: Use lsof and kill
        const lsof = spawn('lsof', ['-ti', `:${port}`])
        let pid = ''

        lsof.stdout.on('data', (data) => {
          pid += data.toString().trim()
        })

        lsof.on('close', () => {
          if (pid) {
            console.log(`Killing process ${pid} on port ${port}`)
            const kill = spawn('kill', ['-9', pid])
            
            kill.on('close', (code) => {
              console.log(`Process ${pid} killed with code ${code}`)
              resolve(code === 0)
            })
          } else {
            console.log(`No process found on port ${port}`)
            resolve(true)
          }
        })
      }
    })
  }

  static async killN8nProcesses() {
    console.log('Cleaning up any remaining n8n processes...')
    
    // Kill process on n8n port
    await this.killProcessOnPort(5678)
    
    // Also try to kill any node processes that might be n8n
    if (process.platform === 'win32') {
      return new Promise((resolve) => {
        const tasklist = spawn('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV'])
        let output = ''

        tasklist.stdout.on('data', (data) => {
          output += data.toString()
        })

        tasklist.on('close', () => {
          const lines = output.split('\n')
          const n8nProcesses = lines.filter(line => 
            line.includes('node.exe') && line.includes('n8n')
          )

          if (n8nProcesses.length > 0) {
            console.log(`Found ${n8nProcesses.length} n8n processes to clean up`)
            // Kill them one by one
            // This is a simplified approach - in production you'd want more careful PID extraction
          }
          
          resolve()
        })
      })
    }
  }
}

module.exports = ProcessManager
