'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { ChapterList } from '@/components/chapters/ChapterList'
import type { Chapter, Project } from '@/types/database'
import { chaptersAPI } from '@/lib/api/chapters'
import { projectsAPI } from '@/lib/api/projects'

function ChaptersContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projectId) {
      loadProjectAndChapters()
    } else {
      setLoading(false)
    }
  }, [projectId])

  // Refresh data when page becomes visible (e.g., returning from chapter editor)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && projectId) {
        console.log('Page visible - refreshing chapter data')
        loadProjectAndChapters()
      }
    }

    const handleFocus = () => {
      if (projectId) {
        console.log('Page focused - refreshing chapter data')
        loadProjectAndChapters()
      }
    }

    // Also refresh when navigating back to this route
    const handleRouteChange = () => {
      if (projectId) {
        console.log('Route changed - refreshing chapter data')
        setTimeout(() => loadProjectAndChapters(), 100) // Small delay to ensure page is ready
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('popstate', handleRouteChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [projectId])

  // Also add a manual refresh button as backup
  const handleRefresh = () => {
    console.log('Manual refresh triggered')
    loadProjectAndChapters()
  }

  const loadProjectAndChapters = async () => {
    if (!projectId) return

    try {
      const [projectData, chapterList] = await Promise.all([
        projectsAPI.getById(projectId),
        chaptersAPI.getAll(projectId)
      ])

      setProject(projectData)
      setChapters(chapterList)
    } catch (error) {
      console.error('Error loading project and chapters:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChapterUpdate = (updatedChapter: Chapter) => {
    setChapters(prev => prev.map(c => c.id === updatedChapter.id ? updatedChapter : c))
  }

  const handleChapterDelete = (chapterId: string) => {
    setChapters(prev => prev.filter(c => c.id !== chapterId))
  }

  const handleChapterCreate = (newChapter: Chapter) => {
    setChapters(prev => [...prev, newChapter])
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="h-4 bg-muted rounded w-64 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border rounded-lg p-4">
                <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-2xl font-bold mb-4">Select a Project</h1>
          <p className="text-muted-foreground mb-6">
            Choose a project to view and manage its chapters
          </p>
          <Link href="/project">
            <Button>View Projects</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Project not found</h1>
          <p className="text-muted-foreground mb-6">
            The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Link href="/project">
            <Button>Back to Projects</Button>
          </Link>
        </div>
      </div>
    )
  }

  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.word_count, 0)
  const completedChapters = chapters.filter(c => c.status === 'completed').length

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <Link href="/project" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/project/${project.id}`} className="hover:text-foreground">{project.title}</Link>
          <span>/</span>
          <span className="text-foreground">Chapters</span>
        </nav>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Chapters</h1>
            <p className="text-muted-foreground">
              Manage chapters for &quot;{project.title}&quot;
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Link href={`/project/${project.id}`} className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">Back to Project</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{chapters.length}</div>
          <div className="text-sm text-muted-foreground">Total Chapters</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{totalWords.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Total Words</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{completedChapters}</div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">
            {chapters.length > 0 ? Math.round(totalWords / chapters.length).toLocaleString() : 0}
          </div>
          <div className="text-sm text-muted-foreground">Avg Words/Chapter</div>
        </div>
      </div>

      {/* Chapter List */}
      <ChapterList
        chapters={chapters}
        projectId={project.id}
        onChapterUpdate={handleChapterUpdate}
        onChapterDelete={handleChapterDelete}
        onChapterCreate={handleChapterCreate}
        navigateToEditor={true}
      />
    </div>
  )
}

export default function ChaptersPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="h-4 bg-muted rounded w-64 mb-8"></div>
        </div>
      </div>
    }>
      <ChaptersContent />
    </Suspense>
  )
}