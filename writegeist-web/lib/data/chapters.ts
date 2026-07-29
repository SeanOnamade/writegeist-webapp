import type { DbClient } from './types'
import type { Chapter, ChapterInsert, ChapterUpdate } from '@/types/database'

export async function getChaptersByProject(db: DbClient, projectId: string): Promise<Chapter[]> {
  const { data, error } = await db
    .from('chapters')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching chapters:', error)
    return []
  }
  return data ?? []
}

/**
 * Fetch a chapter. Long content lives in the `chapter-content` storage bucket
 * (referenced by `content_file_path`); when present it replaces the truncated
 * database copy.
 */
export async function getChapter(db: DbClient, id: string): Promise<Chapter | null> {
  const { data, error } = await db.from('chapters').select('*').eq('id', id).single()

  if (error) {
    console.error('Error fetching chapter:', error)
    return null
  }

  if (data.content_file_path) {
    const { data: file, error: downloadError } = await db.storage
      .from('chapter-content')
      .download(data.content_file_path)

    if (!downloadError && file) {
      data.content = await file.text()
    }
  }

  return data
}

/**
 * Resolve full content for an already-fetched chapter row: when the database
 * copy is empty, fall back to the storage bucket file referenced by
 * `content_file_path`.
 */
export async function loadChapterRowContent(
  db: DbClient,
  chapter: { content: string | null; content_file_path: string | null }
): Promise<string> {
  let content = chapter.content || ''

  if (!content && chapter.content_file_path) {
    const { data, error } = await db.storage
      .from('chapter-content')
      .download(chapter.content_file_path)

    if (!error && data) {
      content = await data.text()
    }
  }

  return content
}

export async function createChapter(
  db: DbClient,
  chapter: Omit<ChapterInsert, 'user_id'>
): Promise<Chapter | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const { data, error } = await db
    .from('chapters')
    .insert({ ...chapter, user_id: user.id })
    .select()
    .single()

  if (error) {
    console.error('Error creating chapter:', error)
    return null
  }
  return data
}

/**
 * Update chapter metadata (title, status, order, word count). Content updates
 * go through lib/storage/chapterContent so they land in the storage bucket
 * and trigger embedding regeneration — see chaptersAPI.save.
 */
export async function updateChapterMeta(
  db: DbClient,
  id: string,
  updates: Pick<ChapterUpdate, 'title' | 'status' | 'word_count' | 'order_index'>
): Promise<Chapter | null> {
  const fields: ChapterUpdate = { updated_at: new Date().toISOString() }
  if (updates.title !== undefined) fields.title = updates.title
  if (updates.status !== undefined) fields.status = updates.status
  if (updates.word_count !== undefined) fields.word_count = updates.word_count
  if (updates.order_index !== undefined) fields.order_index = updates.order_index

  const { data, error } = await db
    .from('chapters')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating chapter:', error)
    return null
  }
  return data
}

export async function deleteChapter(db: DbClient, id: string): Promise<boolean> {
  const { error } = await db.from('chapters').delete().eq('id', id)

  if (error) {
    console.error('Error deleting chapter:', error)
    return false
  }
  return true
}

export async function reorderChapters(
  db: DbClient,
  projectId: string,
  chapterIds: string[]
): Promise<boolean> {
  try {
    await Promise.all(
      chapterIds.map((id, index) =>
        db
          .from('chapters')
          .update({ order_index: index + 1 })
          .eq('id', id)
          .eq('project_id', projectId)
      )
    )
    return true
  } catch (error) {
    console.error('Error reordering chapters:', error)
    return false
  }
}
