'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Idea } from '@/types/database'
import { ideasAPI } from '@/lib/api/ideas'

interface IdeaCardProps {
  idea: Idea
  onUpdate: (idea: Idea) => void
  onDelete: (ideaId: string) => void
  onView?: (idea: Idea) => void
}

export function IdeaCard({ idea, onUpdate, onDelete, onView }: IdeaCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(idea.title)
  const [content, setContent] = useState(idea.content)
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return

    setSaving(true)
    try {
      const updatedIdea = await ideasAPI.update(idea.id, {
        title: title.trim(),
        content: content.trim() || '--'
      })

      if (updatedIdea) {
        onUpdate(updatedIdea)
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error updating idea:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this idea? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const success = await ideasAPI.delete(idea.id)
      if (success) {
        onDelete(idea.id)
      }
    } catch (error) {
      console.error('Error deleting idea:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleCancel = () => {
    setTitle(idea.title)
    setContent(idea.content)
    setIsEditing(false)
  }

  const handleStatusChange = async (newStatus: Idea['status']) => {
    try {
      const updatedIdea = await ideasAPI.updateStatus(idea.id, newStatus)
      if (updatedIdea) {
        onUpdate(updatedIdea)
      }
    } catch (error) {
      console.error('Error updating idea status:', error)
    }
  }

  const handleQuickStatusUpdate = async (newStatus: Idea['status']) => {
    setUpdatingStatus(true)
    try {
      const updatedIdea = await ideasAPI.updateStatus(idea.id, newStatus)
      if (updatedIdea) {
        onUpdate(updatedIdea)
      }
    } catch (error) {
      console.error('Error updating idea status:', error)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleAddTag = async () => {
    if (!newTag.trim() || idea.tags.includes(newTag.trim())) {
      setNewTag('')
      return
    }

    try {
      const updatedIdea = await ideasAPI.addTags(idea.id, [newTag.trim()])
      if (updatedIdea) {
        onUpdate(updatedIdea)
        setNewTag('')
      }
    } catch (error) {
      console.error('Error adding tag:', error)
    }
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    try {
      const updatedIdea = await ideasAPI.removeTags(idea.id, [tagToRemove])
      if (updatedIdea) {
        onUpdate(updatedIdea)
      }
    } catch (error) {
      console.error('Error removing tag:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'used': return 'bg-green-100 text-green-800 border-green-200'
      case 'archived': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      {isEditing ? (
        <div className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Idea title"
            className="font-semibold"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your idea..."
            className="w-full p-3 border border-input rounded-md bg-background resize-none"
            rows={4}
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
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 
                className="font-semibold text-lg mb-2 cursor-pointer hover:text-primary transition-colors line-clamp-2"
                onClick={() => onView?.(idea)}
                title={idea.title}
              >
                {idea.title}
              </h3>
              {idea.content && idea.content !== '--' && (
                <p className="text-muted-foreground text-sm line-clamp-3 mb-3">
                  {idea.content}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <select
                value={idea.status}
                onChange={(e) => handleStatusChange(e.target.value as Idea['status'])}
                className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(idea.status)}`}
              >
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="used">Used</option>
                <option value="archived">Archived</option>
              </select>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-8 w-8 p-0"
                >
                  ✏️
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  {deleting ? '⏳' : '🗑️'}
                </Button>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {idea.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 text-xs bg-muted rounded-full"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="text-xs h-7"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTag()
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="h-7 px-2 text-xs"
              >
                Add
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickStatusUpdate('used')}
                disabled={idea.status === 'used' || updatingStatus}
                className="text-xs h-7 px-2 flex-1 sm:flex-initial"
              >
                {updatingStatus ? '...' : 'Mark as Used'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickStatusUpdate('archived')}
                disabled={idea.status === 'archived' || updatingStatus}
                className="text-xs h-7 px-2 flex-1 sm:flex-initial"
              >
                {updatingStatus ? '...' : 'Archive'}
              </Button>
              {onView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(idea)}
                  className="text-xs h-7 px-2 flex-1 sm:flex-initial"
                >
                  View Details
                </Button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
            <div className="flex items-center space-x-3">
              <span>Created {formatDate(idea.created_at)}</span>
              {idea.updated_at !== idea.created_at && (
                <span>Updated {formatDate(idea.updated_at)}</span>
              )}
            </div>
            {idea.project_id && (
              <span className="text-primary">Linked to project</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

