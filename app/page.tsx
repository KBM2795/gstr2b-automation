"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { SetupWizard } from "@/components/setup-wizard"
import { useAppConfig } from "@/lib/app-context"

interface AppConfig {
  excelPath: string
  storagePath: string
  webhookUrl: string
}

export default function HomePage() {
  const { config, setConfig, isLoading } = useAppConfig()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && config.excelPath && config.storagePath && config.webhookUrl) {
      // Redirect to dashboard if setup is complete
      router.push("/dashboard")
    }
  }, [config, isLoading, router])

  const handleSetupComplete = (newConfig: AppConfig) => {
    setConfig(newConfig)
    // Redirect to dashboard after setup
    router.push("/dashboard")
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (config.excelPath && config.storagePath && config.webhookUrl) {
    return null // Will redirect to dashboard
  }

  return <SetupWizard onComplete={handleSetupComplete} />
}
