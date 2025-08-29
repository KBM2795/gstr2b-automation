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
}

module.exports = ProcessManager
