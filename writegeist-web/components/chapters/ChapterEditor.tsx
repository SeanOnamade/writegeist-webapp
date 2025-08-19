'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Chapter } from '@/types/database'
import { chaptersAPI } from '@/lib/api/chapters'

interface ChapterEditorProps {
  chapter: Chapter
  onSave: (chapter: Chapter) => void
  onCancel?: () => void
  autoSave?: boolean
  autoSaveInterval?: number
}

export function ChapterEditor({ 
  chapter, 
  onSave, 
  onCancel, 
  autoSave = true, 
  autoSaveInterval = 30000 
}: ChapterEditorProps) {
  const [title, setTitle] = useState(chapter.title)
  const [content, setContent] = useState(chapter.content)
  const [status, setStatus] = useState(chapter.status)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(
    chapter.updated_at ? new Date(chapter.updated_at) : null
  )
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [wordCount, setWordCount] = useState(0)

  // Calculate word count
  useEffect(() => {
    const words = content.trim().split(/\s+/).filter(word => word.length > 0)
    setWordCount(words.length)
  }, [content])

  // Initialize lastSaved when chapter changes
  useEffect(() => {
    setLastSaved(chapter.updated_at ? new Date(chapter.updated_at) : null)
  }, [chapter.updated_at])

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = title !== chapter.title || 
                      content !== chapter.content || 
                      status !== chapter.status
    setHasUnsavedChanges(hasChanges)
  }, [title, content, status, chapter])

  // Auto-save functionality
  const performSave = useCallback(async (showLoading = true) => {
    if (!hasUnsavedChanges) return

    if (showLoading) setSaving(true)
    
    try {
      const updatedChapter = await chaptersAPI.save({
        ...chapter,
        title: title.trim(),
        content,
        status
      })

      if (updatedChapter) {
        onSave(updatedChapter)
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error('Error saving chapter:', error)
    } finally {
      if (showLoading) setSaving(false)
    }
  }, [chapter, title, content, status, hasUnsavedChanges, onSave])

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !hasUnsavedChanges) return

    const timer = setTimeout(() => {
      performSave(false)
    }, autoSaveInterval)

    return () => clearTimeout(timer)
  }, [autoSave, autoSaveInterval, hasUnsavedChanges, performSave])

  // Keyboard shortcuts - using useRef to avoid dependency issues
  const performSaveRef = useRef(performSave)
  
  useEffect(() => {
    performSaveRef.current = performSave
  }, [performSave])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        e.stopPropagation()
        console.log('Ctrl+S detected - saving chapter...')
        performSaveRef.current(true)
      }
    }

    // Add to both document and window to ensure it's caught
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, []) // Empty deps - uses ref to avoid re-binding

  const handleManualSave = () => {
    performSave(true)
  }

  const handleCancel = () => {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return
    }
    onCancel?.()
  }

  const formatLastSaved = () => {
    if (!lastSaved) return 'Never'
    
    const now = new Date()
    const diff = now.getTime() - lastSaved.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
    return lastSaved.toLocaleDateString()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center space-x-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chapter title"
            className="font-semibold text-lg border-none shadow-none p-0 h-auto"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Chapter['status'])}
            className="px-3 py-1 text-sm border border-input rounded-md bg-background"
          >
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="published">Published</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            {wordCount.toLocaleString()} words
          </div>
          <div className="text-sm text-muted-foreground">
            {hasUnsavedChanges ? (
              <span className="text-orange-600">Unsaved changes</span>
            ) : (
              <span>Saved {formatLastSaved()}</span>
            )}
          </div>
          <div className="flex space-x-2">
            {onCancel && (
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            <Button 
              onClick={handleManualSave} 
              disabled={saving || !hasUnsavedChanges}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex">
        {/* Main Editor */}
        <div className="flex-1 flex flex-col">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing your chapter..."
            className="flex-1 p-6 border-none resize-none focus:outline-none bg-background text-foreground leading-relaxed"
            style={{ 
              fontSize: '16px',
              lineHeight: '1.6',
              fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
            }}
          />
        </div>

        {/* Writing Stats Sidebar */}
        <div className="w-64 border-l bg-muted/30 p-4">
          <h3 className="font-semibold mb-4">Writing Stats</h3>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Word Count</div>
              <div className="text-2xl font-bold">{wordCount.toLocaleString()}</div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Character Count</div>
              <div className="text-lg font-semibold">{content.length.toLocaleString()}</div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Paragraphs</div>
              <div className="text-lg font-semibold">
                {content.split('\n\n').filter(p => p.trim().length > 0).length}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Reading Time</div>
              <div className="text-lg font-semibold">
                {Math.ceil(wordCount / 200)} min
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="font-semibold mb-2">Chapter Status</h4>
            <div className="space-y-2">
              {(['draft', 'in_progress', 'completed', 'published'] as const).map(statusOption => (
                <label key={statusOption} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="status"
                    value={statusOption}
                    checked={status === statusOption}
                    onChange={(e) => setStatus(e.target.value as Chapter['status'])}
                    className="rounded"
                  />
                  <span className="text-sm capitalize">{statusOption.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h4 className="font-semibold mb-2">Quick Actions</h4>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                📊 Analyze Chapter
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                🎵 Generate Audio
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                💡 Get AI Suggestions
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/50 text-sm text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>Chapter {chapter.order_index}</span>
          <span>•</span>
          <span>{wordCount} words</span>
          <span>•</span>
          <span>{content.length} characters</span>
        </div>
        <div className="flex items-center space-x-4">
          {autoSave && (
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>Auto-save enabled</span>
            </span>
          )}
          <span>Ctrl+S to save</span>
        </div>
      </div>
    </div>
  )
}

