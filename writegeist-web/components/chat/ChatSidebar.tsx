'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ChatSession, Project } from '@/types/database'
import { chatAPI } from '@/lib/api/chat'
import { projectsAPI } from '@/lib/api/projects'

interface ChatSidebarProps {
  selectedSessionId?: string
  onSessionSelect: (session: ChatSession) => void
  onNewChat: () => void
}

export function ChatSidebar({ selectedSessionId, onSessionSelect, onNewChat }: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [sessionList, projectList] = await Promise.all([
        chatAPI.getSessions(),
        projectsAPI.getAll()
      ])
      setSessions(sessionList)
      setProjects(projectList)
    } catch (error) {
      console.error('Error loading chat data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this chat session? This action cannot be undone.')) {
      return
    }

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

  const handleSaveRename = async (sessionId: string, e: React.MouseEvent) => {
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

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSessionId(null)
    setEditingTitle('')
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
      <div className="w-80 border-r bg-muted/30 p-4">
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
    <div className="w-80 border-r bg-muted/30 flex flex-col h-full max-h-full">
      {/* Header */}
      <div className="p-4 border-b flex-shrink-0">
        <Button onClick={onNewChat} className="w-full mb-4">
          + New Chat
        </Button>
        
        <div className="space-y-2">
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm"
          />
          
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
          >
            <option value="all">All Chats</option>
            <option value="general">General Chats</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm">
              {sessions.length === 0 ? 'No chat sessions yet' : 'No chats match your filters'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSessions.map(session => (
              <div
                key={session.id}
                onClick={() => editingSessionId !== session.id && onSessionSelect(session)}
                className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedSessionId === session.id
                    ? 'bg-primary/10 border border-primary/20'
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
                              handleSaveRename(session.id, e as any)
                            } else if (e.key === 'Escape') {
                              handleCancelRename(e as any)
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
                        {session.project_id && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            📚 {getProjectName(session.project_id)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(session.updated_at)}
                        </p>
                      </>
                    )}
                  </div>
                  
                  {editingSessionId !== session.id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleStartRename(session, e)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        title="Rename chat"
                      >
                        ✏️
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        title="Delete chat"
                      >
                        ×
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
      <div className="p-4 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>{sessions.length} total chats</span>
          <span>{sessions.filter(s => s.project_id).length} project chats</span>
        </div>
      </div>
    </div>
  )
}
