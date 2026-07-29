'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { IdeasSearchModal } from '@/components/ideas/IdeasSearchModal'
import { ChapterMetaPanel } from './ChapterMetaPanel'
import { RichTextEditor } from './RichTextEditor'
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
  const router = useRouter()
  const [title, setTitle] = useState(chapter.title)
  const [content, setContent] = useState(chapter.content)
  const [status, setStatus] = useState(chapter.status)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(
    chapter.updated_at ? new Date(chapter.updated_at) : null
  )
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [editorError, setEditorError] = useState(false)

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

  // Auto-save functionality with enhanced error handling
  const performSave = useCallback(async (showLoading = true) => {
    if (!hasUnsavedChanges) return

    if (showLoading) setSaving(true)
    
    try {
      // Validate content before saving
      if (typeof content !== 'string') {
        throw new Error('Invalid content format')
      }

      // Debug: Saving chapter content

      const updatedChapter = await chaptersAPI.save({
        ...chapter,
        title: title.trim(),
        content,
        status
      })

      if (updatedChapter) {
        // Debug: Chapter saved successfully
        onSave(updatedChapter)
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
        setEditorError(false)
      }
    } catch (error) {
      console.error('Error saving chapter:', error)
      setEditorError(true)
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
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        e.stopPropagation()
        // Debug: Ctrl+S detected
        // Direct save call is more reliable than trying to find the button
        performSaveRef.current(true)
      }
    }

    // Use capture phase and high priority
    document.addEventListener('keydown', handleKeyDown, { capture: true, passive: false })
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, []) // Empty deps - uses ref to avoid re-binding

  const handleManualSave = () => {
    performSave(true)
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setConfirmCancelOpen(true)
      return
    }
    onCancel?.()
  }

  const handleSaveAndClose = async () => {
    await performSave(false)
    onCancel?.()
  }

  const handleGenerateAudio = () => {
    // Save any unsaved changes first, then navigate to audio page
    if (hasUnsavedChanges) {
      performSave(false).then(() => {
        router.push('/audio')
      })
    } else {
      router.push('/audio')
    }
  }

  const handleGetWritingHelp = () => {
    // Save any unsaved changes first, then navigate to AI chat
    if (hasUnsavedChanges) {
      performSave(false).then(() => {
        router.push('/chat')
      })
    } else {
      router.push('/chat')
    }
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

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [ideasModalOpen, setIdeasModalOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chapter title"
              className="font-semibold text-base sm:text-lg border-none shadow-none p-0 h-auto flex-1"
            />
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as Chapter['status'])}
              className="h-9 w-auto text-sm"
            >
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="published">Published</option>
            </Select>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="hidden sm:inline">{wordCount.toLocaleString()} words</span>
              <span className="sm:hidden">{wordCount} words</span>
              <span className="hidden sm:inline">
                {hasUnsavedChanges ? (
                  <span className="text-orange-600">Unsaved changes</span>
                ) : (
                  <span>Saved {formatLastSaved()}</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" 
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                Tools
              </Button>
              {onCancel && (
                <Button variant="outline" onClick={handleCancel} size="sm">
                  Cancel
                </Button>
              )}
              <Button 
                onClick={handleManualSave} 
                disabled={saving || !hasUnsavedChanges}
                size="sm"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile save status */}
        <div className="sm:hidden px-4 pb-2 text-xs text-muted-foreground">
          {hasUnsavedChanges ? (
            <span className="text-orange-600">• Unsaved changes</span>
          ) : (
            <span>• Saved {formatLastSaved()}</span>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex relative">
        {/* Main Editor */}
        <div className="flex-1 flex flex-col">
          {editorError && (
            <div className="mx-4 mt-2 p-2 bg-destructive/10 border border-destructive rounded text-sm text-destructive">
              Saving failed. Your changes are still in the editor — try saving again.
            </div>
          )}
          
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing your chapter..."
            disabled={saving}
          />
        </div>

        {/* Desktop meta sidebar */}
        <div className="hidden lg:flex lg:w-64 border-l bg-muted/30 p-4">
          <ChapterMetaPanel
            content={content}
            wordCount={wordCount}
            status={status}
            onStatusChange={setStatus}
            onBrowseIdeas={() => setIdeasModalOpen(true)}
            onGenerateAudio={handleGenerateAudio}
            onGetWritingHelp={handleGetWritingHelp}
            idPrefix="desktop"
          />
        </div>

        {/* Mobile meta overlay */}
        {sidebarOpen && (
          <div className="lg:hidden absolute inset-0 z-50 flex">
            <div className="flex-1 bg-black/20" onClick={() => setSidebarOpen(false)} />
            <div className="w-80 max-w-[90vw] border-l bg-background p-4 shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Writing Tools</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="p-0 h-9 w-9"
                  aria-label="Close writing tools"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ChapterMetaPanel
                content={content}
                wordCount={wordCount}
                status={status}
                onStatusChange={setStatus}
                onBrowseIdeas={() => setIdeasModalOpen(true)}
                onGenerateAudio={handleGenerateAudio}
                onGetWritingHelp={handleGetWritingHelp}
                idPrefix="mobile"
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="border-t bg-muted/50 text-sm text-muted-foreground flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 px-4 py-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <span className="flex-shrink-0">Ch. {chapter.order_index}</span>
            <span className="hidden sm:inline flex-shrink-0">•</span>
            <span className="flex-shrink-0">{wordCount} words</span>
            <span className="hidden sm:inline flex-shrink-0">•</span>
            <span className="hidden sm:inline flex-shrink-0">{content.length} chars</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            {autoSave && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="hidden sm:inline">Auto-save enabled</span>
                <span className="sm:hidden">Auto-save</span>
              </span>
            )}
            <span className="hidden sm:inline flex-shrink-0">Ctrl+S to save</span>
          </div>
        </div>
      </div>

      {/* Ideas Search Modal */}
      <IdeasSearchModal
        isOpen={ideasModalOpen}
        onClose={() => setIdeasModalOpen(false)}
        projectId={chapter.project_id}
      />

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Unsaved changes"
        description="Save your changes before closing the editor?"
        confirmLabel="Save and close"
        cancelLabel="Keep editing"
        onConfirm={handleSaveAndClose}
      />
    </div>
  )
}

