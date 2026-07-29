import { cn } from "@/lib/utils"

/**
 * Theme-aware status pill. Replaces the light-only `bg-green-100
 * text-green-800`-style chips that broke in dark mode.
 */
const statusStyles: Record<string, string> = {
  // Projects
  draft: "bg-muted text-muted-foreground",
  active: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  archived: "bg-muted text-muted-foreground/70",
  // Chapters
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
  published: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  // Ideas
  new: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  used: "bg-green-500/15 text-green-700 dark:text-green-300",
  // Audio
  pending: "bg-muted text-muted-foreground",
  processing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  generating: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        statusStyles[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  )
}
