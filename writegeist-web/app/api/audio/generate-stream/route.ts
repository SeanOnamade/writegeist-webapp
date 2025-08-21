import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiKey } from '@/lib/crypto'
import OpenAI from 'openai'
import { parseBuffer } from 'music-metadata'

export async function POST(request: NextRequest) {
  try {
    const { chapterId, voice = 'alloy', model = 'tts-1-hd', force = false } = await request.json()
    
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Try to get API key from user settings first, then fallback to env
    let apiKey = process.env.OPENAI_API_KEY
    
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single()
      
      if (userData?.preferences?.openaiApiKey) {
        // Decrypt the stored API key
        apiKey = getApiKey(userData.preferences.openaiApiKey)
        console.log('✅ Using OpenAI API key from user settings (decrypted)')
      } else {
        console.log('No user API key found, using environment variables')
      }
    } catch (error) {
      console.log('Could not load user settings, using env API key:', error)
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add it in Settings.' },
        { status: 500 }
      )
    }

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          // console.log('Sending SSE:', message.trim()) // Debug
          controller.enqueue(encoder.encode(message))
        }

        try {
          sendEvent('progress', { step: 'starting', message: 'Initializing audio generation...' })

          // Get chapter content
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

          // Get content
          let chapterContent = ''
          if (chapter.content_file_path) {
            try {
              const { data: fileData, error: downloadError } = await supabase.storage
                .from('chapter-content')
                .download(chapter.content_file_path)

              if (!downloadError && fileData) {
                chapterContent = await fileData.text()
                console.log('✅ Loaded FULL content from storage, length:', chapterContent.length)
              } else {
                chapterContent = chapter.content || ''
              }
            } catch (error) {
              chapterContent = chapter.content || ''
            }
          } else {
            chapterContent = chapter.content || ''
          }

          if (!chapterContent || chapterContent.trim().length === 0) {
            sendEvent('error', { error: 'Chapter has no content to convert to audio' })
            controller.close()
            return
          }

          sendEvent('progress', { step: 'processing_text', message: 'Processing chapter text...' })

          // Clean text for TTS
          let cleanedText = cleanTextForTTS(chapterContent)
          console.log('Cleaned text length:', cleanedText.length)

          if (cleanedText.length > 4000) {
            sendEvent('progress', { step: 'chunking', message: 'Splitting into chunks for processing...' })
            
            // Generate chunked audio with progress tracking
            const result = await generateChunkedAudioWithProgress(
              cleanedText, model, voice, apiKey, sendEvent
            )

            sendEvent('progress', { step: 'finalizing', message: 'Finalizing audio file...' })

                      // Save to storage and database
          sendEvent('progress', { step: 'saving', message: 'Saving audio to storage...' })
          
          const audioId = await saveAudioToDatabase(
            user.id, chapterId, chapter.project_id, result.audioBuffer, 
            result.duration, voice, model, cleanedText, supabase
          )

            sendEvent('complete', { 
              audioId, 
              duration: result.duration, 
              fileSize: result.audioBuffer.length,
              message: 'Audio generation completed successfully!' 
            })

          } else {
            // Single generation for short content
            sendEvent('progress', { step: 'generating', message: 'Generating audio...', progress: 50 })
            
            const openai = new OpenAI({ apiKey })
            const response = await openai.audio.speech.create({
              model: model as 'tts-1' | 'tts-1-hd',
              voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
              input: cleanedText,
              response_format: 'mp3'
            })

            const audioBuffer = Buffer.from(await response.arrayBuffer())
            
            // Parse duration
            let duration: number
            try {
              const metadata = await parseBuffer(audioBuffer, { mimeType: 'audio/mpeg' })
              duration = Math.round(metadata.format.duration || 0)
            } catch (error) {
              duration = Math.round(audioBuffer.length / 16000)
            }

            // Save to database
            const audioId = await saveAudioToDatabase(
              user.id, chapterId, chapter.project_id, audioBuffer, 
              duration, voice, model, cleanedText, supabase
            )

            sendEvent('complete', { 
              audioId, 
              duration, 
              fileSize: audioBuffer.length,
              message: 'Audio generation completed successfully!' 
            })
          }

          controller.close()

        } catch (error) {
          console.error('Streaming audio generation error:', error)
          sendEvent('error', { 
            error: error instanceof Error ? error.message : 'Audio generation failed'
          })
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Streaming setup error:', error)
    return NextResponse.json(
      { error: 'Failed to start audio generation stream' },
      { status: 500 }
    )
  }
}

