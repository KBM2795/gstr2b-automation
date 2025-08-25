"use client"

import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { SettingsContent } from "@/components/settings-content"
import { useAppConfig } from "@/lib/app-context"

export default function SettingsPage() {
  const { config, setConfig } = useAppConfig()
  
  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <SettingsContent config={config} onConfigUpdate={setConfig} />
      </main>
    </div>
  )
}
