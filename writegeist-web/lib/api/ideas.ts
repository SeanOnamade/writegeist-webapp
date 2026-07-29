// Browser-side adapter over lib/data/ideas (uses the singleton client).
// Server components should import lib/data/ideas directly with a server client.

import { supabase } from '@/lib/supabase/client'
import * as data from '@/lib/data/ideas'
import type { Idea } from '@/types/database'

export const ideasAPI = {
  getAll(): Promise<Idea[]> {
    return data.getIdeas(supabase)
  },

  getByProject(projectId: string): Promise<Idea[]> {
    return data.getIdeasByProject(supabase, projectId)
  },

  create(idea: Omit<Idea, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Idea | null> {
    return data.createIdea(supabase, idea)
  },

  update(id: string, updates: Partial<Idea>): Promise<Idea | null> {
    return data.updateIdea(supabase, id, updates)
  },

  delete(id: string): Promise<boolean> {
    return data.deleteIdea(supabase, id)
  },

  updateStatus(id: string, status: Idea['status']): Promise<Idea | null> {
    return data.updateIdea(supabase, id, { status })
  },

  async addTags(id: string, newTags: string[]): Promise<Idea | null> {
    const idea = await data.getIdea(supabase, id)
    if (!idea) return null

    const uniqueTags = [...new Set([...(idea.tags || []), ...newTags])]
    return data.updateIdea(supabase, id, { tags: uniqueTags })
  },

  async removeTags(id: string, tagsToRemove: string[]): Promise<Idea | null> {
    const idea = await data.getIdea(supabase, id)
    if (!idea) return null

    const filteredTags = (idea.tags || []).filter((tag) => !tagsToRemove.includes(tag))
    return data.updateIdea(supabase, id, { tags: filteredTags })
  },
}
