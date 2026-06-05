import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchProjectEmbeddings } from '@/lib/embeddings/searchProject'

export async function POST(request: NextRequest) {
  try {
    const { query, projectId, limit = 3, userId } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const effectiveUserId = userId || user?.id

    if (!effectiveUserId || !projectId) {
      return NextResponse.json({ results: [] })
    }

    const results = await searchProjectEmbeddings(query, projectId, effectiveUserId, limit)

    return NextResponse.json({
      results,
      query,
      total_found: results.length,
      chunks_found: results.filter((r) => r.content_type === 'chapter_chunk').length,
    })
  } catch (error) {
    console.error('Embedding search error:', error)
    return NextResponse.json({ results: [] })
  }
}
