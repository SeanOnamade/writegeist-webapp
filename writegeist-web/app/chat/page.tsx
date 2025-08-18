'use client'

import { useState } from 'react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import type { ChatSession } from '@/types/database'

export default function ChatPage() {
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  
  // Get project ID from URL params or session
  const projectId = selectedSession?.project_id || 'ededb541-8ea5-4304-b830-ca628e30b47e' // Default to Limbo project

  const handleSessionSelect = (session: ChatSession) => {
    setSelectedSession(session)
  }

  const handleNewChat = () => {
    setSelectedSession(null)
  }

  const handleSessionCreated = (session: ChatSession) => {
    setSelectedSession(session)
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      {showSidebar && (
        <ChatSidebar
          selectedSessionId={selectedSession?.id}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-muted rounded-lg cursor-pointer"
          >
            ☰
          </button>
          <h1 className="font-semibold">AI Writing Assistant</h1>
          <div className="w-10"></div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1">
          <ChatInterface
            sessionId={selectedSession?.id}
            projectId={projectId}
            onSessionCreated={handleSessionCreated}
          />
        </div>
      </div>
    </div>
  )
}