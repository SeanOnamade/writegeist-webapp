'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Project, Chapter } from '@/types/database'
import { projectsAPI } from '@/lib/api/projects'
import { chaptersAPI } from '@/lib/api/chapters'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (projectId) {
      loadProject()
      loadChapters()
    }
  }, [projectId])

  const loadProject = async () => {
    try {
      const projectData = await projectsAPI.getById(projectId)
      if (projectData) {
        setProject(projectData)
        setTitle(projectData.title)
        setDescription(projectData.description || '')
      } else {
        router.push('/project')
      }
    } catch (error) {
      console.error('Error loading project:', error)
      router.push('/project')
    }
  }

  const loadChapters = async () => {
    try {
      const chapterList = await chaptersAPI.getAll(projectId)
      setChapters(chapterList)
    } catch (error) {
      console.error('Error loading chapters:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!project || !title.trim()) return

    try {
      const updatedProject = await projectsAPI.save({
        ...project,
        title: title.trim(),
        description: description.trim() || null
      })

      if (updatedProject) {
        setProject(updatedProject)
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error updating project:', error)
    }
  }

  const handleCancel = () => {
    if (project) {
      setTitle(project.title)
      setDescription(project.description || '')
    }
    setIsEditing(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'archived': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'draft': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-4"></div>
          <div className="h-4 bg-muted rounded w-96 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border rounded-lg p-4">
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Project not found</h1>
          <p className="text-muted-foreground mb-4">
            The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Link href="/project">
            <Button>Back to Projects</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link href="/project" className="hover:text-foreground">Projects</Link>
        <span>/</span>
        <span className="text-foreground">{project.title}</span>
      </nav>

      {/* Project Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-4 max-w-2xl">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold"
                placeholder="Project title"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Project description"
                className="w-full p-3 border border-input rounded-md bg-background resize-none"
                rows={3}
              />
              <div className="flex space-x-2">
                <Button onClick={handleSave} disabled={!title.trim()}>
                  Save Changes
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <h1 className="text-3xl font-bold">{project.title}</h1>
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>
              {project.description && (
                <p className="text-muted-foreground text-lg mb-4">{project.description}</p>
              )}
              <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                <span>Created {formatDate(project.created_at)}</span>
                <span>Last updated {formatDate(project.updated_at)}</span>
              </div>
            </div>
          )}
        </div>
        
        {!isEditing && (
          <div className="flex space-x-2 ml-4">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit Project
            </Button>
            <Link href={`/chapters?project=${project.id}`}>
              <Button>Manage Chapters</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Project Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{project.chapter_count}</div>
          <div className="text-sm text-muted-foreground">Chapters</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{(project.word_count || 0).toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Words</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">
            {project.word_count > 0 ? Math.round(project.word_count / Math.max(project.chapter_count, 1)).toLocaleString() : 0}
          </div>
          <div className="text-sm text-muted-foreground">Avg Words/Chapter</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">
            {project.word_count >= 50000 ? '100%' : Math.round((project.word_count / 50000) * 100) + '%'}
          </div>
          <div className="text-sm text-muted-foreground">Novel Progress</div>
        </div>
      </div>

      {/* Recent Chapters */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Chapters</h2>
          <Link href={`/chapters?project=${project.id}`}>
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>
        
        {chapters.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-lg font-medium mb-2">No chapters yet</h3>
            <p className="text-muted-foreground mb-4">
              Start writing by creating your first chapter
            </p>
            <Link href={`/chapters?project=${project.id}`}>
              <Button>Create First Chapter</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {chapters
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
              .slice(0, 5).map(chapter => (
              <div key={chapter.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div>
                  <h3 className="font-medium">{chapter.title}</h3>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>{(chapter.word_count || 0).toLocaleString()} words</span>
                    <span>Chapter {chapter.order_index}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      chapter.status === 'completed' ? 'bg-green-100 text-green-800' :
                      chapter.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {chapter.status}
                    </span>
                  </div>
                </div>
                <Link href={`/chapters/${chapter.id}`}>
                  <Button variant="ghost" size="sm">Edit</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
