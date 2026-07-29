'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { X, BookOpen, Clock, FileText, Volume2, Book } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChapterMarkdown } from '@/components/markdown/ChapterMarkdown'
import type { AudioLibraryChapter } from '@/lib/data/audioLibrary'

interface ReadAlongModalProps {
  isOpen: boolean
  onClose: () => void
  chapter: AudioLibraryChapter
}

export function ReadAlongModal({ isOpen, onClose, chapter }: ReadAlongModalProps) {
  const [fullContent, setFullContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadChapterContent = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (!chapter?.id) {
        throw new Error('Invalid chapter ID')
      }

      const response = await fetch(`/api/chapters/${chapter.id}`)
      if (!response.ok) {
        throw new Error(`Failed to load chapter content: ${response.status}`)
      }

      const chapterData = await response.json()
      if (chapterData && typeof chapterData === 'object') {
        setFullContent(chapterData.content || chapter.content_preview || '')
      } else {
        throw new Error('Invalid chapter data format')
      }
    } catch (err) {
      console.error('Error loading chapter content:', err)
      setError('Failed to load chapter content')
      // Fallback to the preview we already have
      setFullContent(chapter?.content_preview || '')
    } finally {
      setLoading(false)
    }
  }, [chapter?.id, chapter?.content_preview])

  // Fetch full chapter content when modal opens
  useEffect(() => {
    if (isOpen && chapter?.id) {
      loadChapterContent()
    }
  }, [isOpen, chapter?.id, loadChapterContent])

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const countWords = (text: string | undefined) => {
    if (!text) return 0
    return text.trim().split(/\s+/).length
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-2 md:inset-8 lg:inset-16 xl:inset-20 bg-background border border-border rounded-lg z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg md:text-xl font-semibold text-foreground truncate">
                {chapter.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground mt-1">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3 md:h-4 md:w-4" />
                  <span>{countWords(fullContent || chapter.content_preview).toLocaleString()} words</span>
                </div>
                {chapter.audio && chapter.audio.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 md:h-4 md:w-4" />
                    <span>{formatDuration(chapter.audio.duration)}</span>
                  </div>
                )}
                {chapter.audio && chapter.audio.file_size && (
                  <div className="flex items-center gap-1">
                    <Volume2 className="h-3 w-3 md:h-4 md:w-4" />
                    <span>{formatFileSize(chapter.audio.file_size)}</span>
                  </div>
                )}
                {chapter.audio && chapter.audio.voice_model && (
                  <span className="text-primary">Voice: {chapter.audio.voice_model}</span>
                )}
                {chapter.project_id && (
                  <Link href={`/project/${chapter.project_id}/read?chapter=${chapter.id}`}>
                    <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs font-medium border-2">
                      <Book className="h-3 w-3" />
                      Read in Full
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-2 h-9 w-9 p-0"
          >
            <X className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>

        {/* Audio Player */}
        {chapter.audio && chapter.audio.status === 'completed' && chapter.audio.id && (
          <div className="p-4 md:p-6 border-b border-border bg-muted/10">
            <div className="max-w-4xl mx-auto">
              <audio 
                controls 
                className="w-full h-10 md:h-12"
                preload="metadata"
              >
                <source src={chapter.audio.playUrl || chapter.audio.audio_url || `/api/audio/stream/${chapter.audio.id}`} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Loading chapter content...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-red-500 mb-2">Error: {error}</p>
                <Button variant="outline" size="sm" onClick={loadChapterContent}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 md:p-8 lg:p-12">
              <div className="max-w-4xl mx-auto">
                <div className="max-w-none">
                  <ChapterMarkdown content={fullContent} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
