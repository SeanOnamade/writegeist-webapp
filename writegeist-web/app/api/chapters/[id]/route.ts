import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Get chapter data
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (chapterError || !chapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      )
    }

    // Get full content using storage system if available
    let fullContent = chapter.content || ''
    
    if (chapter.content_file_path) {
      try {
        // Download content directly from storage using existing supabase client
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('chapter-content')
          .download(chapter.content_file_path)

        if (!downloadError && fileData) {
          fullContent = await fileData.text()
          console.log('✅ Loaded FULL content from storage, length:', fullContent.length)
        } else {
          console.error('Storage download error:', downloadError)
          // Fallback to database content
        }
      } catch (error) {
        console.error('Error loading content from storage:', error)
        // Fallback to database content
      }
    }

    // Return chapter with full content
    return NextResponse.json({
      ...chapter,
      content: fullContent
    })

  } catch (error) {
    console.error('Chapter API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
