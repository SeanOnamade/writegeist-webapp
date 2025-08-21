'use client'

import { useState, useEffect, useCallback } from 'react'
import { Headphones, Download, RefreshCw, Clock, CheckCircle, AlertCircle, Loader2, BookOpen, Book } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// Progress component replaced with simple div for compatibility
import { useToast } from '@/hooks/use-toast'
import { ReadAlongModal } from '@/components/audio/ReadAlongModal'

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

interface AudioStats {
  total_chapters: number
  audio_generated: number
  audio_processing: number
  audio_pending: number
  audio_errors: number
  total_duration: number
  total_file_size: number
}

export default function AudioPage() {
  const [chapters, setChapters] = useState<ChapterWithAudio[]>([])
  const [stats, setStats] = useState<AudioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingAudio, setGeneratingAudio] = useState<Set<string>>(new Set())
  const [readAlongModal, setReadAlongModal] = useState<{ isOpen: boolean, chapter: ChapterWithAudio | null }>({ isOpen: false, chapter: null })
  const [apiKeyValidated, setApiKeyValidated] = useState<boolean | null>(null) // Cache validation result
  const [validatingKey, setValidatingKey] = useState<Set<string>>(new Set()) // Track validation in progress
  const [generationProgress, setGenerationProgress] = useState<Map<string, { progress: number, message: string }>>(new Map())
