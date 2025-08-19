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

    // Combine chapters with their audio status
    const chaptersWithAudio = chapters?.map(chapter => {
      const audio = audioData.find(a => a.chapter_id === chapter.id)
      
      return {
        ...chapter,
        audio: audio || null,
        project: chapter.projects,
        // Calculate content preview
        content_preview: chapter.content 
          ? chapter.content.substring(0, 200) + (chapter.content.length > 200 ? '...' : '')
          : 'No content'
      }
    }) || []

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
