'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Chapter } from '@/types/database'

interface ReaderTOCProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectTitle: string
  chapters: Chapter[]
  currentIndex: number
  onSelect: (index: number) => void
}

export function ReaderTOC({
  open,
  onOpenChange,
  projectTitle,
  chapters,
  currentIndex,
  onSelect,
}: ReaderTOCProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Table of Contents</DialogTitle>
          <p className="text-sm text-muted-foreground">{projectTitle}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          <div className="space-y-2">
            {chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                onClick={() => onSelect(index)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  index === currentIndex
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium mb-1">{chapter.title}</div>
                    <div className="text-sm text-muted-foreground">
                      Chapter {chapter.order_index} •{' '}
                      {(chapter.word_count || 0).toLocaleString()} words
                      {(chapter.word_count || 0) > 0 && (
                        <span>
                          {' '}
                          • {Math.max(1, Math.ceil((chapter.word_count || 0) / 250))} min read
                        </span>
                      )}
                    </div>
                  </div>
                  {index === currentIndex && (
                    <div className="text-primary text-sm font-medium ml-2">Current</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
