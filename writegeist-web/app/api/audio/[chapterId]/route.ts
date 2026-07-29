import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/http'

/**
 * DELETE /api/audio/[chapterId] — remove a chapter's audio file and record.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params
    if (!chapterId) {
      return jsonError('Chapter ID is required', 400)
    }

    const { supabase, user } = await requireUser()
    if (!user) {
      return jsonError('Not authenticated', 401)
    }

    const { data: audio, error: audioError } = await supabase
      .from('chapter_audio')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (audioError) {
      console.error('Error fetching audio record:', audioError)
      return jsonError('Failed to fetch audio record', 500)
    }
    if (!audio) {
      return jsonError('Audio file not found', 404)
    }

    // Storage deletion failures don't block record deletion — the file may
    // already be gone.
    if (audio.file_path) {
      const { error: storageError } = await supabase.storage
        .from('audio-files')
        .remove([audio.file_path])
      if (storageError) {
        console.error('Storage deletion error:', storageError)
      }
    }

    const { error: deleteError } = await supabase
      .from('chapter_audio')
      .delete()
      .eq('id', audio.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Database deletion error:', deleteError)
      return jsonError('Failed to delete audio record', 500)
    }

    return NextResponse.json({
      success: true,
      message: 'Audio deleted successfully',
      deleted_file_size: audio.file_size || 0,
    })
  } catch (error) {
    console.error('Audio deletion error:', error)
    return jsonError('Internal server error', 500)
  }
}
