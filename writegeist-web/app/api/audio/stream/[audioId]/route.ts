import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/http'

/**
 * GET /api/audio/stream/[audioId] — fallback streaming endpoint.
 * Clients should prefer the signed `playUrl` from /api/audio/library, which
 * streams directly from Supabase storage.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    const { audioId } = await params
    const { supabase, user } = await requireUser()
    if (!user) {
      return jsonError('Not authenticated', 401)
    }

    const { data: audio, error: audioError } = await supabase
      .from('chapter_audio')
      .select('*')
      .eq('id', audioId)
      .eq('user_id', user.id)
      .single()

    if (audioError || !audio) {
      return jsonError('Audio file not found', 404)
    }
    if (audio.status !== 'completed' || !audio.file_path) {
      return jsonError('Audio file not ready', 400)
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('audio-files')
      .download(audio.file_path)

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError)
      return jsonError('Failed to load audio file', 500)
    }

    return new NextResponse(fileData.stream(), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': fileData.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Audio stream error:', error)
    return jsonError('Internal server error', 500)
  }
}
