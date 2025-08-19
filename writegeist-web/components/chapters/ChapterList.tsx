'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Chapter } from '@/types/database'
import { chaptersAPI } from '@/lib/api/chapters'

interface ChapterListProps {
  chapters: Chapter[]
  projectId: string
  onChapterUpdate: (chapter: Chapter) => void
  onChapterDelete: (chapterId: string) => void
  onChapterCreate: (chapter: Chapter) => void
}

export function ChapterList({ 
  chapters, 
  projectId, 
  onChapterUpdate, 
  onChapterDelete, 
  onChapterCreate 
}: ChapterListProps) {
  const [creating, setCreating] = useState(false)
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [draggedChapter, setDraggedChapter] = useState<string | null>(null)

  const handleCreateChapter = async () => {
    if (!newChapterTitle.trim()) return

    setCreating(true)
    try {
      const newChapter = await chaptersAPI.save({
        project_id: projectId,
        title: newChapterTitle.trim(),
        content: '',
        status: 'draft',
        order_index: chapters.length + 1,
        metadata: {}
      })

      if (newChapter) {
        onChapterCreate(newChapter)
        setNewChapterTitle('')
      }
    } catch (error) {
      console.error('Error creating chapter:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteChapter = async (chapter: Chapter) => {
    if (!confirm(`Are you sure you want to delete "${chapter.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      const success = await chaptersAPI.delete(chapter.id)
      if (success) {
        onChapterDelete(chapter.id)
      }
    } catch (error) {
      console.error('Error deleting chapter:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, chapterId: string) => {
    setDraggedChapter(chapterId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetChapter: Chapter) => {
    e.preventDefault()
    
    if (!draggedChapter || draggedChapter === targetChapter.id) {
      setDraggedChapter(null)
      return
    }

    const draggedIndex = chapters.findIndex(c => c.id === draggedChapter)
    const targetIndex = chapters.findIndex(c => c.id === targetChapter.id)
    
    if (draggedIndex === -1 || targetIndex === -1) return

    // Create new order
    const reorderedChapters = [...chapters]
    const [draggedItem] = reorderedChapters.splice(draggedIndex, 1)
    reorderedChapters.splice(targetIndex, 0, draggedItem)

    // Update order indices
    const chapterIds = reorderedChapters.map(c => c.id)
    
    try {
      const success = await chaptersAPI.reorder(projectId, chapterIds)
      if (success) {
        // Update local state with new order
        reorderedChapters.forEach((chapter, index) => {
          onChapterUpdate({ ...chapter, order_index: index + 1 })
        })
      }
    } catch (error) {
      console.error('Error reordering chapters:', error)
    }

    setDraggedChapter(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'published': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-4">
      {/* Create New Chapter */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            placeholder="New chapter title..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateChapter()
              }
            }}
          />
          <Button 
            onClick={handleCreateChapter}
            disabled={creating || !newChapterTitle.trim()}
            className="w-full sm:w-auto"
          >
            {creating ? 'Creating...' : 'Add Chapter'}
          </Button>
        </div>
      </div>

      {/* Chapter List */}
      {chapters.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-medium mb-2">No chapters yet</h3>
          <p className="text-muted-foreground">
            Create your first chapter to start writing
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {chapters
            .sort((a, b) => a.order_index - b.order_index)
            .map((chapter) => (
              <div
                key={chapter.id}
                draggable
                onDragStart={(e) => handleDragStart(e, chapter.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, chapter)}
                className={`bg-card border rounded-lg p-4 hover:shadow-md transition-all cursor-move ${
                  draggedChapter === chapter.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                    <div className="text-sm text-muted-foreground font-mono flex-shrink-0">
                      {(chapter.order_index || 0).toString().padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                        <h3 className="font-semibold truncate">{chapter.title}</h3>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full border ${getStatusColor(chapter.status)} flex-shrink-0`}>
                          {chapter.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-sm text-muted-foreground">
                        <span className="flex-shrink-0">{(chapter.word_count || 0).toLocaleString()} words</span>
                        <span className="flex-shrink-0">Updated {formatDate(chapter.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-2 sm:flex-shrink-0">
                    <Link href={`/chapters/${chapter.id}`} className="flex-1 sm:flex-initial">
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteChapter(chapter)}
                      className="text-destructive hover:text-destructive flex-1 sm:flex-initial"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {chapters.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Drag and drop chapters to reorder them
        </div>
      )}
    </div>
  )
}
