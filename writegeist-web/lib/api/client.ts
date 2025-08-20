// Writegeist Web Migration - API Client
// This replaces the Electron IPC with Supabase database operations

import { 
  userOperations,
  projectOperations,
  chapterOperations,
  audioOperations
} from '@/lib/database/operations'
import { supabase } from '@/lib/supabase/client'
import type { 
  Project, 
  Chapter, 
  User 
} from '@/types/database'
import type { APIResponse } from '@/types'

// Enhanced API client that integrates with Supabase
export class APIClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.BACKEND_API_URL || 'http://localhost:8000'
  }

  // Legacy HTTP request method (for external APIs)
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      console.error('API request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // User operations
  async getCurrentUser(): Promise<APIResponse<User>> {
    try {
      const user = await userOperations.getCurrentUser()
      return { success: true, data: user || undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user'
      }
    }
  }

  async updateUserProfile(updates: Partial<User>): Promise<APIResponse<User>> {
    try {
      const user = await userOperations.updateUser(updates)
      return { success: true, data: user || undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user'
      }
    }
  }

  // Project operations
  async getAllProjects(): Promise<APIResponse<Project[]>> {
    try {
      const projects = await projectOperations.getAll()
      return { success: true, data: projects }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch projects'
      }
    }
  }

  async getProject(id: string): Promise<APIResponse<Project>> {
    try {
      const project = await projectOperations.getById(id)
      return { success: true, data: project || undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch project'
      }
    }
  }

  async createProject(project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'word_count' | 'chapter_count'>): Promise<APIResponse<Project>> {
    try {
      const newProject = await projectOperations.create(project)
      return { success: true, data: newProject || undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project'
      }
    }
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<APIResponse<Project>> {
    try {
      const project = await projectOperations.update(id, updates)
      return { success: true, data: project || undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project'
      }
    }
  }

  async deleteProject(id: string): Promise<APIResponse<boolean>> {
    try {
      const success = await projectOperations.delete(id)
      return { success, data: success }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project'
      }
    }
  }

  // Chapter operations
  async getChaptersByProject(projectId: string): Promise<APIResponse<Chapter[]>> {
    try {
      const chapters = await chapterOperations.getByProjectId(projectId)
      return { success: true, data: chapters }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch chapters'
      }
    }
  }

  async getChapter(id: string): Promise<APIResponse<Chapter>> {
    try {
      const chapter = await chapterOperations.getById(id)
      return { success: true, data: chapter || undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch chapter'
      }
    }
  }

  async createChapter(chapter: Omit<Chapter, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'word_count'>): Promise<APIResponse<Chapter>> {
    try {
      const newChapter = await chapterOperations.create(chapter)
      return { success: true, data: newChapter || undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create chapter'
      }
    }
  }

  async updateChapter(id: string, updates: Partial<Chapter>): Promise<APIResponse<Chapter>> {
    try {
      const chapter = await chapterOperations.update(id, updates)
      return { success: true, data: chapter || undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update chapter'
      }
    }
  }

  async deleteChapter(id: string): Promise<APIResponse<boolean>> {
    try {
      const success = await chapterOperations.delete(id)
      return { success, data: success }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete chapter'
      }
    }
  }

  async reorderChapters(projectId: string, chapterIds: string[]): Promise<APIResponse<boolean>> {
    try {
      const success = await chapterOperations.reorder(projectId, chapterIds)
      return { success, data: success }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reorder chapters'
      }
    }
  }

  // File operations
  async uploadFile(file: File, bucket: 'audio-files' | 'documents' | 'user-avatars', path: string): Promise<APIResponse<string>> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: 'User not authenticated' }
      }

      const filePath = `${user.id}/${path}`
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data.path }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file'
      }
    }
  }

  async getFileUrl(bucket: string, path: string): Promise<APIResponse<string>> {
    try {
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)

      return { success: true, data: data.publicUrl }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get file URL'
      }
    }
  }

  // Settings operations
  async getSettings(): Promise<APIResponse<Record<string, unknown>>> {
    try {
      const user = await userOperations.getCurrentUser()
      if (!user) {
        return { success: false, error: 'User not found' }
      }
      
      return { 
        success: true, 
        data: (user.preferences as Record<string, unknown>) || {} 
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get settings'
      }
    }
  }

  async saveSettings(settings: Record<string, unknown>): Promise<APIResponse<boolean>> {
    try {
      const user = await userOperations.updateUser({ 
        preferences: settings as any
      })
      return { success: !!user, data: !!user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save settings'
      }
    }
  }

  // Storage operations
  async getStorageUsage(): Promise<APIResponse<{
    byBucket: Record<string, { count: number; size: number }>
    total: { count: number; size: number }
  }>> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: 'User not authenticated' }
      }

      const buckets = ['audio-files', 'documents', 'user-avatars', 'chapter-content']
      const storageData: Record<string, { count: number; size: number }> = {}
      let totalSize = 0
      let totalCount = 0

      // Get storage usage for each bucket
      for (const bucket of buckets) {
        try {
          const { data: files, error } = await supabase.storage
            .from(bucket)
            .list(user.id, {
              limit: 1000,
              sortBy: { column: 'created_at', order: 'desc' }
            })

          if (!error && files) {
            const bucketSize = files.reduce((acc, file) => {
              return acc + (file.metadata?.size || 0)
            }, 0)
            
            storageData[bucket] = {
              count: files.length,
              size: bucketSize
            }
            
            totalSize += bucketSize
            totalCount += files.length
          } else {
            storageData[bucket] = { count: 0, size: 0 }
          }
        } catch (bucketError) {
          console.warn(`Failed to get storage for ${bucket}:`, bucketError)
          storageData[bucket] = { count: 0, size: 0 }
        }
      }

      return {
        success: true,
        data: {
          byBucket: storageData,
          total: { count: totalCount, size: totalSize }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get storage usage'
      }
    }
  }
}

