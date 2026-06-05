import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { indexProjectEmbeddings } from '@/lib/embeddings/indexProject'

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json()

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const result = await indexProjectEmbeddings(projectId, user.id)

    return NextResponse.json({
      success: result.indexed,
      totalChapters: result.totalChapters,
      chaptersWithContent: result.chaptersWithContent,
      totalChunks: result.totalChunks,
      successfulEmbeddings: result.totalChunks,
    })
  } catch (error) {
    console.error('Project embedding regeneration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
