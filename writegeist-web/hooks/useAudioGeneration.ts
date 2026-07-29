'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { parseSSEStream } from '@/lib/sse'
import { formatFileSize } from '@/lib/audio/format'
import type { AudioLibraryChapter } from '@/lib/data/audioLibrary'

/**
 * Client state machine for TTS generation: API key validation (cached),
 * SSE progress tracking, deletion, and download.
 */
export function useAudioGeneration(onLibraryChanged: () => Promise<void> | void) {
  const { toast } = useToast()
  const [generatingAudio, setGeneratingAudio] = useState<Set<string>>(new Set())
  const [validatingKey, setValidatingKey] = useState<Set<string>>(new Set())
  const [deletingAudio, setDeletingAudio] = useState<Set<string>>(new Set())
  const [generationProgress, setGenerationProgress] = useState<
    Map<string, { progress: number; message: string }>
  >(new Map())
  const [apiKeyValidated, setApiKeyValidated] = useState<boolean | null>(null)

  const addTo = (setter: typeof setGeneratingAudio, id: string) =>
    setter((prev) => new Set(prev).add(id))
  const removeFrom = (setter: typeof setGeneratingAudio, id: string) =>
    setter((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  const validateAPIKey = async (chapterId: string): Promise<boolean> => {
    try {
      if (apiKeyValidated === true) return true

      addTo(setValidatingKey, chapterId)

      const response = await fetch('/api/audio/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const result = await response.json()

      if (!result.valid) {
        toast({
          title: 'OpenAI API Key Issue',
          description: result.error || 'Please check your OpenAI API key configuration.',
          variant: 'destructive',
        })
        return false
      }

      // Cache successful validation for 5 minutes.
      setApiKeyValidated(true)
      setTimeout(() => setApiKeyValidated(null), 5 * 60 * 1000)
      return true
    } catch (error) {
      console.error('API key validation error:', error)
      toast({
        title: 'Cannot Validate API Key',
        description: 'Unable to verify your OpenAI API key. Generation may fail.',
        variant: 'destructive',
      })
      return false
    } finally {
      removeFrom(setValidatingKey, chapterId)
    }
  }

  const generateAudio = async (chapterId: string, chapterTitle: string, force = false) => {
    try {
      const isValidKey = await validateAPIKey(chapterId)
      if (!isValidKey) return

      addTo(setGeneratingAudio, chapterId)
      setGenerationProgress((prev) =>
        new Map(prev).set(chapterId, { progress: 0, message: 'Preparing...' })
      )

      const response = await fetch('/api/audio/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, voice: 'alloy', model: 'tts-1-hd', force }),
      })

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Generation failed: ${response.status}`)
      }

      let completed = false
      let cached = false
      let streamError: string | null = null

      await parseSSEStream(response.body, (event, data) => {
        if (event === 'progress') {
          setGenerationProgress((prev) =>
            new Map(prev).set(chapterId, {
              progress: typeof data.progress === 'number' ? data.progress : 0,
              message: typeof data.message === 'string' ? data.message : 'Processing...',
            })
          )
        } else if (event === 'complete') {
          completed = true
          cached = data.cached === true
        } else if (event === 'error') {
          streamError = typeof data.error === 'string' ? data.error : 'Generation failed'
        }
      })

      if (streamError) throw new Error(streamError)

      if (completed) {
        toast({
          title: cached ? 'Audio Up to Date' : 'Audio Generated!',
          description: cached
            ? `"${chapterTitle}" hasn't changed — using the existing audio.`
            : `Audio for "${chapterTitle}" is ready to play.`,
        })
        await onLibraryChanged()
      }
    } catch (error) {
      console.error('Audio generation error:', error)
      toast({
        title: 'Generation Failed',
        description:
          error instanceof Error ? error.message : 'Failed to generate audio. Please try again.',
        variant: 'destructive',
      })
    } finally {
      removeFrom(setGeneratingAudio, chapterId)
      setGenerationProgress((prev) => {
        const next = new Map(prev)
        next.delete(chapterId)
        return next
      })
    }
  }

  const deleteAudio = async (chapter: AudioLibraryChapter) => {
    if (!chapter.audio) return

    try {
      addTo(setDeletingAudio, chapter.id)

      const response = await fetch(`/api/audio/${chapter.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Delete failed: ${response.status}`)
      }

      const data = await response.json()
      toast({
        title: 'Audio Deleted',
        description: `Audio for "${chapter.title}" has been deleted.${
          data.deleted_file_size ? ` Freed ${formatFileSize(data.deleted_file_size)} of space.` : ''
        }`,
      })

      await onLibraryChanged()
    } catch (error) {
      console.error('Delete failed:', error)
      toast({
        title: 'Delete Failed',
        description:
          error instanceof Error ? error.message : 'Failed to delete audio file. Please try again.',
        variant: 'destructive',
      })
    } finally {
      removeFrom(setDeletingAudio, chapter.id)
    }
  }

  const downloadAudio = async (chapter: AudioLibraryChapter) => {
    if (!chapter.audio?.id) {
      toast({
        title: 'Download Failed',
        description: 'No audio file found for this chapter.',
        variant: 'destructive',
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

      const sanitizedTitle =
        chapter.title
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
        title: 'Download Started',
        description: `Downloading audio for "${chapter.title}"...`,
      })
    } catch (error) {
      console.error('Download failed:', error)
      toast({
        title: 'Download Failed',
        description: 'Failed to download audio file. Please try again.',
        variant: 'destructive',
      })
    }
  }

  return {
    generatingAudio,
    validatingKey,
    deletingAudio,
    generationProgress,
    generateAudio,
    deleteAudio,
    downloadAudio,
  }
}
