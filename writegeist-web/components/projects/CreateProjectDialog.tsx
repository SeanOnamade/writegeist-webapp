'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Project } from '@/types/database'
import { projectsAPI } from '@/lib/api/projects'

interface CreateProjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated: (project: Project) => void
}

export function CreateProjectDialog({ isOpen, onClose, onProjectCreated }: CreateProjectDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft')
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setCreating(true)
    try {
      const project = await projectsAPI.create(title.trim(), description.trim() || undefined)
      if (project) {
        onProjectCreated(project)
        handleClose()
      }
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setTitle('')
    setDescription('')
    setStatus('draft')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create New Project</h2>
          <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Project Title *
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter project title"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your project (optional)"
              className="w-full p-2 border border-input rounded-md bg-background resize-none"
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-2">
              Initial Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full p-2 border border-input rounded-md bg-background"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !title.trim()}>
              {creating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

