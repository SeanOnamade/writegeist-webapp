import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    console.log('Loading audio library for user:', user.id)

    // Get all chapters for the user with their audio status
    // Note: We only select content_length to calculate preview, not full content to reduce egress
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select(`
        id,
        title,
        content,
        project_id,
        order_index,
        word_count,
        created_at,
        updated_at,
        projects!inner(title, description)
      `)
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })

    if (chaptersError) {
      console.error('Error fetching chapters:', chaptersError)
      return NextResponse.json(
        { error: 'Failed to load chapters' },
        { status: 500 }
      )
    }

    console.log(`Found ${chapters?.length || 0} chapters`)

    // Get audio status for all chapters
    const chapterIds = chapters?.map(ch => ch.id) || []
    
    let audioData: any[] = []
    if (chapterIds.length > 0) {
      const { data: audioRecords, error: audioError } = await supabase
        .from('chapter_audio')
        .select('*')
        .in('chapter_id', chapterIds)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (audioError) {
        console.error('Error fetching audio records:', audioError)
      } else {
        audioData = audioRecords || []
      }
    }

    console.log(`Found ${audioData.length} audio records`)

    // Generate signed URLs for all completed audio files
    const audioWithSignedUrls = await Promise.all(
      audioData
        .filter(a => a.status === 'completed' && a.file_path)
        .map(async (audio) => {
          try {
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from('audio-files')
              .createSignedUrl(audio.file_path, 3600) // 1 hour expiration
            
            if (signedUrlError) {
              console.error('Error generating signed URL for audio:', audio.id, signedUrlError)
              return { ...audio, signedUrl: null }
            }
            
            return {
              ...audio,
              signedUrl: signedUrlData?.signedUrl || null
            }
          } catch (error) {
            console.error('Error generating signed URL for audio:', audio.id, error)
            return { ...audio, signedUrl: null }
          }
        })
    )

    // Combine chapters with their audio status and outdated detection
    const chaptersWithAudio = chapters?.map(chapter => {
      const audio = audioWithSignedUrls.find(a => a.chapter_id === chapter.id) || 
                    audioData.find(a => a.chapter_id === chapter.id)
      
      // Check if audio is outdated (compare content hashes)
      // Note: We skip this check to reduce egress - content is not fetched for library view
      // Outdated status can be checked when generating new audio
      let isOutdated = false
      // Removed outdated check here to reduce egress - content not available in library view
      
      // Don't send full content - only preview to reduce egress
      const { content, ...chapterWithoutContent } = chapter
      
      return {
        ...chapterWithoutContent,
        audio: audio ? { 
          ...audio, 
          isOutdated,
          // Include signedUrl if available, otherwise fallback to audio_url or null
          playUrl: audio.signedUrl || audio.audio_url || null
        } : null,
        project: chapter.projects,
        // Calculate content preview (don't send full content to reduce egress)
        content_preview: content 
          ? content.substring(0, 200) + (content.length > 200 ? '...' : '')
          : 'No content'
      }
    }) || []

// Helper function for text cleaning (same as generation)
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

    // Group by project for better organization
    const projectGroups = chaptersWithAudio.reduce((groups, chapter) => {
      const projectId = chapter.project_id
      if (!groups[projectId]) {
        groups[projectId] = {
          project: chapter.project,
          chapters: []
        }
      }
      groups[projectId].chapters.push(chapter)
      return groups
    }, {} as Record<string, any>)

    // Calculate statistics
    const stats = {
      total_chapters: chaptersWithAudio.length,
      audio_generated: audioData.filter(a => a.status === 'completed').length,
      audio_processing: audioData.filter(a => a.status === 'processing').length,
      audio_pending: chaptersWithAudio.length - audioData.length,
      audio_errors: audioData.filter(a => a.status === 'error').length,
      total_duration: audioData
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.duration || 0), 0),
      total_file_size: audioData
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.file_size || 0), 0)
    }

    console.log('Audio library stats:', stats)

    return NextResponse.json({
      success: true,
      chapters: chaptersWithAudio,
      projects: projectGroups,
      stats
    })

  } catch (error) {
    console.error('Audio library error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
