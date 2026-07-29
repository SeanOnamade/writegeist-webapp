import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/server'
import { jsonError, parseBody } from '@/lib/api/http'
import { indexChapterEmbeddings } from '@/lib/embeddings/indexProject'

const bodySchema = z.object({
  chapterId: z.string().min(1),
  content: z.string().min(1),
  projectId: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser()
    if (!user) {
      return jsonError('Not authenticated', 401)
    }

    const body = await parseBody(request, bodySchema)
    if (!body.ok) return body.response
    const { chapterId, content, projectId } = body.data

    // Resolve the project and title from the chapter row (RLS scopes to user).
    const { data: chapter } = await supabase
      .from('chapters')
      .select('project_id, title')
      .eq('id', chapterId)
      .single()

    const resolvedProjectId = projectId ?? chapter?.project_id
    const chapterTitle = chapter?.title || 'Untitled Chapter'

    if (!chapter || !resolvedProjectId) {
      return jsonError('Chapter not found', 404)
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
    return jsonError('Internal server error', 500)
  }
}
