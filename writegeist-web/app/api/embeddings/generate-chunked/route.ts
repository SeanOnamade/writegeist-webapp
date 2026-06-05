import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { indexChapterEmbeddings } from '@/lib/embeddings/indexProject'

export async function POST(request: NextRequest) {
  try {
    const { chapterId, content, projectId } = await request.json()

    if (!chapterId || !content) {
      return NextResponse.json({ error: 'chapterId and content are required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    let resolvedProjectId = projectId
    let chapterTitle = 'Untitled Chapter'

    if (!resolvedProjectId) {
      const { data: chapter } = await supabase
        .from('chapters')
        .select('project_id, title')
        .eq('id', chapterId)
        .single()

      resolvedProjectId = chapter?.project_id
      chapterTitle = chapter?.title || chapterTitle
    } else {
      const { data: chapter } = await supabase
        .from('chapters')
        .select('title')
        .eq('id', chapterId)
        .single()

      if (chapter?.title) chapterTitle = chapter.title
    }

    if (!resolvedProjectId) {
      return NextResponse.json({ error: 'Project ID could not be resolved' }, { status: 400 })
    }

    const result = await indexChapterEmbeddings(
      chapterId,
      resolvedProjectId,
      user.id,
      content,
      chapterTitle
    )

    return NextResponse.json({
      success: result.chunkCount > 0,
      totalChunks: result.chunkCount,
      successfulEmbeddings: result.chunkCount,
    })
  } catch (error) {
    console.error('Chunked embedding generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
