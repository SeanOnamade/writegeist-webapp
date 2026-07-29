// Browser-side adapter over lib/data/chapters (uses the singleton client).
// Server components should import lib/data/chapters directly with a server client.

import { supabase } from '@/lib/supabase/client'
import * as data from '@/lib/data/chapters'
import { chapterContentStorage } from '@/lib/storage/chapterContent'
import type { Chapter, ChapterInsert } from '@/types/database'

export const chaptersAPI = {
  getAll(projectId: string): Promise<Chapter[]> {
    return data.getChaptersByProject(supabase, projectId)
  },

  getById(id: string): Promise<Chapter | null> {
    return data.getChapter(supabase, id)
  },

  /**
   * Create or update a chapter. Content updates are stored in the
   * chapter-content bucket and trigger chunked embedding regeneration.
   */
  async save(chapter: Partial<Chapter>): Promise<Chapter | null> {
    if (!chapter.id) {
      return data.createChapter(supabase, chapter as Omit<ChapterInsert, 'user_id'>)
    }

    if (chapter.content !== undefined) {
      const wordCount = chapter.content
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length

      let projectId = chapter.project_id
      if (!projectId) {
        const { data: row } = await supabase
          .from('chapters')
          .select('project_id')
          .eq('id', chapter.id)
          .single()
        projectId = row?.project_id
      }

      return chapterContentStorage.saveChapterContent(chapter.id, chapter.content, {
        title: chapter.title,
        status: chapter.status,
        wordCount,
        orderIndex: chapter.order_index,
        projectId,
      })
    }

    return data.updateChapterMeta(supabase, chapter.id, chapter)
  },

  delete(id: string): Promise<boolean> {
    return data.deleteChapter(supabase, id)
  },

  reorder(projectId: string, chapterIds: string[]): Promise<boolean> {
    return data.reorderChapters(supabase, projectId, chapterIds)
  },
}
