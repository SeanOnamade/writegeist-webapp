'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IdeasSearchModal } from '@/components/ideas/IdeasSearchModal'
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
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing your chapter..."
            className="flex-1 p-4 sm:p-6 border-none resize-none focus:outline-none bg-background text-foreground leading-relaxed"
            style={{ 
              fontSize: '16px',
              lineHeight: '1.6',
              fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
            }}
          />
        </div>

        {/* Desktop Writing Stats Sidebar */}
        <div className="hidden lg:flex lg:w-64 border-l bg-muted/30 p-4">
          <div className="w-full">
            <div className="mb-6">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => setIdeasModalOpen(true)}
              >
                💡 Browse Ideas
              </Button>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold mb-2">Writing Stats</h4>
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
            </div>

            <div className="mt-6">
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

            <div className="mt-6">
              <h4 className="font-semibold mb-2">Quick Actions</h4>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  📊 Analyze Chapter
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={handleGenerateAudio}
                >
                  🎵 Generate Audio
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={handleGetWritingHelp}
                >
                  🤖 Get Writing Help
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Stats Overlay */}
        {sidebarOpen && (
          <div className="lg:hidden absolute inset-0 z-50 flex">
            <div 
              className="flex-1 bg-black/20" 
              onClick={() => setSidebarOpen(false)}
            />
            <div className="w-80 max-w-[90vw] border-l bg-background p-4 shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Writing Tools</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 h-6 w-6"
                >
                  ✕
                </Button>
              </div>
              
              <div className="mb-6">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => setIdeasModalOpen(true)}
                >
                  💡 Browse Ideas
                </Button>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Writing Stats</h4>
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
              </div>

              <div className="mt-6">
                <h4 className="font-semibold mb-2">Chapter Status</h4>
                <div className="space-y-2">
                  {(['draft', 'in_progress', 'completed', 'published'] as const).map(statusOption => (
                    <label key={statusOption} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="mobile-status"
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

              <div className="mt-6">
                <h4 className="font-semibold mb-2">Quick Actions</h4>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    📊 Analyze Chapter
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={handleGenerateAudio}
                  >
                    🎵 Generate Audio
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={handleGetWritingHelp}
                  >
                    🤖 Get Writing Help
                  </Button>
                </div>
              </div>
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
    </div>
  )
}

