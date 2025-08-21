'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Idea } from '@/types/database'
import { ideasAPI } from '@/lib/api/ideas'

interface IdeaDetailModalProps {
  idea: Idea | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedIdea: Idea) => void
}

export function IdeaDetailModal({ idea, isOpen, onClose, onUpdate }: IdeaDetailModalProps) {
  const [updating, setUpdating] = useState(false)

  const handleStatusUpdate = async (newStatus: 'new' | 'in_progress' | 'used' | 'archived') => {
    if (!idea) return

    setUpdating(true)
    try {
      const updatedIdea = await ideasAPI.updateStatus(idea.id, newStatus)
      if (updatedIdea) {
        onUpdate(updatedIdea)
      }
    } catch (error) {
      console.error('Error updating idea status:', error)
    } finally {
      setUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'used': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (!isOpen || !idea) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-semibold mb-3 break-words leading-tight">
              {idea.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={getStatusColor(idea.status)}>
                {idea.status.replace('_', ' ')}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Updated {formatDate(idea.updated_at)}
              </span>
              {idea.created_at !== idea.updated_at && (
                <span className="text-sm text-muted-foreground">
                  • Created {formatDate(idea.created_at)}
                </span>
              )}
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-shrink-0">
            ✕
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="font-medium mb-3">Description</h3>
              {idea.content && idea.content !== '--' ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-lg p-4 border">
                  {idea.content}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic bg-muted/30 rounded-lg p-4 border">
                  No description provided
                </div>
              )}
            </div>

            {/* Tags */}
            {idea.tags.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {idea.tags.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Project Link */}
            {idea.project_id && (
              <div>
                <h3 className="font-medium mb-3">Linked Project</h3>
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 border">
                  📚 Linked to project
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <h4 className="font-medium mb-2 text-sm">Quick Actions</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate('used')}
                  disabled={idea.status === 'used' || updating}
                  className="flex-1 sm:flex-initial"
                >
                  {updating ? '...' : 'Mark as Used'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate('in_progress')}
                  disabled={idea.status === 'in_progress' || updating}
                  className="flex-1 sm:flex-initial"
                >
                  {updating ? '...' : 'In Progress'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate('archived')}
                  disabled={idea.status === 'archived' || updating}
                  className="flex-1 sm:flex-initial"
                >
                  {updating ? '...' : 'Archive'}
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2 sm:flex-col sm:justify-end">
              <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-initial">
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
