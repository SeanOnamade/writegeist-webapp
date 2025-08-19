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
          <span>Search...</span>
        </span>
        {/* Removed ⌘K indicator */}
      </Button>

      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  )
}

