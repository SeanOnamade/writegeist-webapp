import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/audio/signed-url/[audioId]
 * Generate a signed URL for an audio file (expires in 1 hour)
 * This avoids Vercel egress charges by serving files directly from Supabase
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    const { audioId } = await params
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Get audio record to verify ownership and get file path
    const { data: audio, error: audioError } = await supabase
      .from('chapter_audio')
      .select('*')
      .eq('id', audioId)
      .eq('user_id', user.id)
      .single()

    if (audioError || !audio) {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      )
    }

    if (audio.status !== 'completed' || !audio.file_path) {
      return NextResponse.json(
        { error: 'Audio file not ready' },
        { status: 400 }
      )
    }

    // Generate signed URL (expires in 1 hour = 3600 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('audio-files')
      .createSignedUrl(audio.file_path, 3600)

    if (signedUrlError || !signedUrlData) {
      console.error('Error generating signed URL:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      signedUrl: signedUrlData.signedUrl,
      expiresIn: 3600
    })

  } catch (error) {
    console.error('Signed URL generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

