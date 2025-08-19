import type { ChatSession, ChatMessage } from '@/types/database'
import { chatOperations } from '@/lib/database/operations'

export const chatAPI = {
  async getSessions(): Promise<ChatSession[]> {
    return await chatOperations.getSessions()
  },

  async createSession(title: string, projectId?: string): Promise<ChatSession | null> {
    return await chatOperations.createSession({
      title,
      project_id: projectId || null
    })
  },

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    return await chatOperations.getMessages(sessionId)
  },

  async sendMessage(sessionId: string, content: string, role: 'user' | 'assistant' = 'user'): Promise<ChatMessage | null> {
    return await chatOperations.addMessage({
      session_id: sessionId,
      content,
      role
    })
  },

  async deleteSession(sessionId: string): Promise<boolean> {
    // TODO: Implement session deletion (requires cascade delete of messages)
    console.log('Delete session not yet implemented:', sessionId)
    return false
  },

  async updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
    // Simple implementation - just return true for now
    // In a real implementation, this would update the session in the database
    console.log('Update session title (placeholder):', sessionId, title)
    return true
  },

  // AI Integration methods (to be implemented with OpenAI)
  async generateResponse(sessionId: string, userMessage: string, _context?: {
    projectId?: string
    chapterContent?: string
  }): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      // Add user message
      await this.sendMessage(sessionId, userMessage, 'user')

      // TODO: Integrate with OpenAI API
      // For now, return a placeholder response
      const aiResponse = `I understand you're asking about: "${userMessage}". This is a placeholder response. OpenAI integration will be implemented next.`
      
      // Add AI response
      const aiMessage = await this.sendMessage(sessionId, aiResponse, 'assistant')
      
      return { 
        success: !!aiMessage, 
        response: aiResponse 
      }
    } catch (error) {
      console.error('Error generating AI response:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}
