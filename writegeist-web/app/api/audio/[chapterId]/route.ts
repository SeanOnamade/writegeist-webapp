import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/audio/[chapterId]
 * Delete audio for a specific chapter
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params
    
    if (!chapterId) {
      return NextResponse.json(
        { error: 'Chapter ID is required' },
        { status: 400 }
      )
    }
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    console.log('Deleting audio for chapter:', chapterId)

    // Get the audio record to verify ownership and get file path
    const { data: audio, error: audioError } = await supabase
      .from('chapter_audio')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('user_id', user.id)
      .single()

    // Handle case where audio doesn't exist (Supabase returns PGRST116 for .single() with no results)
    if (audioError) {
      // PGRST116 is "no rows returned" - this is expected if audio doesn't exist
      if (audioError.code === 'PGRST116' || audioError.message?.includes('No rows')) {
        return NextResponse.json(
          { error: 'Audio file not found' },
          { status: 404 }
        )
      }
      // Other errors are unexpected
      console.error('Unexpected error fetching audio:', audioError)
      return NextResponse.json(
        { error: 'Failed to fetch audio record' },
        { status: 500 }
      )
    }

    if (!audio) {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      )
    }

    // Delete the audio file from storage if it exists
    let storageDeleted = false
    if (audio.file_path) {
      const { error: storageError } = await supabase.storage
        .from('audio-files')
        .remove([audio.file_path])

      if (storageError) {
        console.error('Storage deletion error:', storageError)
        // Continue with database deletion even if storage deletion fails
        // (file might already be deleted or not exist)
        // This prevents blocking deletion if storage has issues
      } else {
        storageDeleted = true
        console.log('Deleted audio file from storage:', audio.file_path)
      }
    }

    // Delete the database record
    const { error: deleteError } = await supabase
      .from('chapter_audio')
      .delete()
      .eq('id', audio.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Database deletion error:', deleteError)
      // If storage was deleted but database deletion failed, log a warning
      // The file is gone but the record remains (orphaned record)
      if (storageDeleted) {
        console.warn('WARNING: Storage file deleted but database record deletion failed. Orphaned record may exist.')
      }
      return NextResponse.json(
        { error: 'Failed to delete audio record' },
        { status: 500 }
      )
    }

    console.log('Successfully deleted audio for chapter:', chapterId)

    return NextResponse.json({
      success: true,
      message: 'Audio deleted successfully',
      deleted_file_size: audio.file_size || 0
    })

  } catch (error) {
    console.error('Audio deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

