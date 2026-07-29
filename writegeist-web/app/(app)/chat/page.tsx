'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import type { ChatSession } from '@/types/database'

export default function ChatPage() {
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [showChatList, setShowChatList] = useState(true)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  const handleSessionSelect = (session: ChatSession) => {
    setSelectedSession(session)
    setShowChatList(false)
  }

  const handleNewChat = () => {
    setSelectedSession(null)
    setShowChatList(false)
  }

  const handleSessionCreated = (session: ChatSession) => {
    setSelectedSession(session)
    setSidebarRefreshKey((k) => k + 1)
  }

  const handleSessionUpdated = (session: ChatSession) => {
    setSelectedSession(session)
    setSidebarRefreshKey((k) => k + 1)
  }

  const handleBackToList = () => {
    setShowChatList(true)
  }

  return (
    <div className="h-full flex relative">
      <div className={`md:hidden absolute inset-0 z-20 bg-background ${showChatList ? 'block' : 'hidden'}`}>
        <ChatSidebar
          selectedSessionId={selectedSession?.id}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          refreshKey={sidebarRefreshKey}
        />
      </div>

      <div className="hidden md:block">
        <ChatSidebar
          selectedSessionId={selectedSession?.id}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          refreshKey={sidebarRefreshKey}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className={`md:hidden items-center justify-between px-2 py-2 border-b ${showChatList ? 'hidden' : 'flex'}`}>
          <button
            onClick={handleBackToList}
            className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            Chats
          </button>
          <h1 className="font-semibold text-sm sm:text-base truncate mx-2">
            {selectedSession?.title || 'New Chat'}
          </h1>
          <div className="w-16" />
        </div>

        <div className={`flex-1 min-h-0 ${showChatList ? 'hidden md:block' : 'block'}`}>
          <ChatInterface
            sessionId={selectedSession?.id}
            projectId={selectedSession?.project_id || undefined}
            onSessionCreated={handleSessionCreated}
            onSessionUpdated={handleSessionUpdated}
          />
        </div>
      </div>
    </div>
  )
}
