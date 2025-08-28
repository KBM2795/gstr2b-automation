'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react'

interface UpdateInfo {
  status: 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error'
  version?: string
  progress?: number
  message?: string
}

export default function UpdateStatus() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ status: 'up-to-date' })
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(typeof window !== 'undefined' && 'electronAPI' in window)

    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      // Listen for update status changes
      const electronAPI = (window as any).electronAPI

      electronAPI.onUpdateStatus((event: any, message: string) => {
        console.log('Update status:', message)
        
        if (message.includes('Checking')) {
          setUpdateInfo({ status: 'checking', message })
        } else if (message.includes('available')) {
          setUpdateInfo({ status: 'available', message })
        } else if (message.includes('Downloading')) {
          setUpdateInfo({ status: 'downloading', message })
        } else if (message.includes('downloaded')) {
          setUpdateInfo({ status: 'ready', message })
        } else if (message.includes('up to date')) {
          setUpdateInfo({ status: 'up-to-date', message })
        }
      })

      electronAPI.onDownloadProgress((event: any, progressObj: any) => {
        setUpdateInfo(prev => ({
          ...prev,
          status: 'downloading',
          progress: Math.round(progressObj.percent),
          message: `Downloading update: ${Math.round(progressObj.percent)}%`
        }))
      })

      // Cleanup listeners on unmount
      return () => {
        electronAPI.removeUpdateListeners()
      }
    }
  }, [])

  const handleCheckForUpdates = async () => {
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      const electronAPI = (window as any).electronAPI
      setUpdateInfo({ status: 'checking', message: 'Checking for updates...' })
      
      try {
        const result = await electronAPI.checkForUpdates()
        console.log('Check for updates result:', result)
      } catch (error) {
        console.error('Check for updates error:', error)
        setUpdateInfo({ status: 'error', message: 'Failed to check for updates' })
      }
    }
  }

  const handleDownloadUpdate = async () => {
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      const electronAPI = (window as any).electronAPI
      
      try {
        const result = await electronAPI.downloadUpdate()
        console.log('Download update result:', result)
      } catch (error) {
        console.error('Download update error:', error)
        setUpdateInfo({ status: 'error', message: 'Failed to download update' })
      }
    }
  }

  const handleInstallUpdate = async () => {
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      const electronAPI = (window as any).electronAPI
      
      try {
        const result = await electronAPI.installUpdate()
        console.log('Install update result:', result)
      } catch (error) {
        console.error('Install update error:', error)
        setUpdateInfo({ status: 'error', message: 'Failed to install update' })
      }
    }
  }

  // Don't render if not in Electron
  if (!isElectron) {
    return null
  }

  const getStatusIcon = () => {
    switch (updateInfo.status) {
      case 'checking':
        return <RotateCcw className="h-4 w-4 animate-spin" />
      case 'available':
        return <Download className="h-4 w-4 text-blue-500" />
      case 'downloading':
        return <Download className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'up-to-date':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <CheckCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = () => {
    switch (updateInfo.status) {
      case 'checking':
        return 'text-blue-600'
      case 'available':
        return 'text-blue-600'
      case 'downloading':
        return 'text-blue-600'
      case 'ready':
        return 'text-green-600'
      case 'up-to-date':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {getStatusIcon()}
          App Updates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`text-sm ${getStatusColor()}`}>
          {updateInfo.message || 'Application is up to date'}
        </div>
        
        {updateInfo.status === 'downloading' && updateInfo.progress && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${updateInfo.progress}%` }}
            />
          </div>
        )}
        
        <div className="flex gap-2">
          {updateInfo.status === 'checking' && (
            <Button size="sm" variant="outline" disabled>
              Checking...
            </Button>
          )}
          
          {(updateInfo.status === 'up-to-date' || updateInfo.status === 'error') && (
            <Button 
              onClick={handleCheckForUpdates} 
              size="sm" 
              variant="outline"
            >
              Check for Updates
            </Button>
          )}
          
          {updateInfo.status === 'available' && (
            <Button 
              onClick={handleDownloadUpdate} 
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Update
            </Button>
          )}
          
          {updateInfo.status === 'ready' && (
            <Button 
              onClick={handleInstallUpdate} 
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              Install & Restart
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
