import type { Chapter } from '@/types/database'
import { api } from './client'

export const chaptersAPI = {
  async getAll(projectId: string): Promise<Chapter[]> {
    const result = await api.getChaptersByProject(projectId)
    return result.data || []
  },

  async getById(id: string): Promise<Chapter | null> {
    const result = await api.getChapter(id)
    return result.data || null
  },

  async save(chapter: Partial<Chapter>): Promise<Chapter | null> {
    let savedChapter: Chapter | null = null
    
    if (chapter.id) {
      const result = await api.updateChapter(chapter.id, chapter)
      savedChapter = result.data || null
    } else {
      const result = await api.createChapter(chapter as any)
      savedChapter = result.data || null
    }
    
    // Generate embeddings asynchronously after successful save
    if (savedChapter && savedChapter.content && savedChapter.content.length > 50) {
      // Don't await this - let it happen in the background
      fetch('/api/embeddings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: savedChapter.id,
          content: savedChapter.content,
          projectId: savedChapter.project_id
        })
      }).catch(error => {
        console.error('Error generating embeddings:', error)
      })
    }
    
    return savedChapter
  },

  async generateEmbeddings(chapterId: string): Promise<boolean> {
    try {
      const chapter = await this.getById(chapterId)
      if (!chapter || !chapter.content || chapter.content.length < 50) {
        return false
      }

      const response = await fetch('/api/embeddings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: chapter.id,
          content: chapter.content,
          projectId: chapter.project_id
        })
      })

      return response.ok
    } catch (error) {
      console.error('Error generating embeddings:', error)
      return false
    }
  },

  async delete(id: string): Promise<boolean> {
    const result = await api.deleteChapter(id)
    return result.success
  },

  async reorder(projectId: string, chapterIds: string[]): Promise<boolean> {
    const result = await api.reorderChapters(projectId, chapterIds)
    return result.success
  },

  // Legacy method for compatibility with existing components
  async analyze(title: string, _text: string): Promise<Record<string, unknown>> {
    // TODO: Integrate with OpenAI API for chapter analysis
    console.log('Chapter analysis requested for:', title)
    return {
      characters: [],
      locations: [],
      pov: ['Third Person'],
      summary: 'Analysis not yet implemented',
      tropes: []
    }
  }
}