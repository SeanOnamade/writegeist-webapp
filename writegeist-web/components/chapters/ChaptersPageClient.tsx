'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { StatsGrid } from '@/components/ui/stats'
import { ChapterList } from '@/components/chapters/ChapterList'
import type { Chapter, Project } from '@/types/database'

export function ChaptersPageClient({
  project,
  initialChapters,
}: {
  project: Project
  initialChapters: Chapter[]
}) {
  const router = useRouter()
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters)

  // Re-sync whenever the server page refetches (navigation or router.refresh()).
  useEffect(() => {
    setChapters(initialChapters)
  }, [initialChapters])

  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.word_count, 0)
  const completedChapters = chapters.filter((c) => c.status === 'completed').length

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <Link href="/project" className="hover:text-foreground">
            Projects
          </Link>
          <span>/</span>
          <Link href={`/project/${project.id}`} className="hover:text-foreground">
            {project.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">Chapters</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Chapters</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage chapters for &quot;{project.title}&quot;
            </p>
          </div>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href={`/project/${project.id}`}>Back to Project</Link>
          </Button>
        </div>
      </div>

      <StatsGrid
        className="grid-cols-2 md:grid-cols-4 mb-6"
        stats={[
          { label: 'Total Chapters', value: chapters.length },
          { label: 'Total Words', value: totalWords.toLocaleString() },
          { label: 'Completed', value: completedChapters },
          {
            label: 'Avg Words/Chapter',
            value:
              chapters.length > 0 ? Math.round(totalWords / chapters.length).toLocaleString() : 0,
          },
        ]}
      />

      <ChapterList
        chapters={chapters}
        projectId={project.id}
        onChapterUpdate={(updated) => {
          setChapters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
          router.refresh()
        }}
        onChapterDelete={(chapterId) => {
          setChapters((prev) => prev.filter((c) => c.id !== chapterId))
          router.refresh()
        }}
        onChapterCreate={(newChapter) => {
          setChapters((prev) => [...prev, newChapter])
          router.refresh()
        }}
        navigateToEditor={true}
      />
    </div>
  )
}
