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

    console.log('Generating audio for chapter:', chapterId)
    console.log('User:', user.id)
    console.log('Voice:', voice)
    console.log('Model:', model)
    console.log('Force regeneration:', force)

    // Get chapter content
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, title, content, project_id, content_file_path')
      .eq('id', chapterId)
      .eq('user_id', user.id)
      .single()

    if (chapterError || !chapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      )
    }

    // Get content - prioritize storage file over database field for full content
    let chapterContent = ''
    
    console.log('Chapter data:', {
      id: chapter.id,
      title: chapter.title,
      content_length: chapter.content?.length || 0,
      content_file_path: chapter.content_file_path,
      has_content: !!chapter.content,
      has_file_path: !!chapter.content_file_path
    })
    
    // If there's a storage file, load from there first (likely has full content)
    if (chapter.content_file_path) {
      console.log('Loading content from storage file (prioritized):', chapter.content_file_path)
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('chapter-content')
          .download(chapter.content_file_path)

        if (!downloadError && fileData) {
          chapterContent = await fileData.text()
          console.log('✅ Loaded FULL content from storage, length:', chapterContent.length)
        } else {
          console.error('Storage download error:', downloadError)
          console.log('Falling back to database content field')
          chapterContent = chapter.content || ''
        }
      } catch (error) {
        console.error('Error loading content from storage:', error)
        console.log('Falling back to database content field')
        chapterContent = chapter.content || ''
      }
    } else {
      // No storage file, use database content
      console.log('No storage file, using database content field')
      chapterContent = chapter.content || ''
    }

    if (!chapterContent || chapterContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Chapter has no content to convert to audio' },
        { status: 400 }
      )
    }

    console.log('Chapter content length:', chapterContent.length)

    // Clean text for TTS
    let cleanedText = cleanTextForTTS(chapterContent)
    console.log('Cleaned text length:', cleanedText.length)

    // OpenAI TTS has a hard limit of 4096 characters - use chunking for long content
    let audioBuffer: Buffer
    let totalDuration: number

    if (cleanedText.length > 4000) {
      console.log(`Chapter content is ${cleanedText.length} characters, using chunking approach like desktop version`)
      
      // Use chunking approach from desktop version
      const result = await generateAudioChunked(cleanedText, voice, model, apiKey)
      audioBuffer = result.audioBuffer
      totalDuration = result.duration
      
    } else {
      console.log('Chapter content fits in single TTS request')
      
      // Single request for short content
      const openai = new OpenAI({ apiKey })
      const ttsResponse = await openai.audio.speech.create({
        model: model as 'tts-1' | 'tts-1-hd',
        voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
        input: cleanedText,
        response_format: 'mp3'
      })

      audioBuffer = Buffer.from(await ttsResponse.arrayBuffer())
      
      // Get actual duration from MP3 metadata
      try {
        const metadata = await parseBuffer(audioBuffer, { mimeType: 'audio/mpeg' })
        totalDuration = Math.round(metadata.format.duration || 0)
        console.log(`✅ Parsed actual MP3 duration: ${totalDuration}s`)
      } catch (error) {
        console.log('Could not parse MP3 metadata, using word estimation')
        const wordCount = cleanedText.split(/\s+/).length
        totalDuration = Math.round((wordCount / 150) * 60)
      }
    }

    // Create content hash to detect changes
    const contentHash = Buffer.from(cleanedText).toString('base64').substring(0, 50)

    // Check if audio already exists and is up to date
    const { data: existingAudio } = await supabase
      .from('chapter_audio')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('user_id', user.id)
      .single()

    // Only return existing audio if not forcing regeneration and content hasn't changed
    if (!force && existingAudio && existingAudio.status === 'completed' && existingAudio.content_hash === contentHash) {
      return NextResponse.json({
        success: true,
        audio: existingAudio,
        message: 'Audio already exists and is up to date'
      })
    }

    // If forcing regeneration or content changed, proceed with generation
    if (force) {
      console.log('Forcing regeneration - will delete existing audio and create new')
    }

    // Delete existing audio record if it exists
    if (existingAudio) {
      // Delete old audio file from storage
      if (existingAudio.file_path) {
        await supabase.storage
          .from('audio-files')
          .remove([existingAudio.file_path])
      }
      
      // Delete database record
      await supabase
        .from('chapter_audio')
        .delete()
        .eq('id', existingAudio.id)
    }

    // Create new audio record
    const audioId = crypto.randomUUID()
    const { data: audioRecord, error: audioCreateError } = await supabase
      .from('chapter_audio')
      .insert({
        id: audioId,
        user_id: user.id,
        chapter_id: chapterId,
        project_id: chapter.project_id,
        voice_model: voice,
        tts_model: model,
        status: 'processing',
        content_hash: contentHash
      })
      .select()
      .single()

    if (audioCreateError) {
      console.error('Error creating audio record:', audioCreateError)
      return NextResponse.json(
        { error: 'Failed to create audio record' },
        { status: 500 }
      )
    }

    console.log('Created audio record:', audioId)

    try {
      console.log('Starting audio generation...')

      // Upload to Supabase Storage
      const fileName = `${user.id}/${chapterId}/${audioId}.mp3`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw new Error(`Failed to upload audio: ${uploadError.message}`)
      }

      console.log('Audio uploaded to storage:', uploadData.path)

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName)

      const audioUrl = publicUrlData.publicUrl

      console.log('Final duration:', totalDuration, 'seconds')

      // Update audio record with results
      const { data: updatedAudio, error: updateError } = await supabase
        .from('chapter_audio')
        .update({
          audio_url: audioUrl,
          file_path: fileName,
          duration: totalDuration,
          file_size: audioBuffer.length,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', audioId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating audio record:', updateError)
        throw new Error(`Failed to update audio record: ${updateError.message}`)
      }

      console.log('Audio generation completed successfully')

      return NextResponse.json({
        success: true,
        audio: updatedAudio,
        message: 'Audio generated successfully'
      })

    } catch (error) {
      console.error('Audio generation error:', error)
      
      // Determine error type and message
      let errorMessage = 'Unknown error'
      let statusCode = 500
      
      if (error instanceof Error) {
        errorMessage = error.message
        // Check for specific OpenAI API errors
        if (error.message.includes('401') || error.message.includes('Incorrect API key')) {
          errorMessage = 'Invalid OpenAI API key. Please check your API key configuration.'
          statusCode = 401
        } else if (error.message.includes('quota') || error.message.includes('billing')) {
          errorMessage = 'OpenAI API quota exceeded. Please check your billing status.'
          statusCode = 402
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please try again in a few minutes.'
          statusCode = 429
        }
      }
      
      // Update audio record with error
      await supabase
        .from('chapter_audio')
        .update({
          status: 'error',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', audioId)

      return NextResponse.json(
        { 
          error: errorMessage,
          error_type: statusCode === 401 ? 'api_key_invalid' : 'generation_failed'
        },
        { status: statusCode }
      )
    }

  } catch (error) {
    console.error('Request processing error:', error)
    
    // Return more specific error for common issues
    let errorMessage = 'Internal server error'
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('401')) {
        errorMessage = 'Invalid OpenAI API key. Please check your configuration.'
      } else if (error.message.includes('not authenticated')) {
        errorMessage = 'User not authenticated'
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Helper function to clean text for TTS
function cleanTextForTTS(text: string): string {
  let cleaned = text

  // Remove markdown formatting
  cleaned = cleaned.replace(/#{1,6}\s*/g, '') // Headers
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1') // Bold
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1') // Italic
  cleaned = cleaned.replace(/`(.+?)`/g, '$1') // Code
  cleaned = cleaned.replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links

  // Fix common encoding issues
  cleaned = cleaned.replace(/â€™/g, "'")
  cleaned = cleaned.replace(/â€œ/g, '"')
  cleaned = cleaned.replace(/â€/g, '"')
  cleaned = cleaned.replace(/â€"/g, '—')

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ')
  cleaned = cleaned.trim()

  // Note: Chunking system handles long content automatically

  return cleaned
}

// Generate audio using chunking approach (like desktop version)
async function generateAudioChunked(
  text: string, 
  voice: string, 
  model: string, 
  apiKey: string
): Promise<{ audioBuffer: Buffer; duration: number }> {
  const openai = new OpenAI({ apiKey })
  const chunkSize = 4000 // Same as desktop version
  
  console.log(`Generating chunked audio - model: ${model}, voice: ${voice}, text length: ${text.length} chars`)
  
  // Split text into chunks, trying to break at sentence boundaries
  const textChunks: string[] = []
  let currentPos = 0
  
  while (currentPos < text.length) {
    // Get the next chunk
    let endPos = Math.min(currentPos + chunkSize, text.length)
    let chunkText = text.substring(currentPos, endPos)
    
    // If we're not at the end and this chunk doesn't end with punctuation,
    // try to find a better breaking point
    if (endPos < text.length) {
      // Look for sentence endings within the last 200 characters
      const searchStart = Math.max(0, chunkText.length - 200)
      const lastPeriod = chunkText.lastIndexOf('. ', chunkText.length)
      const lastExclamation = chunkText.lastIndexOf('! ', chunkText.length)
      const lastQuestion = chunkText.lastIndexOf('? ', chunkText.length)
      
      // Use the latest sentence ending we found
      const bestBreak = Math.max(lastPeriod, lastExclamation, lastQuestion)
      
      if (bestBreak > searchStart && bestBreak > 0) {
        // Adjust chunk to end at sentence boundary
        chunkText = chunkText.substring(0, bestBreak + 2) // Include punctuation and space
        endPos = currentPos + chunkText.length
      }
    }
    
    textChunks.push(chunkText.trim())
    currentPos = endPos
  }
  
  console.log(`Split into ${textChunks.length} chunks`)
  
  // Generate audio for each chunk
  const audioChunks: Buffer[] = []
  for (let i = 0; i < textChunks.length; i++) {
    const chunkText = textChunks[i]
    if (!chunkText.trim()) continue
    
    console.log(`Processing chunk ${i+1}/${textChunks.length} (${chunkText.length} chars)`)
    
    try {
      const response = await openai.audio.speech.create({
        model: model as 'tts-1' | 'tts-1-hd',
        voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
        input: chunkText,
        response_format: 'mp3'
      })
      
      const chunkBuffer = Buffer.from(await response.arrayBuffer())
      audioChunks.push(chunkBuffer)
      
      // Small delay between requests to be respectful to API
      if (i < textChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
    } catch (chunkError) {
      console.error(`Error generating audio for chunk ${i+1}:`, chunkError)
      
      // Check if it's an API key error and throw with proper context
      if (chunkError instanceof Error && (
        chunkError.message.includes('401') || 
        chunkError.message.includes('Incorrect API key') ||
        chunkError.message.includes('invalid_api_key')
      )) {
        throw new Error('Invalid OpenAI API key. Please check your API key configuration.')
      }
      
      throw new Error(`Failed to generate audio chunk ${i+1}: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`)
    }
  }
  
  // Concatenate all audio chunks (simple approach for MP3)
  const fullAudio = Buffer.concat(audioChunks)
  
  // Get actual duration by analyzing the MP3 file metadata
  let actualDuration: number
  try {
    const metadata = await parseBuffer(fullAudio, { mimeType: 'audio/mpeg' })
    actualDuration = Math.round(metadata.format.duration || 0)
    console.log(`✅ Parsed actual MP3 duration: ${actualDuration}s (${Math.floor(actualDuration/60)}:${(actualDuration%60).toString().padStart(2,'0')})`)
  } catch (error) {
    console.log('Could not parse MP3 metadata, using file size estimation')
    // Estimate based on file size and typical MP3 bitrate
    // OpenAI TTS typically generates ~128kbps MP3 = ~16KB per second
    actualDuration = Math.round(fullAudio.length / 16000)
    console.log(`Estimated duration from file size: ${actualDuration}s`)
  }
  
  console.log(`Generated chunked audio successfully - ${audioChunks.length} chunks, size: ${fullAudio.length} bytes, actual duration: ${actualDuration}s`)
  
  return {
    audioBuffer: fullAudio,
    duration: actualDuration
  }
}
