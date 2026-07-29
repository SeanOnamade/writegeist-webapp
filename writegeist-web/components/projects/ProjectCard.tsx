'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { BookOpen, Pencil, Trash2, Loader2 } from 'lucide-react'
import type { Project } from '@/types/database'
import { projectsAPI } from '@/lib/api/projects'

interface ProjectCardProps {
  project: Project
  onUpdate: (project: Project) => void
  onDelete: (projectId: string) => void
}

export function ProjectCard({ project, onUpdate, onDelete }: ProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.description || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return

    setSaving(true)
    try {
      const updatedProject = await projectsAPI.save({
        ...project,
        title: title.trim(),
        description: description.trim() || null
      })

      if (updatedProject) {
        onUpdate(updatedProject)
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error updating project:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const success = await projectsAPI.delete(project.id)
      if (success) {
        onDelete(project.id)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleCancel = () => {
    setTitle(project.title)
    setDescription(project.description || '')
    setIsEditing(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="bg-card border rounded-lg p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/40">
      {isEditing ? (
        <div className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className="font-semibold text-lg"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Project description (optional)"
            className="resize-none"
            rows={3}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <Link href={`/project/${project.id}`}>
                <h3 className="text-lg font-semibold hover:text-primary cursor-pointer truncate">
                  {project.title}
                </h3>
              </Link>
              {project.description && (
                <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
              <StatusBadge status={project.status} />
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit project</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleting}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span className="sr-only">Delete project</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground gap-2 sm:gap-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>{project.chapter_count} chapters</span>
              <span>{(project.word_count || 0).toLocaleString()} words</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm">
              <span>Created {formatDate(project.created_at)}</span>
              {project.updated_at !== project.created_at && (
                <span>Updated {formatDate(project.updated_at)}</span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-end gap-2">
              {project.chapter_count > 0 ? (
                <Link href={`/project/${project.id}/read`}>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Read Book
                  </Button>
                </Link>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled 
                  className="flex items-center gap-2 opacity-50 cursor-not-allowed"
                  title="Add chapters to enable reading"
                >
                  <BookOpen className="h-4 w-4" />
                  Read Book
                </Button>
              )}
              <Link href={`/project/${project.id}`}>
                <Button size="sm">
                  Open Project
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete "${project.title}"?`}
        description="All chapters in this project will also be deleted. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
