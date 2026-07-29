'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { SearchDialog } from './SearchDialog'

export function SearchButton({
  collapsed = false,
  enableShortcut = true,
}: {
  collapsed?: boolean
  /** Disable when a second instance is mounted (e.g. mobile drawer). */
  enableShortcut?: boolean
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [shortcutHint, setShortcutHint] = useState('')

  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    setShortcutHint(isMac ? '\u2318K' : 'Ctrl K')

    if (!enableShortcut) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enableShortcut])

  return (
    <>
      <button
        onClick={() => setIsSearchOpen(true)}
        title={collapsed ? 'Search' : undefined}
        className={`flex h-9 w-full items-center gap-2 rounded-md border bg-background text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
          collapsed ? 'justify-center px-0' : 'px-2.5'
        }`}
      >
        <Search className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span>Search...</span>
            {shortcutHint && (
              <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
                {shortcutHint}
              </kbd>
            )}
          </>
        )}
      </button>

      <SearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  )
}
