// Writegeist Web Migration - Database Operations
// Typed database operations using Supabase client

import { supabase } from '@/lib/supabase/client'
import type { 
  Project, 
  ProjectInsert, 
  ProjectUpdate,
  Chapter, 
  ChapterInsert, 
  ChapterUpdate,
  Idea, 
  IdeaInsert, 
  IdeaUpdate,
  AudioFile,
  AudioFileInsert,
  AudioFileUpdate,
  ChatSession,
  ChatSessionInsert,
  ChatMessage,
  ChatMessageInsert,
  User,
  UserUpdate
} from '@/types/database'

// User operations
export const userOperations = {
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      return null
    }

    return data
  },

  async updateUser(updates: UserUpdate): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating user:', error)
      return null
    }

    return data
  }
}

// Project operations
export const projectOperations = {
  async getAll(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects:', error)
      return []
    }

    return data || []
  },

  async getById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching project:', error)
      return null
    }

    return data
  },

  async create(project: Omit<ProjectInsert, 'user_id'>): Promise<Project | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...project, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Error creating project:', error)
      return null
    }

    return data
  },

  async update(id: string, updates: ProjectUpdate): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating project:', error)
      return null
    }

    return data
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting project:', error)
      return false
    }

    return true
  }
}

// Chapter operations
export const chapterOperations = {
  async getByProjectId(projectId: string): Promise<Chapter[]> {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Error fetching chapters:', error)
      return []
    }

    return data || []
  },

  async getById(id: string): Promise<Chapter | null> {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching chapter:', error)
      return null
    }

    // If chapter uses storage, load content from storage
    if (data.content_file_path) {
      console.log('Loading content from storage for chapter:', id)
      // Import dynamically to avoid circular dependency
      const { chapterContentStorage } = await import('@/lib/storage/chapterContent')
      const storageContent = await chapterContentStorage.loadChapterContent(id)
      if (storageContent) {
        data.content = storageContent
      }
    }

    return data
  },

  async create(chapter: Omit<ChapterInsert, 'user_id'>): Promise<Chapter | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('chapters')
      .insert({ ...chapter, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Error creating chapter:', error)
      return null
    }

    return data
  },

  async update(id: string, updates: ChapterUpdate): Promise<Chapter | null> {
    console.log('Raw updates received:', updates)
    console.log('Updates keys:', Object.keys(updates))
    if (updates.content) {
      console.log('Content length:', updates.content.length)
      console.log('Content preview:', updates.content.substring(0, 200) + '...')
    }
    
    try {
      // Use storage-based approach for any content updates
      if (updates.content !== undefined) {
        console.log('Using storage-based content save...')
        
        // Get project ID for embeddings
        const { data: currentChapter } = await supabase
          .from('chapters')
          .select('project_id')
          .eq('id', id)
          .single()
        
        // Calculate actual word count from content
        const actualWordCount = updates.content.trim().split(/\s+/).filter(word => word.length > 0).length
        console.log('Word count being saved:', updates.word_count, '(old) vs', actualWordCount, '(calculated)')
        
        // Import dynamically to avoid circular dependency
        const { chapterContentStorage } = await import('@/lib/storage/chapterContent')
        const result = await chapterContentStorage.saveChapterContent(id, updates.content, {
          title: updates.title,
          status: updates.status,
          wordCount: actualWordCount, // Use calculated word count
          orderIndex: updates.order_index,
          projectId: currentChapter?.project_id
        })
        
        if (!result) {
          console.error('Storage-based save failed')
          return null
        }
        
        console.log('Storage-based save succeeded!')
        return result
      }

      // Handle non-content updates normally
      const otherUpdates: any = {
        updated_at: new Date().toISOString()
      }
      
      if (updates.title !== undefined) otherUpdates.title = updates.title
      if (updates.status !== undefined) otherUpdates.status = updates.status
      if (updates.word_count !== undefined) otherUpdates.word_count = updates.word_count
      if (updates.order_index !== undefined) otherUpdates.order_index = updates.order_index

      // Only update if there are changes beyond updated_at
      if (Object.keys(otherUpdates).length > 1) {
        console.log('Updating metadata fields:', otherUpdates)
        const { data, error } = await supabase
          .from('chapters')
          .update(otherUpdates)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.error('Error updating metadata:', error)
          return null
        }
        return data
      }

      // No updates to apply
      return null
    } catch (error) {
      console.error('Error in chapter update:', error)
      return null
    }
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting chapter:', error)
      return false
    }

    return true
  },

  async reorder(projectId: string, chapterIds: string[]): Promise<boolean> {
    try {
      // Update each chapter with its new order index
      const updates = chapterIds.map((id, index) => 
        supabase
          .from('chapters')
          .update({ order_index: index + 1 })
          .eq('id', id)
          .eq('project_id', projectId)
      )

      await Promise.all(updates)
      return true
    } catch (error) {
      console.error('Error reordering chapters:', error)
      return false
    }
  }
}

