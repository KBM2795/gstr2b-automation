"use client"

import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { LogsContent } from "@/components/logs-content"

export default function LogsPage() {
  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <LogsContent />
      </main>
    </div>
  )
}