// Removed unused playingAudio state
  const { toast } = useToast()

  // Load audio library
  const loadAudioLibrary = useCallback(async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/audio/library')
      if (!response.ok) {
        throw new Error(`Failed to load audio library: ${response.status}`)
      }
      
      const data = await response.json()
      setChapters(data.chapters)
      setStats(data.stats)
      
      console.log('Loaded audio library:', data.stats)
      
    } catch (error) {
      console.error('Failed to load audio library:', error)
      toast({
        title: "Error",
        description: "Failed to load audio library. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadAudioLibrary()
  }, [loadAudioLibrary])

  // Validate API key before generation (with smart caching)
  const validateAPIKey = async (chapterId: string): Promise<boolean> => {
    try {
      // Only use cached result for successful validations
      if (apiKeyValidated === true) {
        return true
      }

      // Show validation loading state
      setValidatingKey(prev => new Set(prev).add(chapterId))

      const response = await fetch('/api/audio/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()
      
      if (!result.valid) {
        // Don't cache failures - always show toast for API key issues
        toast({
          title: "⚠️ OpenAI API Key Issue",
          description: result.error || "Please check your OpenAI API key configuration.",
          variant: "destructive",
        })
        return false
      }

      // Cache successful validation for 5 minutes
      setApiKeyValidated(true)
      setTimeout(() => setApiKeyValidated(null), 5 * 60 * 1000)

      return true
    } catch (error) {
      console.error('API key validation error:', error)
      toast({
        title: "⚠️ Cannot Validate API Key",
        description: "Unable to verify your OpenAI API key. Generation may fail.",
        variant: "destructive",
      })
      return false
    } finally {
      // Clear validation loading state
      setValidatingKey(prev => {
        const newSet = new Set(prev)
        newSet.delete(chapterId)
        return newSet
      })
    }
  }

  // Generate audio for a chapter with real-time progress
  const generateAudio = async (chapterId: string, chapterTitle: string, force: boolean = false) => {
    try {
      // Validate API key first (before showing generating state)
      const isValidKey = await validateAPIKey(chapterId)
      if (!isValidKey) {
        return // Stop if API key is invalid
      }

      // Only show generating state after validation passes
      setGeneratingAudio(prev => new Set(prev).add(chapterId))
      setGenerationProgress(prev => new Map(prev).set(chapterId, { progress: 0, message: 'Preparing...' }))
      
      // Use Server-Sent Events for real-time progress
      const response = await fetch('/api/audio/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chapterId,
          voice: 'alloy', // TODO: Make configurable
          model: 'tts-1-hd',
          force 
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Generation failed: ${response.status}`)
      }

      // Set up SSE listener for real-time progress
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            let currentEvent = ''
            
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim()
              } else if (line.startsWith('data: ') && currentEvent) {
                try {
                  const data = JSON.parse(line.slice(6))
                  // console.log(`SSE Event: ${currentEvent}`, data) // Debug
                  
                  if (currentEvent === 'progress') {
                    // Update progress
                    setGenerationProgress(prev => new Map(prev).set(chapterId, {
                      progress: data.progress || 0,
                      message: data.message || 'Processing...'
                    }))
                  } else if (currentEvent === 'complete') {
                    // Generation completed
                    toast({
                      title: "Audio Generated!",
                      description: `Audio for "${chapterTitle}" is ready to play.`,
                    })
                    
                    // Refresh library to show new audio
                    await loadAudioLibrary()
                    break
                  } else if (currentEvent === 'error') {
                    throw new Error(data.error || 'Generation failed')
                  }
                } catch (parseError) {
                  console.warn('Error parsing SSE data:', parseError)
                }
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      }
      
    } catch (error) {
      console.error('Audio generation error:', error)
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate audio. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingAudio(prev => {
        const newSet = new Set(prev)
        newSet.delete(chapterId)
        return newSet
      })
      setGenerationProgress(prev => {
        const newMap = new Map(prev)
        newMap.delete(chapterId)
        return newMap
      })
    }
  }

  // Download audio file
  const downloadAudio = async (chapter: ChapterWithAudio) => {
    if (!chapter.audio?.id) {
      toast({
        title: "Download Failed",
        description: "No audio file found for this chapter.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/audio/download/${chapter.audio.id}`)
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Generate filename
      const sanitizedTitle = chapter.title
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '_')
        .toLowerCase()
        .substring(0, 50) || 'chapter'
      link.download = `${sanitizedTitle}_audio.mp3`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Download Started",
        description: `Downloading audio for "${chapter.title}"...`,
      })
    } catch (error) {
      console.error('Download failed:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download audio file. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  // Get status badge
  const getStatusBadge = (status: string, chapterId: string) => {
    const isGenerating = generatingAudio.has(chapterId)
    
    if (isGenerating || status === 'processing') {
      return (
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Generating...
        </Badge>
      )
    }

    switch (status) {
      case 'completed':
        return (
          <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ready
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-red-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      case 'outdated':
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Outdated
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-gray-500/30 text-gray-400">
            <Clock className="h-3 w-3 mr-1" />
            Not Generated
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Headphones className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold">Audio Library</h1>
              <p className="text-muted-foreground">Generate and manage audio versions of your chapters</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAudioLibrary}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total_chapters}</div>
                <p className="text-xs text-muted-foreground">Total Chapters</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-400">{stats.audio_generated}</div>
                <p className="text-xs text-muted-foreground">Audio Ready</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-400">{stats.audio_processing}</div>
                <p className="text-xs text-muted-foreground">Processing</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {stats.total_duration > 0 ? formatDuration(stats.total_duration) : '0:00'}
                </div>
                <p className="text-xs text-muted-foreground">Total Duration</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Chapters List */}
        {chapters.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Headphones className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No chapters found. Create some chapters first!</p>
              <Button
                onClick={() => window.location.href = '/chapters'}
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Go to Chapters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {chapters.map((chapter) => (
              <Card key={chapter.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{chapter.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {chapter.project.title} • Chapter {chapter.order_index} • {chapter.word_count} words
                      </CardDescription>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {chapter.content_preview}
                      </p>
                    </div>
                    <div className="ml-4">
                      {getStatusBadge(chapter.audio?.status || 'pending', chapter.id)}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  {chapter.audio?.status === 'completed' ? (
                    <div className="space-y-4">
                      {/* Audio Info */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Duration: {formatDuration(chapter.audio.duration || 0)}</span>
                        <span>Size: {formatFileSize(chapter.audio.file_size || 0)}</span>
                        <span>Voice: {chapter.audio.voice_model}</span>
                      </div>
                      
                      {/* Audio Player */}
                      <div className="bg-muted/30 rounded-lg p-4">
                        <audio 
                          controls 
                          className="w-full"
                          preload="metadata"
                        >
                          <source src={`/api/audio/stream/${chapter.audio.id}`} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReadAlongModal({ isOpen: true, chapter })}
                          className="gap-2 flex-1 md:flex-[2] min-w-0 relative z-10 hover:z-20"
                        >
                          <Book className="h-4 w-4" />
                          Read Along
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAudio(chapter)}
                          className="gap-2 flex-1 md:flex-1 min-w-0 relative z-10 hover:z-20"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateAudio(chapter.id, chapter.title, true)}
                          disabled={generatingAudio.has(chapter.id) || validatingKey.has(chapter.id)}
                          className="gap-2 w-full md:flex-1 md:w-auto min-w-0 relative z-10 hover:z-20"
                        >
                          {validatingKey.has(chapter.id) ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Validating...
                            </>
                          ) : generatingAudio.has(chapter.id) ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Regenerating...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              Regenerate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : chapter.audio?.status === 'error' ? (
                    <div className="space-y-4">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <p className="text-sm text-red-400">
                          {chapter.audio.error_message || 'Audio generation failed'}
                        </p>
                      </div>
                      <Button
                        onClick={() => generateAudio(chapter.id, chapter.title, true)}
                        disabled={generatingAudio.has(chapter.id) || validatingKey.has(chapter.id)}
                        className="gap-2"
                      >
                        {validatingKey.has(chapter.id) ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Validating...
                          </>
                        ) : generatingAudio.has(chapter.id) ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Trying Again...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Try Again
                          </>
                        )}
                      </Button>
                    </div>
                  ) : chapter.audio?.status === 'processing' || generatingAudio.has(chapter.id) ? (
                    <div className="space-y-4">
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          <span className="text-sm text-blue-400">
                            {generationProgress.get(chapter.id)?.message || 'Generating audio...'}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${generationProgress.get(chapter.id)?.progress || 0}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {generationProgress.get(chapter.id)?.progress ? 
                            `${generationProgress.get(chapter.id)?.progress}% complete` :
                            'This may take a few minutes depending on chapter length'
                          }
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Generate high-quality audio narration for this chapter using AI text-to-speech.
                      </p>
                                              <Button
                          onClick={() => generateAudio(chapter.id, chapter.title)}
                          disabled={generatingAudio.has(chapter.id) || validatingKey.has(chapter.id)}
                          className="gap-2"
                        >
                          {validatingKey.has(chapter.id) ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Validating...
                            </>
                          ) : generatingAudio.has(chapter.id) ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Headphones className="h-4 w-4" />
                              Generate Audio
                            </>
                          )}
                        </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Read Along Modal */}
      {readAlongModal.chapter && (
        <ReadAlongModal
          isOpen={readAlongModal.isOpen}
          onClose={() => setReadAlongModal({ isOpen: false, chapter: null })}
          chapter={readAlongModal.chapter}
        />
      )}
    </div>
  )
}

