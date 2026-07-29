import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Styled native select. Replaces the hand-written
 * "px-3 py-2 border border-input rounded-md bg-background ..." strings that
 * were copy-pasted across pages.
 */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        // text-base on mobile: fonts under 16px make iOS Safari zoom on focus.
        "h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-base sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  </div>
))
Select.displayName = "Select"

export { Select }
