'use client'

import { useState, useEffect } from 'react'
import { X, BookOpen, Clock, FileText, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

interface AudioInfo {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'error' | 'outdated'
  audio_url?: string
  duration?: number
  file_size?: number
  voice_model?: string
  error_message?: string
  created_at: string
  updated_at: string
}

interface ChapterWithAudio {
  id: string
  title: string
  content: string
  content_preview: string
  project_id: string
  order_index: number
  word_count: number
  created_at: string
  project: {
    title: string
    description: string
  }
  audio: AudioInfo | null
}

interface ReadAlongModalProps {
  isOpen: boolean
  onClose: () => void
  chapter: ChapterWithAudio
}

export function ReadAlongModal({ isOpen, onClose, chapter }: ReadAlongModalProps) {
  const [fullContent, setFullContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch full chapter content when modal opens
  useEffect(() => {
    if (isOpen && chapter.id) {
      loadChapterContent()
    }
  }, [isOpen, chapter.id])

  const loadChapterContent = async () => {
    try {
      setLoading(true)
      setError(null)

      // Try to get full content from the chapters API
      const response = await fetch(`/api/chapters/${chapter.id}`)
      if (!response.ok) {
        throw new Error('Failed to load chapter content')
      }

      const chapterData = await response.json()
      setFullContent(chapterData.content || chapter.content)
    } catch (err) {
      console.error('Error loading chapter content:', err)
      setError('Failed to load chapter content')
      // Fallback to the content we already have
      setFullContent(chapter.content)
    } finally {
      setLoading(false)
    }
  }

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

  const countWords = (text: string) => {
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
                  <span>{countWords(fullContent || chapter.content).toLocaleString()} words</span>
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
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"
          >
            <X className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>

        {/* Audio Player */}
        {chapter.audio && chapter.audio.status === 'completed' && (
          <div className="p-4 md:p-6 border-b border-border bg-muted/10">
            <div className="max-w-4xl mx-auto">
              <audio 
                controls 
                className="w-full h-10 md:h-12"
                preload="metadata"
              >
                <source src={`/api/audio/stream/${chapter.audio.id}`} type="audio/mpeg" />
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
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      // Enhance paragraph spacing
                      p: ({ children }) => (
                        <p className="mb-6 leading-relaxed text-foreground text-base md:text-lg">{children}</p>
                      ),
                      // Style headings
                      h1: ({ children }) => (
                        <h1 className="text-2xl md:text-3xl font-bold mb-6 mt-8 text-foreground border-b border-border pb-2">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl md:text-2xl font-semibold mb-4 mt-6 text-foreground">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg md:text-xl font-semibold mb-3 mt-5 text-foreground">{children}</h3>
                      ),
                      // Style emphasis
                      em: ({ children }) => (
                        <em className="italic text-primary font-medium">{children}</em>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-bold text-foreground">{children}</strong>
                      ),
                      // Style underline
                      u: ({ children }) => (
                        <u className="underline text-foreground">{children}</u>
                      ),
                      // Style strikethrough  
                      del: ({ children }) => (
                        <del className="line-through text-muted-foreground">{children}</del>
                      ),
                      s: ({ children }) => (
                        <s className="line-through text-muted-foreground">{children}</s>
                      ),
                      // Style highlight
                      mark: ({ children }) => (
                        <mark className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">{children}</mark>
                      ),
                      // Style blockquotes
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary pl-6 my-6 italic text-muted-foreground bg-muted/30 py-4 rounded-r-lg">
                          {children}
                        </blockquote>
                      ),
                      // Style lists
                      ul: ({ children }) => (
                        <ul className="mb-4 pl-6 list-disc text-foreground">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-4 pl-6 list-decimal text-foreground">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="mb-2 leading-relaxed">{children}</li>
                      ),
                    }}
                  >
                    {fullContent}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
