'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MessageSquare, Pencil, Search, SquarePen, X } from 'lucide-react'
import type { ChatSession, Project } from '@/types/database'
import { chatAPI } from '@/lib/api/chat'
import { projectsAPI } from '@/lib/api/projects'

interface ChatSidebarProps {
  selectedSessionId?: string
  onSessionSelect: (session: ChatSession) => void
  onNewChat: () => void
  refreshKey?: number
}

export function ChatSidebar({ selectedSessionId, onSessionSelect, onNewChat, refreshKey }: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [emptySessionCount, setEmptySessionCount] = useState(0)
  const [clearingEmpty, setClearingEmpty] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [refreshKey])

  const loadData = async () => {
    try {
      const [sessionList, projectList] = await Promise.all([
        chatAPI.getSessions(),
        projectsAPI.getAll()
      ])
      setSessions(sessionList)
      setProjects(projectList)
      const emptyCount = await chatAPI.countEmptySessions()
      setEmptySessionCount(emptyCount)
    } catch (error) {
      console.error('Error loading chat data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const success = await chatAPI.deleteSession(sessionId)
      if (success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (selectedSessionId === sessionId) {
          onNewChat()
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSessionId(session.id)
    setEditingTitle(session.title)
  }

  const handleSaveRename = async (sessionId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    
    if (!editingTitle.trim()) {
      setEditingSessionId(null)
      return
    }

    try {
      const success = await chatAPI.updateSessionTitle(sessionId, editingTitle.trim())
      if (success) {
        setSessions(prev => prev.map(s => 
          s.id === sessionId 
            ? { ...s, title: editingTitle.trim() }
            : s
        ))
        setEditingSessionId(null)
        setEditingTitle('')
      }
    } catch (error) {
      console.error('Error renaming session:', error)
    }
  }

  const handleCancelRename = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const handleClearEmptyChats = async () => {
    if (emptySessionCount === 0) return

    setClearingEmpty(true)
    try {
      const deleted = await chatAPI.deleteEmptySessions()
      if (deleted > 0) {
        const sessionList = await chatAPI.getSessions()
        setSessions(sessionList)
        setEmptySessionCount(0)
        if (selectedSessionId && !sessionList.find((s) => s.id === selectedSessionId)) {
          onNewChat()
        }
      }
    } catch (error) {
      console.error('Error clearing empty chats:', error)
    } finally {
      setClearingEmpty(false)
    }
  }

  const getFilteredSessions = () => {
    let filtered = sessions

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(session =>
        session.title.toLowerCase().includes(query)
      )
    }

    // Apply project filter
    if (projectFilter !== 'all') {
      if (projectFilter === 'general') {
        filtered = filtered.filter(session => !session.project_id)
      } else {
        filtered = filtered.filter(session => session.project_id === projectFilter)
      }
    }

    // Sort by updated date
    return filtered.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    return project?.title || 'Unknown Project'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', {
        weekday: 'short'
      })
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }
  }

  const filteredSessions = getFilteredSessions()

  if (loading) {
    return (
      <div className="w-full md:w-72 border-r bg-card p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-8 bg-muted rounded"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full md:w-72 border-r bg-card flex flex-col h-full max-h-full">
      {/* Header */}
      <div className="p-3 border-b flex-shrink-0 space-y-2">
        <Button onClick={onNewChat} className="w-full gap-2 shadow-sm">
          <SquarePen className="h-4 w-4" />
          New Chat
        </Button>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>

        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-9"
        >
          <option value="all">All Chats</option>
          <option value="general">General Chats</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </Select>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {sessions.length === 0 ? 'No chat sessions yet' : 'No chats match your filters'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {filteredSessions.map(session => (
              <div
                key={session.id}
                onClick={() => editingSessionId !== session.id && onSessionSelect(session)}
                className={`group relative px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  selectedSessionId === session.id
                    ? 'bg-primary/10 ring-1 ring-inset ring-primary/15'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {editingSessionId === session.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="text-sm h-7"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveRename(session.id, e)
                            } else if (e.key === 'Escape') {
                              handleCancelRename(e)
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleSaveRename(session.id, e)}
                            className="h-6 px-2 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelRename}
                            className="h-6 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-medium text-sm truncate">
                          {session.title}
                        </h3>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {session.project_id && (
                            <span className="truncate">{getProjectName(session.project_id)}</span>
                          )}
                          <span className={session.project_id ? 'ml-auto flex-shrink-0' : ''}>
                            {formatDate(session.updated_at)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {editingSessionId !== session.id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleStartRename(session, e)}
                        className="md:opacity-0 md:group-hover:opacity-100 h-8 w-8 md:h-6 md:w-6 p-0 text-muted-foreground hover:text-foreground"
                        title="Rename chat"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSessionToDelete(session.id)
                        }}
                        className="md:opacity-0 md:group-hover:opacity-100 h-8 w-8 md:h-6 md:w-6 p-0 text-muted-foreground hover:text-destructive"
                        title="Delete chat"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-3 border-t text-xs text-muted-foreground space-y-2">
        <div className="flex justify-between">
          <span>{sessions.length} total chats</span>
          <span>{sessions.filter(s => s.project_id).length} project chats</span>
        </div>
        {emptySessionCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClearOpen(true)}
            disabled={clearingEmpty}
            className="w-full h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            {clearingEmpty ? 'Clearing...' : `Clear ${emptySessionCount} empty chat${emptySessionCount === 1 ? '' : 's'}`}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={sessionToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSessionToDelete(null)
        }}
        title="Delete this chat session?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (sessionToDelete) handleDeleteSession(sessionToDelete)
        }}
      />

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title={`Delete ${emptySessionCount} empty chat${emptySessionCount === 1 ? '' : 's'}?`}
        description='Empty "New Chat" sessions with no messages will be removed. This cannot be undone.'
        confirmLabel="Clear"
        destructive
        onConfirm={handleClearEmptyChats}
      />
    </div>
  )
}