// Chunked generation with progress streaming
async function generateChunkedAudioWithProgress(
  text: string, 
  model: string, 
  voice: string, 
  apiKey: string,
  sendEvent: (event: string, data: any) => void
) {
  const openai = new OpenAI({ apiKey })
  
  // Split text into chunks
  const CHUNK_SIZE = 4000
  const textChunks: string[] = []
  
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    const chunk = text.slice(i, i + CHUNK_SIZE)
    if (chunk.trim()) {
      textChunks.push(chunk.trim())
    }
  }

  console.log(`Split into ${textChunks.length} chunks`)
  sendEvent('progress', { 
    step: 'chunking_complete', 
    message: `Split into ${textChunks.length} chunks`,
    totalChunks: textChunks.length 
  })

  const audioChunks: Buffer[] = []

  for (let i = 0; i < textChunks.length; i++) {
    const chunkText = textChunks[i]
    const progress = Math.round(((i + 1) / textChunks.length) * 100)
    
    console.log(`Processing chunk ${i+1}/${textChunks.length} (${chunkText.length} chars)`)
    
    sendEvent('progress', { 
      step: 'processing_chunk', 
      message: `Processing chunk ${i + 1} of ${textChunks.length}`,
      currentChunk: i + 1,
      totalChunks: textChunks.length,
      progress 
    })
    
    try {
      const response = await openai.audio.speech.create({
        model: model as 'tts-1' | 'tts-1-hd',
        voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
        input: chunkText,
        response_format: 'mp3'
      })
      
      const chunkBuffer = Buffer.from(await response.arrayBuffer())
      audioChunks.push(chunkBuffer)
      
      // Send completion update for this chunk
      const completedProgress = Math.round(((i + 1) / textChunks.length) * 100)
      sendEvent('progress', {
        step: 'chunk_completed',
        message: `Completed chunk ${i + 1} of ${textChunks.length}`,
        currentChunk: i + 1,
        totalChunks: textChunks.length,
        progress: completedProgress
      })
      
      // Small delay between requests
      if (i < textChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
    } catch (chunkError) {
      console.error(`Error generating audio for chunk ${i+1}:`, chunkError)
      
      if (chunkError instanceof Error && chunkError.message.includes('401')) {
        throw new Error('Invalid OpenAI API key. Please check your API key configuration.')
      }
      
      throw new Error(`Failed to generate audio chunk ${i+1}: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`)
    }
  }
  
  // Concatenate audio chunks
  const fullAudio = Buffer.concat(audioChunks)
  
  // Parse duration
  let actualDuration: number
  try {
    const metadata = await parseBuffer(fullAudio, { mimeType: 'audio/mpeg' })
    actualDuration = Math.round(metadata.format.duration || 0)
  } catch (error) {
    actualDuration = Math.round(fullAudio.length / 16000)
  }
  
  return {
    audioBuffer: fullAudio,
    duration: actualDuration
  }
}

// Save audio to database and storage
async function saveAudioToDatabase(
  userId: string, chapterId: string, projectId: string, 
  audioBuffer: Buffer, duration: number, voice: string, 
  model: string, content: string, supabase: any
) {
  // Create content hash for change detection
  const crypto = require('crypto')
  const contentHash = crypto.createHash('md5').update(content).digest('hex')
  
  // Generate unique file path
  const audioId = crypto.randomUUID()
  const filePath = `${userId}/${chapterId}/${audioId}.mp3`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('audio-files')
    .upload(filePath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: false
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  // Save audio record to database
  const { data: audioRecord, error: dbError } = await supabase
    .from('chapter_audio')
    .insert({
      id: audioId,
      user_id: userId,
      chapter_id: chapterId,
      project_id: projectId,
      file_path: filePath,
      duration: duration,
      file_size: audioBuffer.length,
      voice_model: voice,
      tts_model: model,
      status: 'completed',
      content_hash: contentHash
    })
    .select()
    .single()

  if (dbError) {
    console.error('Database save error:', dbError)
    throw new Error(`Database save failed: ${dbError.message}`)
  }

  return audioId
}

// Text cleaning function
function cleanTextForTTS(text: string): string {
  let cleaned = text
  
  // Remove markdown formatting
  cleaned = cleaned.replace(/#{1,6}\s*/g, '') // Headers
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1') // Bold
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1') // Italic
  cleaned = cleaned.replace(/`(.*?)`/g, '$1') // Code
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
  
  // Clean up punctuation and spacing
  cleaned = cleaned.replace(/\s+/g, ' ')
  cleaned = cleaned.replace(/[^\w\s.,!?;:'"-]/g, '')
  cleaned = cleaned.trim()
  
  return cleaned
}
