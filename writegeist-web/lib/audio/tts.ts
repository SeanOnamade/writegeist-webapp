import OpenAI from 'openai'
import { parseBuffer } from 'music-metadata'
import crypto from 'crypto'
import type { DbClient } from '@/lib/data/types'
import type { ChapterAudio } from '@/types/database'

export const TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const
export const TTS_MODELS = ['tts-1', 'tts-1-hd'] as const

export type TTSVoice = (typeof TTS_VOICES)[number]
export type TTSModel = (typeof TTS_MODELS)[number]

/** OpenAI TTS accepts at most 4096 input characters per request. */
const CHUNK_SIZE = 4000

/**
 * Strip markdown and TTS-unfriendly characters so the narration reads cleanly.
 */
export function cleanTextForTTS(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:'"-]/g, '')
    .trim()
}

export function chunkTextForTTS(text: string): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    const chunk = text.slice(i, i + CHUNK_SIZE).trim()
    if (chunk) chunks.push(chunk)
  }
  return chunks
}

/**
 * Content hash used for the audio cache: identical cleaned text produces the
 * same hash, so regeneration can be skipped when nothing changed.
 */
export function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

export async function synthesizeSpeech(
  openai: OpenAI,
  model: TTSModel,
  voice: TTSVoice,
  input: string
): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model,
    voice,
    input,
    response_format: 'mp3',
  })
  return Buffer.from(await response.arrayBuffer())
}

export async function getAudioDuration(buffer: Buffer): Promise<number> {
  try {
    const metadata = await parseBuffer(buffer, { mimeType: 'audio/mpeg' })
    return Math.round(metadata.format.duration || 0)
  } catch {
    // Rough estimate from file size when the mp3 header can't be parsed.
    return Math.round(buffer.length / 16000)
  }
}

/**
 * Look for an existing completed audio file for the same chapter content,
 * voice, and model. Lets callers skip the OpenAI call entirely.
 */
export async function findCachedAudio(
  db: DbClient,
  params: {
    userId: string
    chapterId: string
    contentHash: string
    voice: TTSVoice
    model: TTSModel
  }
): Promise<ChapterAudio | null> {
  const { data } = await db
    .from('chapter_audio')
    .select('*')
    .eq('user_id', params.userId)
    .eq('chapter_id', params.chapterId)
    .eq('content_hash', params.contentHash)
    .eq('voice_model', params.voice)
    .eq('tts_model', params.model)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ?? null
}

/**
 * Upload the generated mp3 to storage and insert the chapter_audio record.
 * Throws on failure. Returns the new audio id.
 */
export async function saveAudio(
  db: DbClient,
  params: {
    userId: string
    chapterId: string
    projectId: string
    audioBuffer: Buffer
    duration: number
    voice: TTSVoice
    model: TTSModel
    contentHash: string
  }
): Promise<string> {
  const audioId = crypto.randomUUID()
  const filePath = `${params.userId}/${params.chapterId}/${audioId}.mp3`

  const { error: uploadError } = await db.storage
    .from('audio-files')
    .upload(filePath, params.audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { error: dbError } = await db.from('chapter_audio').insert({
    id: audioId,
    user_id: params.userId,
    chapter_id: params.chapterId,
    project_id: params.projectId,
    file_path: filePath,
    duration: params.duration,
    file_size: params.audioBuffer.length,
    voice_model: params.voice,
    tts_model: params.model,
    status: 'completed',
    content_hash: params.contentHash,
  })

  if (dbError) {
    throw new Error(`Database save failed: ${dbError.message}`)
  }

  return audioId
}
