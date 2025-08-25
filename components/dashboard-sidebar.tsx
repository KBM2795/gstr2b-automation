"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, FileText, Settings } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { id: "logs", label: "Logs", icon: FileText, path: "/logs" },
    { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  ]

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border h-screen p-4">
      <div className="mb-8">
        <h1 className="font-serif text-xl font-bold text-sidebar-foreground">Desktop Dashboard</h1>
      </div>

      <nav className="space-y-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.path
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive && "bg-sidebar-primary text-sidebar-primary-foreground",
              )}
              onClick={() => router.push(tab.path)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {tab.label}
            </Button>
          )
        })}
      </nav>
    </div>
  )
}
