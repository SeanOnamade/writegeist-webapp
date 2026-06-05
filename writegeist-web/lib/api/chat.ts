import type { ChatSession, ChatMessage, Json } from '@/types/database'
import { chatOperations } from '@/lib/database/operations'

export const chatAPI = {
  async getSessions(): Promise<ChatSession[]> {
    return await chatOperations.getSessions()
  },

  async createSession(title: string, projectId?: string): Promise<ChatSession | null> {
    return await chatOperations.createSession({
      title,
      project_id: projectId || null,
    })
  },

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    return await chatOperations.getMessages(sessionId)
  },

  async sendMessage(
    sessionId: string,
    content: string,
    role: 'user' | 'assistant' = 'user',
    metadata?: Json
  ): Promise<ChatMessage | null> {
    return await chatOperations.addMessage({
      session_id: sessionId,
      content,
      role,
      metadata: metadata ?? {},
    })
  },

  async deleteSession(sessionId: string): Promise<boolean> {
    return await chatOperations.deleteSession(sessionId)
  },

  async updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
    const result = await chatOperations.updateSession(sessionId, { title })
    return !!result
  },

  async updateSessionProject(sessionId: string, projectId: string): Promise<boolean> {
    const result = await chatOperations.updateSession(sessionId, { project_id: projectId })
    return !!result
  },
}
