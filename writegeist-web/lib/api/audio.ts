import type { ChapterAudio } from '@/types/database'
import { audioOperations } from '@/lib/database/operations'
import { api } from './client'

export const audioAPI = {
  async getAll(): Promise<ChapterAudio[]> {
    return await audioOperations.getAll()
  },

  async getByChapter(chapterId: string): Promise<ChapterAudio[]> {
    return await audioOperations.getByChapterId(chapterId)
  },

  async generate(chapterId: string, settings?: Record<string, unknown>): Promise<ChapterAudio | null> {
    return await audioOperations.create({
      chapter_id: chapterId,
      project_id: settings?.projectId as string | undefined ?? '',
      file_path: `audio/${chapterId}/${Date.now()}.mp3`,
      status: 'pending',
      voice_model: (settings?.voice as string) || 'alloy',
      tts_model: (settings?.model as string) || 'tts-1-hd',
    })
  },

  async updateStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'error' | 'outdated',
    errorMessage?: string
  ): Promise<ChapterAudio | null> {
    return await audioOperations.update(id, {
      status,
      error_message: errorMessage || null,
    })
  },

  async delete(id: string): Promise<boolean> {
    return await audioOperations.delete(id)
  },

  async uploadAudioFile(file: File, chapterId: string): Promise<{ success: boolean; audioFile?: ChapterAudio }> {
    try {
      const uploadResult = await api.uploadFile(file, 'audio-files', `chapters/${chapterId}/${file.name}`)

      if (!uploadResult.success || !uploadResult.data) {
        return { success: false }
      }

      const audioFile = await audioOperations.create({
        chapter_id: chapterId,
        project_id: '',
        file_path: uploadResult.data,
        file_size: file.size,
        status: 'completed',
      })

      return { success: !!audioFile, audioFile: audioFile || undefined }
    } catch (error) {
      console.error('Error uploading audio file:', error)
      return { success: false }
    }
  },

  async getAudioUrl(audioFile: ChapterAudio): Promise<string | null> {
    try {
      if (!audioFile.file_path) return audioFile.audio_url
      const result = await api.getFileUrl('audio-files', audioFile.file_path)
      return result.data || audioFile.audio_url || null
    } catch (error) {
      console.error('Error getting audio URL:', error)
      return null
    }
  },

  async deleteByChapter(chapterId: string): Promise<{ success: boolean; deleted_file_size?: number; error?: string }> {
    try {
      const response = await fetch(`/api/audio/${chapterId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
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
        error: error instanceof Error ? error.message : 'Failed to delete audio',
      }
    }
  },
}
