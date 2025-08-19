'use client'

import { useState } from 'react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import type { ChatSession } from '@/types/database'

export default function ChatPage() {
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [showChatList, setShowChatList] = useState(true)
  
  // Get project ID from URL params or session
  const projectId = selectedSession?.project_id || 'ededb541-8ea5-4304-b830-ca628e30b47e' // Default to Limbo project

  const handleSessionSelect = (session: ChatSession) => {
    setSelectedSession(session)
    setShowChatList(false) // Hide chat list when session selected
  }

  const handleNewChat = () => {
    setSelectedSession(null)
    setShowChatList(false) // Hide chat list when starting new chat
  }

  const handleSessionCreated = (session: ChatSession) => {
    setSelectedSession(session)
  }

  const handleBackToList = () => {
    setShowChatList(true)
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex relative">
      {/* Mobile: Full-screen chat list */}
      <div className={`md:hidden absolute inset-0 z-20 bg-background ${showChatList ? 'block' : 'hidden'}`}>
        <ChatSidebar
          selectedSessionId={selectedSession?.id}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <ChatSidebar
          selectedSessionId={selectedSession?.id}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header - only show when in chat mode */}
        <div className={`md:hidden flex items-center justify-between p-3 sm:p-4 border-b ${showChatList ? 'hidden' : 'flex'}`}>
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-muted rounded-lg cursor-pointer"
          >
            ← Chats
          </button>
          <h1 className="font-semibold text-sm sm:text-base truncate mx-2">
            {selectedSession?.title || 'New Chat'}
          </h1>
          <div className="w-10"></div>
        </div>

        {/* Chat Interface */}
        <div className={`flex-1 min-h-0 ${showChatList ? 'hidden md:block' : 'block'}`}>
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