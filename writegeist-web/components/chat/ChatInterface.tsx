'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ChatSession, ChatMessage, Project } from '@/types/database'
import { chatAPI } from '@/lib/api/chat'
import { projectsAPI } from '@/lib/api/projects'
import { Pencil } from 'lucide-react'

interface ChatInterfaceProps {
  sessionId?: string
  projectId?: string
  onSessionCreated?: (session: ChatSession) => void
}

export function ChatInterface({ sessionId, projectId, onSessionCreated }: ChatInterfaceProps) {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [regeneratingEmbeddings, setRegeneratingEmbeddings] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProjects()
    getCurrentUser()
    if (sessionId) {
      loadSession()
    } else if (projectId) {
      setSelectedProjectId(projectId)
    }
  }, [sessionId, projectId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getCurrentUser = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const loadProjects = async () => {
    try {
      const projectList = await projectsAPI.getAll()
      setProjects(projectList)
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const loadSession = async () => {
    if (!sessionId) return

    setLoading(true)
    try {
      const [allSessions, messageList] = await Promise.all([
        chatAPI.getSessions(),
        chatAPI.getMessages(sessionId)
      ])

      const sessionData = allSessions.find(s => s.id === sessionId)
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

  const createNewSession = async () => {
    try {
      const newSession = await chatAPI.createSession('New Chat', selectedProjectId || undefined)

      if (newSession) {
        setSession(newSession)
        onSessionCreated?.(newSession)
        return newSession
      }
    } catch (error) {
      console.error('Error creating session:', error)
    }
    return null
  }

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput('')

    // Create session if needed
    let currentSession = session
    if (!currentSession) {
      currentSession = await createNewSession()
      if (!currentSession) return
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: currentSession.id,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
      user_id: 'temp-user', // This will be replaced when saved to database
      metadata: {}
    }

    setMessages(prev => [...prev, userMsg])
    setThinking(true)

    try {
      // Save user message to database
      const savedUserMsg = await chatAPI.sendMessage(currentSession.id, userMessage, 'user')
      
      if (savedUserMsg) {
        setMessages(prev => prev.map(m => m.id === userMsg.id ? savedUserMsg : m))
      }

      // Get AI response (simulated for now)
      const aiResponse = await getAIResponse(userMessage, currentSession, messages)
      
      if (aiResponse) {
        const aiMsg = await chatAPI.sendMessage(currentSession.id, aiResponse, 'assistant')
        if (aiMsg) {
          setMessages(prev => [...prev, aiMsg])
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove the temporary message on error
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
    } finally {
      setThinking(false)
    }
  }

  const getAIResponse = async (userMessage: string, session: ChatSession, previousMessages: ChatMessage[]): Promise<string> => {
    try {
      // Build context from previous messages
      const contextMessages = previousMessages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))

      // Add system prompt for writing assistance
      const systemPrompt = `You are a helpful writing assistant for creative writers. You help with:
- Character development and motivation
- Plot structure and pacing  
- World-building and setting details
- Dialogue improvement
- Creative brainstorming
- Overcoming writer's block

${session.project_id ? 'The user is working on a specific writing project. ' : ''}Be encouraging, specific, and practical in your advice. Keep responses concise but helpful.`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...contextMessages,
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 500,
          projectId: session.project_id,
          userId: currentUserId || session.user_id || 'temp-user' // Use current authenticated user ID
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 500 && errorData.error?.includes('API key')) {
          return "⚠️ OpenAI API key not configured. Please add your API key in Settings → Application → OpenAI API Key to enable AI assistance."
        }
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      return data.message || "I'm having trouble responding right now. Please try again."
      
    } catch (error) {
      console.error('Error getting AI response:', error)
      return "I'm experiencing technical difficulties. Please check that your OpenAI API key is configured in Settings and try again."
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleStartEditTitle = () => {
    setEditingTitle(true)
    setNewTitle(session?.title || 'New Chat Session')
  }

  const handleSaveTitle = async () => {
    if (!newTitle.trim()) {
      setEditingTitle(false)
      return
    }

    try {
      if (session) {
        // Update existing session
        const success = await chatAPI.updateSessionTitle(session.id, newTitle.trim())
        if (success) {
          setSession(prev => prev ? { ...prev, title: newTitle.trim() } : null)
          setEditingTitle(false)
        }
      } else {
        // Create new session with custom title
        const newSession = await chatAPI.createSession(newTitle.trim(), selectedProjectId)
        if (newSession) {
          setSession(newSession)
          setEditingTitle(false)
          onSessionCreated?.(newSession)
        }
      }
    } catch (error) {
      console.error('Error updating chat title:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingTitle(false)
    setNewTitle('')
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
      minute: '2-digit'
    })
  }

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    return project?.title || 'Unknown Project'
  }

  const regenerateEmbeddings = async () => {
    if (!selectedProjectId) return
    
    setRegeneratingEmbeddings(true)
    try {
              const response = await fetch('/api/embeddings/regenerate-project-fixed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectId })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('Embeddings regenerated successfully:', result)
        
        // Show success message
        const projectName = projects.find(p => p.id === selectedProjectId)?.title || 'Project'
        alert(`✅ Successfully regenerated embeddings for ${projectName}!\n\nGenerated ${result.totalChunks} chunked embeddings from ${result.chaptersWithContent} chapters with content (out of ${result.totalChapters} total chapters).\n\nChat should now provide much more specific and accurate answers!`)
      } else {
        console.error('Failed to regenerate embeddings')
        alert('❌ Failed to regenerate embeddings. Please check the console for details.')
      }
    } catch (error) {
      console.error('Error regenerating embeddings:', error)
      alert('❌ Error regenerating embeddings. Please check the console for details.')
    } finally {
      setRegeneratingEmbeddings(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {editingTitle ? (
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onBlur={() => {
                    setEditingTitle(false)
                    if (newTitle.trim() && session) {
                      // Update session title
                      chatAPI.updateSessionTitle(session.id, newTitle.trim())
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setEditingTitle(false)
                      if (newTitle.trim() && session) {
                        chatAPI.updateSessionTitle(session.id, newTitle.trim())
                      }
                    }
                  }}
                  autoFocus
                  className="h-8 w-48"
                />
              ) : (
                <button
                  onClick={() => {
                    setNewTitle(session?.title || 'New Chat')
                    setEditingTitle(true)
                  }}
                  className="hover:bg-accent hover:text-accent-foreground px-2 py-1 rounded text-left"
                >
                  {session?.title || 'New Chat'}
                </button>
              )}
            </h2>
            {session && (
              <button
                onClick={() => {
                  setNewTitle(session.title || 'New Chat')
                  setEditingTitle(true)
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          
          {selectedProjectId && (
            <div className="text-sm text-muted-foreground">
              Project: {projects.find(p => p.id === selectedProjectId)?.title || 'Unknown'}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {selectedProjectId && (
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateEmbeddings}
              disabled={regeneratingEmbeddings}
              className="text-xs"
            >
              {regeneratingEmbeddings ? 'Regenerating...' : 'Fix Chat'}
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-lg font-medium mb-2">AI Writing Assistant</h3>
            <p className="text-muted-foreground mb-6">
              I&apos;m here to help with your writing! Ask me about:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <div className="bg-card border rounded-lg p-4">
                <h4 className="font-medium mb-2">📝 Writing Craft</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Character development</li>
                  <li>• Plot structure & pacing</li>
                  <li>• Dialogue improvement</li>
                  <li>• Setting & world-building</li>
                </ul>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <h4 className="font-medium mb-2">💡 Creative Help</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Brainstorming ideas</li>
                  <li>• Overcoming writer&apos;s block</li>
                  <li>• Story analysis</li>
                  <li>• Genre conventions</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div
                    className={`text-xs mt-2 opacity-70 ${
                      message.role === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {formatTime(message.created_at)}
                  </div>
                </div>
              </div>
            ))}
            
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 sm:p-4 border-t">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything about your writing..."
              className="w-full p-3 border border-input rounded-lg bg-background resize-none min-h-[44px] max-h-32 text-sm sm:text-base"
              rows={1}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = target.scrollHeight + 'px'
              }}
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || thinking}
            className="px-3 sm:px-6 flex-shrink-0"
            size="default"
          >
            {thinking ? '⏳' : 'Send'}
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mt-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
          <span className="sm:hidden">Enter to send, Shift+Enter for new line</span>
          <span className="text-right sm:text-left">{input.length}/2000</span>
        </div>
      </div>
    </div>
  )
}