// Idea operations
export const ideaOperations = {
  async getAll(): Promise<Idea[]> {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching ideas:', error)
      return []
    }

    return data || []
  },

  async getByProjectId(projectId: string): Promise<Idea[]> {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching project ideas:', error)
      return []
    }

    return data || []
  },

  async create(idea: Omit<IdeaInsert, 'user_id'>): Promise<Idea | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('ideas')
      .insert({ ...idea, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Error creating idea:', error)
      return null
    }

    return data
  },

  async update(id: string, updates: IdeaUpdate): Promise<Idea | null> {
    const { data, error } = await supabase
      .from('ideas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating idea:', error)
      return null
    }

    return data
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('ideas')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting idea:', error)
      return false
    }

    return true
  }
}

// Audio operations
export const audioOperations = {
  async getByChapterId(chapterId: string): Promise<AudioFile[]> {
    const { data, error } = await supabase
      .from('audio_files')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching audio files:', error)
      return []
    }

    return data || []
  },

  async getAll(): Promise<AudioFile[]> {
    const { data, error } = await supabase
      .from('audio_files')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching all audio files:', error)
      return []
    }

    return data || []
  },

  async create(audioFile: Omit<AudioFileInsert, 'user_id'>): Promise<AudioFile | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('audio_files')
      .insert({ ...audioFile, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Error creating audio file:', error)
      return null
    }

    return data
  },

  async update(id: string, updates: AudioFileUpdate): Promise<AudioFile | null> {
    const { data, error } = await supabase
      .from('audio_files')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating audio file:', error)
      return null
    }

    return data
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('audio_files')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting audio file:', error)
      return false
    }

    return true
  }
}

// Chat operations
export const chatOperations = {
  async getSessions(): Promise<ChatSession[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching chat sessions:', error)
      return []
    }

    return data || []
  },

  async createSession(session: Omit<ChatSessionInsert, 'user_id'>): Promise<ChatSession | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ ...session, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Error creating chat session:', error)
      return null
    }

    return data
  },

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching chat messages:', error)
      return []
    }

    return data || []
  },

  async addMessage(message: Omit<ChatMessageInsert, 'user_id'>): Promise<ChatMessage | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ ...message, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Error adding chat message:', error)
      return null
    }

    return data
  }
}

// Search operations
export const searchOperations = {
  async searchDocuments(
    query: string,
    options: {
      projectId?: string
      contentType?: string
      limit?: number
    } = {}
  ): Promise<Array<{
    id: string
    content_text: string
    content_type: string
    similarity?: number
    metadata: Record<string, unknown>
  }>> {
    // Note: This would require implementing OpenAI embeddings
    // For now, return a simple text search
    const { data, error } = await supabase
      .from('document_embeddings')
      .select('*')
      .textSearch('content_text', query)
      .limit(options.limit || 10)

    if (error) {
      console.error('Error searching documents:', error)
      return []
    }

    // Transform the data to match the expected return type
    return (data || []).map(item => ({
      id: item.id,
      content_text: item.content_text,
      content_type: item.content_type,
      metadata: (item.metadata as Record<string, unknown>) || {}
    }))
  }
}
