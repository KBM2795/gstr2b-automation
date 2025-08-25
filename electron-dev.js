#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')

// First, start the Next.js dev server
console.log('Starting Next.js development server...')
const nextDev = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
})

// Wait a bit for the server to start, then launch Electron
setTimeout(() => {
  console.log('Starting Electron...')
  const electronProcess = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  })

  electronProcess.on('close', () => {
    nextDev.kill()
    process.exit()
  })
}, 3000)

// Handle process termination
process.on('SIGINT', () => {
  nextDev.kill()
  process.exit()
})
