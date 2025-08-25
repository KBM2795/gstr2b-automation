"use client"

import { DashboardContent } from "@/components/dashboard-content"
import { useAppConfig } from "@/lib/app-context"

export default function DashboardPage() {
  const { config } = useAppConfig()
  
  return <DashboardContent config={config} />
}
