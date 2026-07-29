'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, Edit, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatsGrid } from '@/components/ui/stats'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { Project, Chapter } from '@/types/database'
import { projectsAPI } from '@/lib/api/projects'

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function ProjectDetailClient({
  initialProject,
  chapters,
}: {
  initialProject: Project
  chapters: Chapter[]
}) {
  const router = useRouter()
  const [project, setProject] = useState(initialProject)
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(initialProject.title)
  const [description, setDescription] = useState(initialProject.description || '')

  const handleSave = async () => {
    if (!title.trim()) return

    try {
      const updatedProject = await projectsAPI.save({
        ...project,
        title: title.trim(),
        description: description.trim() || null,
      })

      if (updatedProject) {
        setProject(updatedProject)
        setIsEditing(false)
        router.refresh()
      }
    } catch (error) {
      console.error('Error updating project:', error)
    }
  }

  const handleCancel = () => {
    setTitle(project.title)
    setDescription(project.description || '')
    setIsEditing(false)
  }

  const recentChapters = [...chapters]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link href="/project" className="hover:text-foreground">
          Projects
        </Link>
        <span>/</span>
        <span className="text-foreground">{project.title}</span>
      </nav>

      <div className="mb-8">
        {isEditing ? (
          <div className="space-y-4 max-w-2xl">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold"
              placeholder="Project title"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project description"
              rows={3}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleSave} disabled={!title.trim()}>
                Save Changes
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                  <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
                  <StatusBadge status={project.status} />
                </div>
                {project.description && (
                  <p className="text-muted-foreground text-base sm:text-lg mb-4">
                    {project.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Project
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild={project.chapter_count > 0}
                  disabled={project.chapter_count === 0}
                  title={project.chapter_count === 0 ? 'Add chapters to enable reading' : undefined}
                >
                  {project.chapter_count > 0 ? (
                    <Link href={`/project/${project.id}/read`}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Read Book
                    </Link>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Read Book
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/chapters?project=${project.id}`}>Manage Chapters</Link>
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm text-muted-foreground">
              <span>Created {formatDate(project.created_at)}</span>
              <span>Updated {formatDate(project.updated_at)}</span>
            </div>
          </>
        )}
      </div>

      <StatsGrid
        className="grid-cols-2 md:grid-cols-4 mb-6"
        stats={[
          { label: 'Chapters', value: project.chapter_count },
          { label: 'Words', value: (project.word_count || 0).toLocaleString() },
          {
            label: 'Avg Words/Chapter',
            value:
              project.word_count > 0
                ? Math.round(
                    project.word_count / Math.max(project.chapter_count, 1)
                  ).toLocaleString()
                : 0,
          },
          {
            label: 'Novel Progress',
            value:
              project.word_count >= 50000
                ? '100%'
                : Math.round((project.word_count / 50000) * 100) + '%',
          },
        ]}
      />

      <div className="bg-card border rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Chapters</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/chapters?project=${project.id}`}>View All</Link>
          </Button>
        </div>

        {chapters.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No chapters yet"
            description="Start writing by creating your first chapter"
            className="py-8"
            action={
              <Button asChild>
                <Link href={`/chapters?project=${project.id}`}>Create First Chapter</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {recentChapters.map((chapter) => (
              <div
                key={chapter.id}
                className="flex items-center justify-between p-3 border rounded-lg transition-colors hover:bg-muted/50 hover:border-primary/40"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{chapter.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{(chapter.word_count || 0).toLocaleString()} words</span>
                    <span>Chapter {chapter.order_index}</span>
                    <StatusBadge status={chapter.status} />
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="flex-shrink-0 ml-2">
                  <Link href={`/chapters/${chapter.id}`}>Edit</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
