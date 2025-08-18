'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChapterEditor } from '@/components/chapters/ChapterEditor'
import type { Chapter, Project } from '@/types/database'
import { chaptersAPI } from '@/lib/api/chapters'
import { projectsAPI } from '@/lib/api/projects'

export default function ChapterEditPage() {
  const params = useParams()
  const router = useRouter()
  const chapterId = params.id as string

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (chapterId) {
      loadChapter()
    }
  }, [chapterId])

  const loadChapter = async () => {
    try {
      const chapterData = await chaptersAPI.getById(chapterId)
      if (chapterData) {
        setChapter(chapterData)
        
        // Load project data
        const projectData = await projectsAPI.getById(chapterData.project_id)
        setProject(projectData)
      } else {
        router.push('/chapters')
      }
    } catch (error) {
      console.error('Error loading chapter:', error)
      router.push('/chapters')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = (updatedChapter: Chapter) => {
    setChapter(updatedChapter)
  }

  const handleCancel = () => {
    if (project) {
      router.push(`/chapters?project=${project.id}`)
    } else {
      router.push('/chapters')
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 bg-muted rounded w-48 mb-4 mx-auto"></div>
          <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!chapter || !project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Chapter not found</h1>
          <p className="text-muted-foreground mb-4">
            The chapter you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Link href="/chapters">
            <Button>Back to Chapters</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/project" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/project/${project.id}`} className="hover:text-foreground">{project.title}</Link>
          <span>/</span>
          <Link href={`/chapters?project=${project.id}`} className="hover:text-foreground">Chapters</Link>
          <span>/</span>
          <span className="text-foreground">{chapter.title}</span>
        </nav>
        
        <div className="flex items-center space-x-2">
          <Link href={`/chapters?project=${project.id}`}>
            <Button variant="outline" size="sm">
              Back to Chapters
            </Button>
          </Link>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <ChapterEditor
          chapter={chapter}
          onSave={handleSave}
          onCancel={handleCancel}
          autoSave={true}
          autoSaveInterval={30000}
        />
      </div>
    </div>
  )
}

