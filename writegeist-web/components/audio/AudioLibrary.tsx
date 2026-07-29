'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Headphones, RefreshCw, BookOpen, Search, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { StatsGrid } from '@/components/ui/stats'
import { useToast } from '@/hooks/use-toast'
import { useAudioGeneration } from '@/hooks/useAudioGeneration'
import { formatDuration, formatFileSize } from '@/lib/audio/format'
import { ReadAlongModal } from '@/components/audio/ReadAlongModal'
import { AudioChapterCard } from '@/components/audio/AudioChapterCard'
import type { AudioLibraryChapter, AudioLibraryStats } from '@/lib/data/audioLibrary'

export function AudioLibrary({
  initialChapters,
  initialStats,
  projects,
  selectedProjectId,
}: {
  initialChapters: AudioLibraryChapter[]
  initialStats: AudioLibraryStats
  projects: { id: string; title: string }[]
  selectedProjectId: string | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [chapters, setChapters] = useState(initialChapters)
  const [stats, setStats] = useState(initialStats)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [readAlongChapter, setReadAlongChapter] = useState<AudioLibraryChapter | null>(null)

  // Re-sync whenever the server page refetches (e.g. after switching project).
  useEffect(() => {
    setChapters(initialChapters)
    setStats(initialStats)
  }, [initialChapters, initialStats])

  const refreshLibrary = useCallback(async () => {
    try {
      setRefreshing(true)
      const params = selectedProjectId ? `?project=${selectedProjectId}` : ''
      const response = await fetch(`/api/audio/library${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load audio library: ${response.status}`)
      }
      const data = await response.json()
      setChapters(data.chapters)
      setStats(data.stats)
    } catch (error) {
      console.error('Failed to load audio library:', error)
      toast({
        title: 'Error',
        description: 'Failed to load audio library. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setRefreshing(false)
    }
  }, [toast, selectedProjectId])

  const {
    generatingAudio,
    validatingKey,
    deletingAudio,
    generationProgress,
    generateAudio,
    deleteAudio,
    downloadAudio,
  } = useAudioGeneration(refreshLibrary)

  const visibleChapters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return chapters
    return chapters.filter((chapter) => chapter.title.toLowerCase().includes(query))
  }, [chapters, searchQuery])

  const handleProjectChange = (projectId: string) => {
    setSearchQuery('')
    router.push(`/audio?project=${projectId}`)
  }

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Headphones className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Audio Library</h1>
              <p className="text-sm text-muted-foreground">
                Generate and manage audio narration, one project at a time
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshLibrary}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Create a project with chapters first, then come back to generate audio narration."
            action={
              <Button asChild className="gap-2">
                <Link href="/project">
                  <BookOpen className="h-4 w-4" />
                  Go to Projects
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Select
                value={selectedProjectId ?? ''}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="sm:w-64"
                aria-label="Project"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chapters by title..."
                  className="pl-9"
                  aria-label="Search chapters"
                />
              </div>
            </div>

            <StatsGrid
              className="grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-6"
              stats={[
                { label: 'Chapters', value: stats.total_chapters },
                { label: 'Audio Ready', value: stats.audio_generated },
                { label: 'Processing', value: stats.audio_processing },
                {
                  label: 'Total Duration',
                  value: stats.total_duration > 0 ? formatDuration(stats.total_duration) : '0:00',
                },
                {
                  label: 'Total Size',
                  value: stats.total_file_size > 0 ? formatFileSize(stats.total_file_size) : '0 MB',
                },
              ]}
            />

            {chapters.length === 0 ? (
              <EmptyState
                icon={Headphones}
                title="No chapters in this project"
                description="Add chapters to this project first, then generate audio narration for them."
                action={
                  <Button asChild className="gap-2">
                    <Link href="/chapters">
                      <BookOpen className="h-4 w-4" />
                      Go to Chapters
                    </Link>
                  </Button>
                }
              />
            ) : visibleChapters.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching chapters"
                description={`No chapter titles match "${searchQuery.trim()}".`}
                action={
                  <Button variant="outline" onClick={() => setSearchQuery('')}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {visibleChapters.map((chapter) => (
                  <AudioChapterCard
                    key={chapter.id}
                    chapter={chapter}
                    isGenerating={generatingAudio.has(chapter.id)}
                    isValidating={validatingKey.has(chapter.id)}
                    isDeleting={deletingAudio.has(chapter.id)}
                    progress={generationProgress.get(chapter.id)}
                    onGenerate={(force) => generateAudio(chapter.id, chapter.title, force)}
                    onDelete={() => deleteAudio(chapter)}
                    onDownload={() => downloadAudio(chapter)}
                    onReadAlong={() => setReadAlongChapter(chapter)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {readAlongChapter && (
        <ReadAlongModal
          isOpen={readAlongChapter !== null}
          onClose={() => setReadAlongChapter(null)}
          chapter={readAlongChapter}
        />
      )}
    </div>
  )
}
