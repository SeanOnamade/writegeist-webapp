import type { Idea } from '@/types/database'
import { ideaOperations } from '@/lib/database/operations'

export const ideasAPI = {
  async getAll(): Promise<Idea[]> {
    return await ideaOperations.getAll()
  },

  async getByProject(projectId: string): Promise<Idea[]> {
    return await ideaOperations.getByProjectId(projectId)
  },

  async create(idea: Omit<Idea, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Idea | null> {
    return await ideaOperations.create(idea)
  },

  async update(id: string, updates: Partial<Idea>): Promise<Idea | null> {
    return await ideaOperations.update(id, updates)
  },

  async delete(id: string): Promise<boolean> {
    return await ideaOperations.delete(id)
  },

  async updateStatus(id: string, status: 'new' | 'in_progress' | 'used' | 'archived'): Promise<Idea | null> {
    return await ideaOperations.update(id, { status })
  },

  async addTags(id: string, newTags: string[]): Promise<Idea | null> {
    const idea = await ideaOperations.getAll().then(ideas => ideas.find(i => i.id === id))
    if (!idea) return null

    const existingTags = idea.tags || []
    const uniqueTags = [...new Set([...existingTags, ...newTags])]
    
    return await ideaOperations.update(id, { tags: uniqueTags })
  },

  async removeTags(id: string, tagsToRemove: string[]): Promise<Idea | null> {
    const idea = await ideaOperations.getAll().then(ideas => ideas.find(i => i.id === id))
    if (!idea) return null

    const filteredTags = (idea.tags || []).filter(tag => !tagsToRemove.includes(tag))
    
    return await ideaOperations.update(id, { tags: filteredTags })
  }
}

