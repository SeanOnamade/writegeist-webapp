// Browser-side adapter over lib/data/chat (uses the singleton client).

import { supabase } from '@/lib/supabase/client'
import * as data from '@/lib/data/chat'
import type { ChatSession, ChatMessage, Json } from '@/types/database'

export const chatAPI = {
  getSessions(): Promise<ChatSession[]> {
    return data.getSessions(supabase)
  },

  createSession(title: string, projectId?: string): Promise<ChatSession | null> {
    return data.createSession(supabase, { title, project_id: projectId || null })
  },

  getMessages(sessionId: string): Promise<ChatMessage[]> {
    return data.getMessages(supabase, sessionId)
  },

  sendMessage(
    sessionId: string,
    content: string,
    role: 'user' | 'assistant' = 'user',
    metadata?: Json
  ): Promise<ChatMessage | null> {
    return data.addMessage(supabase, {
      session_id: sessionId,
      content,
      role,
      metadata: metadata ?? {},
    })
  },

  deleteSession(sessionId: string): Promise<boolean> {
    return data.deleteSession(supabase, sessionId)
  },

  async updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
    return (await data.updateSession(supabase, sessionId, { title })) !== null
  },

  async updateSessionProject(sessionId: string, projectId: string): Promise<boolean> {
    return (await data.updateSession(supabase, sessionId, { project_id: projectId })) !== null
  },

  countEmptySessions(): Promise<number> {
    return data.countEmptySessions(supabase)
  },

  deleteEmptySessions(): Promise<number> {
    return data.deleteEmptySessions(supabase)
  },
}
