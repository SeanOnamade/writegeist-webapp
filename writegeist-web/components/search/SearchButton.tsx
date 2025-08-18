'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SearchDialog } from './SearchDialog'

export function SearchButton() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsSearchOpen(true)}
        className="relative w-full sm:w-64 justify-start text-muted-foreground"
      >
        <span className="flex items-center">
          🔍
          <span className="ml-2">Search...</span>
        </span>
        <div className="ml-auto flex items-center space-x-1">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </Button>

      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  )
}

