import { NextRequest } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { requireUser } from '@/lib/supabase/server'
import { jsonError, parseBody } from '@/lib/api/http'
import { getOpenAIApiKey } from '@/lib/api/provider-keys'
import {
  TTS_VOICES,
  TTS_MODELS,
  cleanTextForTTS,
  chunkTextForTTS,
  hashContent,
  synthesizeSpeech,
  getAudioDuration,
  findCachedAudio,
  saveAudio,
} from '@/lib/audio/tts'

const bodySchema = z.object({
  chapterId: z.string().min(1),
  voice: z.enum(TTS_VOICES).default('alloy'),
  model: z.enum(TTS_MODELS).default('tts-1-hd'),
  force: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return jsonError('Not authenticated', 401)
  }

  const body = await parseBody(request, bodySchema)
  if (!body.ok) return body.response
  const { chapterId, voice, model, force } = body.data

  const { apiKey } = await getOpenAIApiKey(user.id)
  if (!apiKey) {
    return jsonError('OpenAI API key not configured. Please add it in Settings.', 500)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        sendEvent('progress', { step: 'starting', message: 'Initializing audio generation...' })

        const { data: chapter, error: chapterError } = await supabase
          .from('chapters')
          .select('id, title, content, project_id, content_file_path')
          .eq('id', chapterId)
          .eq('user_id', user.id)
          .single()

        if (chapterError || !chapter) {
          sendEvent('error', { error: 'Chapter not found' })
          controller.close()
          return
        }

        sendEvent('progress', { step: 'loading_content', message: 'Loading chapter content...' })

        let chapterContent = chapter.content || ''
        if (chapter.content_file_path) {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('chapter-content')
            .download(chapter.content_file_path)
          if (!downloadError && fileData) {
            chapterContent = await fileData.text()
          }
        }

        if (!chapterContent.trim()) {
          sendEvent('error', { error: 'Chapter has no content to convert to audio' })
          controller.close()
          return
        }

        sendEvent('progress', { step: 'processing_text', message: 'Processing chapter text...' })
        const cleanedText = cleanTextForTTS(chapterContent)
        const contentHash = hashContent(cleanedText)

        // Cache first: identical content + voice + model needs no OpenAI call.
        if (!force) {
          const cached = await findCachedAudio(supabase, {
            userId: user.id,
            chapterId,
            contentHash,
            voice,
            model,
          })
          if (cached) {
            sendEvent('complete', {
              audioId: cached.id,
              duration: cached.duration,
              fileSize: cached.file_size,
              cached: true,
              message: 'Audio already up to date — using existing file.',
            })
            controller.close()
            return
          }
        }

        const openai = new OpenAI({ apiKey })
        const textChunks = chunkTextForTTS(cleanedText)
        const audioChunks: Buffer[] = []

        if (textChunks.length > 1) {
          sendEvent('progress', {
            step: 'chunking_complete',
            message: `Split into ${textChunks.length} chunks`,
            totalChunks: textChunks.length,
          })
        }

        for (let i = 0; i < textChunks.length; i++) {
          const progress = Math.round(((i + 1) / textChunks.length) * 100)
          sendEvent('progress', {
            step: 'processing_chunk',
            message:
              textChunks.length > 1
                ? `Generating audio (part ${i + 1} of ${textChunks.length})`
                : 'Generating audio...',
            currentChunk: i + 1,
            totalChunks: textChunks.length,
            progress,
          })

          try {
            audioChunks.push(await synthesizeSpeech(openai, model, voice, textChunks[i]))
          } catch (chunkError) {
            if (chunkError instanceof Error && chunkError.message.includes('401')) {
              throw new Error('Invalid OpenAI API key. Please check your API key configuration.')
            }
            throw new Error(
              `Failed to generate audio chunk ${i + 1}: ${
                chunkError instanceof Error ? chunkError.message : 'Unknown error'
              }`
            )
          }
        }

        sendEvent('progress', { step: 'finalizing', message: 'Finalizing audio file...' })
        const audioBuffer = Buffer.concat(audioChunks)
        const duration = await getAudioDuration(audioBuffer)

        sendEvent('progress', { step: 'saving', message: 'Saving audio to storage...' })
        const audioId = await saveAudio(supabase, {
          userId: user.id,
          chapterId,
          projectId: chapter.project_id,
          audioBuffer,
          duration,
          voice,
          model,
          contentHash,
        })

        sendEvent('complete', {
          audioId,
          duration,
          fileSize: audioBuffer.length,
          message: 'Audio generation completed successfully!',
        })
        controller.close()
      } catch (error) {
        console.error('Streaming audio generation error:', error)
        sendEvent('error', {
          error: error instanceof Error ? error.message : 'Audio generation failed',
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
