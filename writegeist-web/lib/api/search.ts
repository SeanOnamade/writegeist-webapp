import { searchOperations } from '@/lib/database/operations'

export interface SearchResult {
  id: string
  content_text: string
  content_type: string
  similarity?: number
  metadata: Record<string, unknown>
}

export const searchAPI = {
  async searchDocuments(
    query: string, 
    options: {
      projectId?: string
      contentType?: string
      limit?: number
    } = {}
  ): Promise<SearchResult[]> {
    return await searchOperations.searchDocuments(query, options)
  },

  async searchChapters(query: string, projectId?: string): Promise<SearchResult[]> {
    return await this.searchDocuments(query, {
      projectId,
      contentType: 'chapter',
      limit: 20
    })
  },

  async searchIdeas(query: string, projectId?: string): Promise<SearchResult[]> {
    return await this.searchDocuments(query, {
      projectId,
      contentType: 'idea',
      limit: 10
    })
  },

  async searchAll(query: string, projectId?: string): Promise<{
    chapters: SearchResult[]
    ideas: SearchResult[]
    documents: SearchResult[]
  }> {
    const [chapters, ideas, documents] = await Promise.all([
      this.searchChapters(query, projectId),
      this.searchIdeas(query, projectId),
      this.searchDocuments(query, { projectId, contentType: 'document', limit: 10 })
    ])

    return { chapters, ideas, documents }
  },

  // Simple text search fallback (when vector search is not available)
  async simpleTextSearch(query: string, content: string[]): Promise<{
    results: Array<{ index: number; content: string; score: number }>
  }> {
    const queryLower = query.toLowerCase()
    const results = content
      .map((text, index) => {
        const textLower = text.toLowerCase()
        const score = textLower.includes(queryLower) ? 
          queryLower.length / textLower.length : 0
        return { index, content: text, score }
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)

    return { results }
  }
}

