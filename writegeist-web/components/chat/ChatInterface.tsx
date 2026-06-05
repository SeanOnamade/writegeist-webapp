'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ChatSession, ChatMessage, Project, Json } from '@/types/database'
import { chatAPI } from '@/lib/api/chat'
import { projectsAPI } from '@/lib/api/projects'
import { titleFromFirstMessage } from '@/lib/chat/prompts'
import { groupCitations, type ContextCitation } from '@/lib/chat/groupCitations'
import { Pencil, ChevronDown, ChevronRight } from 'lucide-react'

const SUGGESTED_PROMPTS = [
  'Who is Kane?',
  'Summarize the opening',
  'What happens in chapter 2?',
]

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
  const [indexingStatus, setIndexingStatus] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const skipLoadSessionRef = useRef(false)

  useEffect(() => {
    loadProjects()
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId)
    }
  }, [projectId])

  useEffect(() => {
    if (sessionId && !skipLoadSessionRef.current) {
      loadSession(sessionId)
    }
  }, [sessionId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, thinking])

  const getCurrentUser = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const loadProjects = async () => {
    try {
      const projectList = await projectsAPI.getAll()
      setProjects(projectList)
      if (!selectedProjectId && projectList.length > 0) {
        setSelectedProjectId(projectList[0].id)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

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
        const newTitle = titleFromFirstMessage(userMessage)
        const updated = await chatAPI.updateSessionTitle(currentSession.id, newTitle)
        if (updated) {
          const updatedSession = { ...currentSession, title: newTitle }
          setSession(updatedSession)
          onSessionUpdated?.(updatedSession)
        }
      }

      const aiResult = await getAIResponse(userMessage, currentSession, messagesWithUser)

      if (aiResult.message) {
        const aiMsg = await chatAPI.sendMessage(
          currentSession.id,
          aiResult.message,
          'assistant',
          { citations: aiResult.citations, confidence: aiResult.confidence } as unknown as Json
        )

        if (aiMsg) {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant' && last.content === aiResult.message) {
              return prev
            }
            return [...prev, aiMsg]
          })
        }
      }

      if (currentSession.project_id !== selectedProjectId) {
        await chatAPI.updateSessionProject(currentSession.id, selectedProjectId)
        setSession((prev) => (prev ? { ...prev, project_id: selectedProjectId } : null))
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      setSendError('Failed to send message. Please try again.')
    } finally {
      setThinking(false)
      sendingRef.current = false
    }
  }

  const getAIResponse = async (
    userMessage: string,
    currentSession: ChatSession,
    conversationMessages: ChatMessage[]
  ): Promise<{ message: string; citations: ContextCitation[]; confidence: 'high' | 'low' }> => {
    const contextMessages = conversationMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))

    const effectiveProjectId = selectedProjectId || currentSession.project_id

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: contextMessages,
        temperature: 0.3,
        max_tokens: 1000,
        projectId: effectiveProjectId,
        userId: currentUserId || currentSession.user_id,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (response.status === 500 && errorData.error?.includes('API key')) {
        return {
          message:
            'OpenAI API key not configured. Please add your API key in Settings to enable manuscript Q&A.',
          citations: [],
          confidence: 'low',
        }
      }
      throw new Error(`API request failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.indexing) {
      setIndexingStatus('Indexing manuscript...')
    } else if (data.indexed) {
      setIndexingStatus('Manuscript indexed')
    } else if (!data.hasContent) {
      setIndexingStatus('No chapter content found')
    } else {
      setIndexingStatus(null)
    }

    return {
      message: data.message || "I couldn't find an answer in your manuscript.",
      citations: data.citations || [],
      confidence: data.confidence === 'low' ? 'low' : 'high',
    }
  }

  const toggleCitationExpand = (key: string) => {
    setExpandedCitations((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const getMessageConfidence = (message: ChatMessage): 'high' | 'low' | null => {
    const meta = message.metadata as { confidence?: 'high' | 'low' } | null
    return meta?.confidence ?? null
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getCitations = (message: ChatMessage): ContextCitation[] => {
    const meta = message.metadata as { citations?: ContextCitation[] } | null
    return meta?.citations || []
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
      <div className="flex items-center justify-between p-3 sm:p-4 border-b gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            {editingTitle ? (
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                autoFocus
                className="h-8 w-48"
              />
            ) : (
              <button
                onClick={() => {
                  setNewTitle(session?.title || 'New Chat')
                  setEditingTitle(true)
                }}
                className="hover:bg-accent hover:text-accent-foreground px-2 py-1 rounded text-left font-semibold truncate"
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
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>

          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-sm border border-input rounded-md px-2 py-1 bg-background max-w-[200px] truncate"
          >
            <option value="">Select project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        {indexingStatus && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{indexingStatus}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📖</div>
            <h3 className="text-lg font-medium mb-2">Manuscript Q&A</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Ask questions about your story — characters, plot, events — and get answers from your
              actual chapters.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="text-sm px-3 py-1.5 rounded-full border border-input bg-background hover:bg-accent transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const citations = getCitations(message)
              const groupedCitations = groupCitations(citations)
              const confidence = getMessageConfidence(message)
              const projectIdForLinks = selectedProjectId || session?.project_id || ''
              return (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 ${
                      message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.role === 'assistant' && confidence === 'low' && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Low manuscript match — answer may be incomplete.
                      </p>
                    )}
                    {groupedCitations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50 text-xs opacity-80">
                        <div className="font-medium mb-1">Sources:</div>
                        {groupedCitations.map((group) => {
                          const key = group.chapterId || group.chapterTitle
                          const isExpanded = expandedCitations.has(`${message.id}-${key}`)
                          const excerptCount = group.excerpts.length
                          return (
                            <div key={key} className="mb-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                {excerptCount > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleCitationExpand(`${message.id}-${key}`)}
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label={isExpanded ? 'Collapse excerpts' : 'Expand excerpts'}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                                {group.chapterId && projectIdForLinks ? (
                                  <Link
                                    href={`/project/${projectIdForLinks}/read?chapter=${group.chapterId}`}
                                    className="underline hover:opacity-100"
                                  >
                                    {group.chapterTitle}
                                  </Link>
                                ) : (
                                  <span>{group.chapterTitle}</span>
                                )}
                                <span>({Math.round(group.bestSimilarity * 100)}% match)</span>
                                {excerptCount > 1 && (
                                  <span className="text-muted-foreground">
                                    · {excerptCount} excerpts
                                  </span>
                                )}
                                {group.chapterId && (
                                  <Link
                                    href={`/chapters/${group.chapterId}`}
                                    className="text-muted-foreground hover:text-foreground ml-1"
                                  >
                                    edit
                                  </Link>
                                )}
                              </div>
                              {isExpanded && excerptCount > 1 && (
                                <ul className="mt-1 ml-4 space-y-0.5 text-muted-foreground">
                                  {group.excerpts.map((excerpt, i) => (
                                    <li key={i} className="truncate">
                                      &ldquo;{excerpt}&rdquo;
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div
                      className={`text-xs mt-2 opacity-70 ${
                        message.role === 'user' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}

            {thinking && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">Searching manuscript...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 sm:p-4 border-t">
        {sendError && <p className="text-sm text-destructive mb-2">{sendError}</p>}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about your manuscript — e.g. Who is Kane?"
              className="w-full p-3 border border-input rounded-lg bg-background resize-none min-h-[44px] max-h-32 text-sm sm:text-base"
              rows={1}
              maxLength={2000}
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || thinking}
            className="px-3 sm:px-6 flex-shrink-0"
          >
            {thinking ? '...' : 'Send'}
          </Button>
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Enter to send, Shift+Enter for new line</span>
          <span>{input.length}/2000</span>
        </div>
      </div>
    </div>
  )
}
