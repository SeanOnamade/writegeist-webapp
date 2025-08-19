import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { chapterId: string } }
) {
  try {
    const { chapterId } = params
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Get audio status for the chapter
    const { data: audio, error: audioError } = await supabase
      .from('chapter_audio')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (audioError) {
      console.error('Error fetching audio status:', audioError)
      return NextResponse.json(
        { error: 'Failed to get audio status' },
        { status: 500 }
      )
    }

    // Also check queue status if audio is processing
    let queueStatus = null
    if (audio && audio.status === 'processing') {
      const { data: queueItem } = await supabase
        .from('audio_generation_queue')
        .select('*')
        .eq('audio_id', audio.id)
        .eq('user_id', user.id)
        .single()

      queueStatus = queueItem
    }

    return NextResponse.json({
      success: true,
      audio: audio || null,
      queue_status: queueStatus
    })

  } catch (error) {
    console.error('Audio status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