// Create singleton instance
export const api = new APIClient()

// Electron API compatibility layer - maps old interface to new Supabase operations
export const electronAPI = {
  // Echo service (for testing)
  echo: async (text: string): Promise<string> => {
    return `Echo: ${text}`
  },

  // Chapter analysis (TODO: Integrate with OpenAI)
  ingestChapter: async (payload: { title: string; text: string }) => {
    console.log('Stub: ingestChapter called with:', payload)
    return {
      characters: ['Character 1', 'Character 2'],
      locations: ['Location 1'],
      pov: ['Third Person'],
      summary: 'This is a stub summary.',
      tropes: ['Adventure', 'Mystery']
    }
  },

  // Chapter CRUD operations (now using Supabase)
  saveChapterToDB: async (chapter: Partial<Chapter>): Promise<{ success: boolean; chapterId?: string }> => {
    try {
      if (chapter.id) {
        const result = await api.updateChapter(chapter.id, chapter)
        return { success: result.success, chapterId: chapter.id }
      } else {
        const result = await api.createChapter(chapter as any)
        return { success: result.success, chapterId: result.data?.id }
      }
    } catch (error) {
      console.error('Error saving chapter:', error)
      return { success: false }
    }
  },

  getChapters: async (): Promise<Chapter[]> => {
    try {
      // TODO: Get current project ID from context
      const projectId = 'current-project-id' // This should come from app state
      const result = await api.getChaptersByProject(projectId)
      return result.data || []
    } catch (error) {
      console.error('Error fetching chapters:', error)
      return []
    }
  },

  deleteChapter: async (id: string): Promise<void> => {
    try {
      await api.deleteChapter(id)
    } catch (error) {
      console.error('Error deleting chapter:', error)
    }
  },

  updateChapter: async (chapter: Chapter): Promise<void> => {
    try {
      await api.updateChapter(chapter.id, chapter)
    } catch (error) {
      console.error('Error updating chapter:', error)
    }
  },

  // Project document operations (TODO: Implement with projects table)
  getProjectDoc: async (): Promise<string> => {
    console.log('Stub: getProjectDoc called')
    return '# Project Document\n\nThis is a stub project document.'
  },

  saveProjectDoc: async (markdown: string): Promise<void> => {
    console.log('Stub: saveProjectDoc called with:', markdown.substring(0, 100) + '...')
  },

  // Character and location sync (TODO: Implement with project metadata)
  appendCharacters: async (chars: string[]): Promise<{ success: boolean; added?: string[] }> => {
    console.log('Stub: appendCharacters called with:', chars)
    return { success: true, added: chars }
  },

  appendLocations: async (locations: string[]): Promise<{ success: boolean; added?: string[] }> => {
    console.log('Stub: appendLocations called with:', locations)
    return { success: true, added: locations }
  },

  // Configuration (now using user preferences)
  getConfig: async (): Promise<Record<string, unknown>> => {
    try {
      const result = await api.getSettings()
      return result.data || { theme: 'dark' }
    } catch (error) {
      console.error('Error getting config:', error)
      return { theme: 'dark' }
    }
  },

  saveConfig: async (config: Record<string, unknown>): Promise<{ success: boolean }> => {
    try {
      const result = await api.saveSettings(config)
      return { success: result.success }
    } catch (error) {
      console.error('Error saving config:', error)
      return { success: false }
    }
  },

  // Audio operations (TODO: Implement with audio_files table and Edge Functions)
  generateAudio: async (chapterId: string): Promise<Record<string, unknown>> => {
    try {
      const audioFile = await audioOperations.create({
        chapter_id: chapterId,
        file_name: `chapter_${chapterId}_audio.mp3`,
        file_path: `audio/${chapterId}/audio.mp3`,
        status: 'pending',
        generation_settings: {}
      })
      return { success: !!audioFile, status: 'processing' }
    } catch (error) {
      console.error('Error generating audio:', error)
      return { success: false, status: 'failed' }
    }
  },

  getAudioStatus: async (chapterId: string): Promise<Record<string, unknown>> => {
    try {
      const audioFiles = await audioOperations.getByChapterId(chapterId)
      const latestAudio = audioFiles[0]
      if (latestAudio) {
        return { 
          status: latestAudio.status, 
          url: latestAudio.file_path,
          duration: latestAudio.duration 
        }
      }
      return { status: 'not_found' }
    } catch (error) {
      console.error('Error getting audio status:', error)
      return { status: 'error' }
    }
  },

  getAllAudio: async (): Promise<Record<string, unknown>[]> => {
    try {
      const audioFiles = await audioOperations.getAll()
      return audioFiles.map(file => ({
        id: file.id,
        chapterId: file.chapter_id,
        fileName: file.file_name,
        status: file.status,
        duration: file.duration,
        url: file.file_path
      }))
    } catch (error) {
      console.error('Error getting all audio:', error)
      return []
    }
  },

  // Global save handler (not needed in web - handled by auto-save)
  registerGlobalSaveHandler: () => {
    console.log('Stub: registerGlobalSaveHandler called - not needed in web')
  },

  unregisterGlobalSaveHandler: () => {
    console.log('Stub: unregisterGlobalSaveHandler called - not needed in web')
  },

  // Background audio events (will be replaced with real-time subscriptions)
  onBackgroundAudioGenerationStarted: () => {
    console.log('Stub: onBackgroundAudioGenerationStarted - will use real-time subscriptions')
    return () => {} // Return cleanup function
  },

  onBackgroundAudioGenerationFailed: () => {
    console.log('Stub: onBackgroundAudioGenerationFailed - will use real-time subscriptions')
    return () => {} // Return cleanup function
  }
}

// Export as window.api replacement for easy migration
export const windowAPI = electronAPI