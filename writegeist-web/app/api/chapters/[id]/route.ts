import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/http'
import { getChapter } from '@/lib/data/chapters'

/**
 * GET /api/chapters/[id] — chapter with full content (resolved from the
 * chapter-content storage bucket when present).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    if (!user) {
      return jsonError('Not authenticated', 401)
    }

    const chapter = await getChapter(supabase, id)
    if (!chapter) {
      return jsonError('Chapter not found', 404)
    }

    return NextResponse.json(chapter)
  } catch (error) {
    console.error('Chapter API error:', error)
    return jsonError('Internal server error', 500)
  }
}
