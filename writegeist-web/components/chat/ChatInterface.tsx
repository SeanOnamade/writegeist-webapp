'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Pencil } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ChatSession, ChatMessage, Project, Json } from '@/types/database'
import { chatAPI } from '@/lib/api/chat'
import { projectsAPI } from '@/lib/api/projects'
import { titleFromFirstMessage } from '@/lib/chat/prompts'
import { useChatStream } from '@/hooks/useChatStream'
import { MessageList } from './MessageList'
import { Composer } from './Composer'

interface ChatInterfaceProps {
  sessionId?: string
  projectId?: string
  onSessionCreated?: (session: ChatSession) => void
  onSessionUpdated?: (session: ChatSession) => void
}

export function ChatInterface({
  sessionId,
  projectId,
  onSessionCreated,
  onSessionUpdated,
}: ChatInterfaceProps) {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [sendError, setSendError] = useState<string | null>(null)
  const sendingRef = useRef(false)
  const skipLoadSessionRef = useRef(false)

  const { streamingText, indexingStatus, requestChatResponse, resetStream } = useChatStream()

  const loadProjects = useCallback(async () => {
    try {
      const projectList = await projectsAPI.getAll()
      setProjects(projectList)
      setSelectedProjectId((current) => current || projectList[0]?.id || '')
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }, [])

  const getCurrentUser = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }, [])

  useEffect(() => {
    loadProjects()
    getCurrentUser()
  }, [loadProjects, getCurrentUser])

  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId)
    }
  }, [projectId])

  useEffect(() => {
    if (sessionId && !skipLoadSessionRef.current) {
      loadSession(sessionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const loadSession = async (id: string) => {
    setLoading(true)
    try {
      const [allSessions, messageList] = await Promise.all([
        chatAPI.getSessions(),
        chatAPI.getMessages(id),
      ])

      const sessionData = allSessions.find((s) => s.id === id)
      if (sessionData) {
        setSession(sessionData)
        setMessages(messageList)
        if (sessionData.project_id) {
          setSelectedProjectId(sessionData.project_id)
        }
      }
    } catch (error) {
      console.error('Error loading session:', error)
    } finally {
      setLoading(false)
    }
  }

  const createNewSession = async (firstMessage?: string) => {
    const title = firstMessage ? titleFromFirstMessage(firstMessage) : 'New Chat'
    const newSession = await chatAPI.createSession(title, selectedProjectId || undefined)
    if (newSession) {
      setSession(newSession)
      skipLoadSessionRef.current = true
      onSessionCreated?.(newSession)
      onSessionUpdated?.(newSession)
      setTimeout(() => {
        skipLoadSessionRef.current = false
      }, 1000)
      return newSession
    }
    return null
  }

  const sendMessage = async () => {
    if (!input.trim() || sendingRef.current) return

    if (!selectedProjectId) {
      setSendError('Select a project to ask about your manuscript.')
      return
    }

    setSendError(null)
    sendingRef.current = true
    const userMessage = input.trim()
    setInput('')

    let currentSession = session
    const isFirstMessage = messages.length === 0

    if (!currentSession) {
      currentSession = await createNewSession(userMessage)
      if (!currentSession) {
        sendingRef.current = false
        return
      }
    }

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: currentSession.id,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
      user_id: currentUserId,
      metadata: {},
    }

    const messagesWithUser = [...messages, userMsg]
    setMessages(messagesWithUser)
    setThinking(true)

    try {
      const savedUserMsg = await chatAPI.sendMessage(currentSession.id, userMessage, 'user')
      if (savedUserMsg) {
        setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? savedUserMsg : m)))
      }

      if (isFirstMessage && currentSession.title === 'New Chat') {
        const generatedTitle = titleFromFirstMessage(userMessage)
        const updated = await chatAPI.updateSessionTitle(currentSession.id, generatedTitle)
        if (updated) {
          const updatedSession = { ...currentSession, title: generatedTitle }
          setSession(updatedSession)
          onSessionUpdated?.(updatedSession)
        }
      }

      const contextMessages = messagesWithUser
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }))

      const aiResult = await requestChatResponse(
        contextMessages,
        selectedProjectId || currentSession.project_id
      )

      if (aiResult.message) {
        const aiMsg = await chatAPI.sendMessage(currentSession.id, aiResult.message, 'assistant', {
          citations: aiResult.citations,
          confidence: aiResult.confidence,
        } as unknown as Json)

        if (aiMsg) {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant' && last.content === aiResult.message) {
              return prev
            }
            return [...prev, aiMsg]
          })
          // Same render batch as the append, so the streamed bubble is
          // replaced by the saved message without duplication.
          resetStream()
        }
      }

      if (currentSession.project_id !== selectedProjectId) {
        await chatAPI.updateSessionProject(currentSession.id, selectedProjectId)
        setSession((prev) => (prev ? { ...prev, project_id: selectedProjectId } : null))
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      setSendError(
        error instanceof Error && error.message
          ? error.message
          : 'Failed to send message. Please try again.'
      )
      setInput(userMessage)
    } finally {
      setThinking(false)
      resetStream()
      sendingRef.current = false
    }
  }

  const handleSaveTitle = async () => {
    if (!newTitle.trim() || !session) {
      setEditingTitle(false)
      return
    }

    const success = await chatAPI.updateSessionTitle(session.id, newTitle.trim())
    if (success) {
      const updated = { ...session, title: newTitle.trim() }
      setSession(updated)
      onSessionUpdated?.(updated)
    }
    setEditingTitle(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Session header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          {editingTitle ? (
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              autoFocus
              className="h-9 w-56 max-w-full min-w-[8rem]"
            />
          ) : (
            <button
              onClick={() => {
                setNewTitle(session?.title || 'New Chat')
                setEditingTitle(true)
              }}
              className="min-w-0 truncate rounded-md px-2 py-1.5 text-left text-sm font-semibold hover:bg-muted sm:text-base cursor-pointer"
            >
              {session?.title || 'New Chat'}
            </button>
          )}
          {session && !editingTitle && (
            <button
              onClick={() => {
                setNewTitle(session.title || 'New Chat')
                setEditingTitle(true)
              }}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="Rename chat"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          {indexingStatus && (
            <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
              {indexingStatus}
            </span>
          )}
          <Select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-9 w-auto min-w-0 max-w-[200px] text-sm"
            aria-label="Project"
          >
            <option value="">Select project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <MessageList
        messages={messages}
        thinking={thinking}
        streamingText={streamingText}
        projectIdForLinks={selectedProjectId || session?.project_id || ''}
        onSuggestedPrompt={setInput}
      />

      <Composer
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        sending={thinking}
        error={sendError}
      />
    </div>
  )
}
