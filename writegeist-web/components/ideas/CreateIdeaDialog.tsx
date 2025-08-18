'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Idea, Project } from '@/types/database'
import { ideasAPI } from '@/lib/api/ideas'

interface CreateIdeaDialogProps {
  isOpen: boolean
  onClose: () => void
  onIdeaCreated: (idea: Idea) => void
  projects: Project[]
}

export function CreateIdeaDialog({ isOpen, onClose, onIdeaCreated, projects }: CreateIdeaDialogProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [projectId, setProjectId] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setCreating(true)
    try {
      const idea = await ideasAPI.create({
        title: title.trim(),
        content: content.trim(),
        project_id: projectId || null,
        status: 'new',
        tags,
        metadata: {}
      })

      if (idea) {
        onIdeaCreated(idea)
        handleClose()
      }
    } catch (error) {
      console.error('Error creating idea:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setTitle('')
    setContent('')
    setProjectId('')
    setTags([])
    setNewTag('')
    onClose()
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Capture New Idea</h2>
          <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Idea Title *
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your idea about?"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium mb-2">
              Description *
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your idea in detail..."
              className="w-full p-3 border border-input rounded-md bg-background resize-none"
              rows={4}
              required
            />
          </div>

          <div>
            <label htmlFor="project" className="block text-sm font-medium mb-2">
              Link to Project (Optional)
            </label>
            <select
              id="project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full p-2 border border-input rounded-md bg-background"
            >
              <option value="">No project (general idea)</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Tags
            </label>
            <div className="space-y-2">
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 text-sm bg-muted rounded-full"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !title.trim() || !content.trim()}>
              {creating ? 'Creating...' : 'Create Idea'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

