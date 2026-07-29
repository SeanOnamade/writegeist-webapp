import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: ReactNode
  className?: string
}

export function StatCard({ label, value, className }: StatCardProps) {
  return (
    <div className={cn("bg-card border rounded-lg p-4 shadow-sm", className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight mt-1">{value}</div>
    </div>
  )
}

interface StatsGridProps {
  stats: { label: string; value: ReactNode }[]
  className?: string
}

export function StatsGrid({ stats, className }: StatsGridProps) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}>
      {stats.map((stat) => (
        <StatCard key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </div>
  )
}
