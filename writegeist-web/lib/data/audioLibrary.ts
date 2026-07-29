import type { DbClient } from './types'
import type { ChapterAudio } from '@/types/database'

export type AudioLibraryAudio = ChapterAudio & {
  /** Signed storage URL (1h) — lets the browser stream directly from Supabase. */
  playUrl: string | null
  isOutdated: boolean
}

export interface AudioLibraryChapter {
  id: string
  title: string
  project_id: string
  order_index: number
  word_count: number
  created_at: string
  updated_at: string
  content_preview: string
  project: { title: string; description: string | null }
  audio: AudioLibraryAudio | null
}

export interface AudioLibraryStats {
  total_chapters: number
  audio_generated: number
  audio_processing: number
  audio_pending: number
  audio_errors: number
  total_duration: number
  total_file_size: number
}

export interface AudioLibraryData {
  chapters: AudioLibraryChapter[]
  stats: AudioLibraryStats
}

/**
 * Chapters for a user (scoped to one project when `projectId` is given) with
 * their audio status, signed play URLs, and aggregate stats. Shared by the
 * /audio server page and the /api/audio/library refresh endpoint.
 */
export async function getAudioLibrary(
  db: DbClient,
  userId: string,
  projectId?: string
): Promise<AudioLibraryData> {
  let chaptersQuery = db
    .from('chapters')
    .select(
      `
      id,
      title,
      content,
      project_id,
      order_index,
      word_count,
      created_at,
      updated_at,
      projects!inner(title, description)
    `
    )
    .eq('user_id', userId)

  if (projectId) {
    chaptersQuery = chaptersQuery.eq('project_id', projectId)
  }

  const { data: chapters, error: chaptersError } = await chaptersQuery.order('order_index', {
    ascending: true,
  })

  if (chaptersError) {
    throw new Error(`Failed to load chapters: ${chaptersError.message}`)
  }

  const chapterIds = chapters?.map((ch) => ch.id) || []

  let audioData: ChapterAudio[] = []
  if (chapterIds.length > 0) {
    const { data: audioRecords, error: audioError } = await db
      .from('chapter_audio')
      .select('*')
      .in('chapter_id', chapterIds)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (audioError) {
      console.error('Error fetching audio records:', audioError)
    } else {
      audioData = audioRecords || []
    }
  }

  const signedUrls = new Map<string, string | null>()
  await Promise.all(
    audioData
      .filter((a) => a.status === 'completed' && a.file_path)
      .map(async (audio) => {
        try {
          const { data } = await db.storage
            .from('audio-files')
            .createSignedUrl(audio.file_path!, 3600)
          signedUrls.set(audio.id, data?.signedUrl || null)
        } catch {
          signedUrls.set(audio.id, null)
        }
      })
  )

  const libraryChapters: AudioLibraryChapter[] =
    chapters?.map((chapter) => {
      const audio = audioData.find((a) => a.chapter_id === chapter.id)
      // Full content stays out of the payload to keep egress small.
      const { content, projects, ...rest } = chapter

      return {
        ...rest,
        project: projects,
        audio: audio
          ? {
              ...audio,
              isOutdated: false,
              playUrl: signedUrls.get(audio.id) || audio.audio_url || null,
            }
          : null,
        content_preview: content
          ? content.substring(0, 200) + (content.length > 200 ? '...' : '')
          : 'No content',
      }
    }) || []

  const completed = audioData.filter((a) => a.status === 'completed')
  const stats: AudioLibraryStats = {
    total_chapters: libraryChapters.length,
    audio_generated: completed.length,
    audio_processing: audioData.filter((a) => a.status === 'processing').length,
    audio_pending: libraryChapters.length - audioData.length,
    audio_errors: audioData.filter((a) => a.status === 'error').length,
    total_duration: completed.reduce((sum, a) => sum + (a.duration || 0), 0),
    total_file_size: completed.reduce((sum, a) => sum + (a.file_size || 0), 0),
  }

  return { chapters: libraryChapters, stats }
}
