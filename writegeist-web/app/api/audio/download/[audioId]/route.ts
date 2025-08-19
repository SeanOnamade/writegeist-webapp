import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    console.log('Downloading audio for ID:', audioId)

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
        { error: 'Audio file not ready for download' },
        { status: 400 }
      )
    }

    console.log('Downloading file from storage:', audio.file_path)

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('audio-files')
      .download(audio.file_path)

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download audio file from storage' },
        { status: 500 }
      )
    }

    console.log('File downloaded successfully, size:', fileData.size)

    // Return the file as a response
    return new NextResponse(fileData.stream(), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': fileData.size.toString(),
        'Content-Disposition': `attachment; filename="chapter_${audio.chapter_id}_audio.mp3"`,
        'Cache-Control': 'private, max-age=3600'
      }
    })

  } catch (error) {
    console.error('Audio download error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
