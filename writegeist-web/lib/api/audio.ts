import type { AudioFile } from '@/types/database'
import { audioOperations } from '@/lib/database/operations'
import { api } from './client'

export const audioAPI = {
  async getAll(): Promise<AudioFile[]> {
    return await audioOperations.getAll()
  },

  async getByChapter(chapterId: string): Promise<AudioFile[]> {
    return await audioOperations.getByChapterId(chapterId)
  },

  async generate(chapterId: string, settings?: Record<string, unknown>): Promise<AudioFile | null> {
    return await audioOperations.create({
      chapter_id: chapterId,
      file_name: `chapter_${chapterId}_${Date.now()}.mp3`,
      file_path: `audio/${chapterId}/${Date.now()}.mp3`,
      status: 'pending',
      generation_settings: (settings || {}) as any
    })
  },

  async updateStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed', errorMessage?: string): Promise<AudioFile | null> {
    return await audioOperations.update(id, { 
      status, 
      error_message: errorMessage || null 
    })
  },

  async delete(id: string): Promise<boolean> {
    return await audioOperations.delete(id)
  },

  async uploadAudioFile(file: File, chapterId: string): Promise<{ success: boolean; audioFile?: AudioFile }> {
    try {
      // Upload file to storage
      const uploadResult = await api.uploadFile(file, 'audio-files', `chapters/${chapterId}/${file.name}`)
      
      if (!uploadResult.success || !uploadResult.data) {
        return { success: false }
      }

      // Create audio file record
      const audioFile = await audioOperations.create({
        chapter_id: chapterId,
        file_name: file.name,
        file_path: uploadResult.data,
        file_size: file.size,
        status: 'completed'
      })

      return { success: !!audioFile, audioFile: audioFile || undefined }
    } catch (error) {
      console.error('Error uploading audio file:', error)
      return { success: false }
    }
  },

  async getAudioUrl(audioFile: AudioFile): Promise<string | null> {
    try {
      const result = await api.getFileUrl('audio-files', audioFile.file_path)
      return result.data || null
    } catch (error) {
      console.error('Error getting audio URL:', error)
      return null
    }
  },

  /**
   * Delete audio for a chapter
   * @param chapterId - The chapter ID to delete audio for
   * @returns Success status and deleted file size
   */
  async deleteByChapter(chapterId: string): Promise<{ success: boolean; deleted_file_size?: number; error?: string }> {
    try {
      const response = await fetch(`/api/audio/${chapterId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json()
        return { success: false, error: errorData.error || 'Failed to delete audio' }
      }

      const data = await response.json()
      return { success: true, deleted_file_size: data.deleted_file_size }
    } catch (error) {
      console.error('Error deleting audio:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete audio' 
      }
    }
  }
}
