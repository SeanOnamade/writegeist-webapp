import { NextRequest, NextResponse } from 'next/server'
import { buildProjectContext } from '@/lib/chat/buildProjectContext'

export async function POST(request: NextRequest) {
  try {
    const { query, projectId, userId } = await request.json()

    if (!projectId || !userId) {
      return NextResponse.json({ context: '', citations: [] })
    }

    const result = await buildProjectContext(query || '', projectId, userId)

    return NextResponse.json({
      context: result.context,
      citations: result.citations,
      indexed: result.indexed,
      hasContent: result.hasContent,
      projectTitle: result.projectTitle,
    })
  } catch (error) {
    console.error('Error getting chat context:', error)
    return NextResponse.json({ context: '', citations: [] })
  }
}
