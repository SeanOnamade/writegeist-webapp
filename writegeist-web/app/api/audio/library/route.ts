import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { jsonError } from '@/lib/api/http'
import { getAudioLibrary } from '@/lib/data/audioLibrary'

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser()
    if (!user) {
      return jsonError('Not authenticated', 401)
    }

    const projectId = request.nextUrl.searchParams.get('project') || undefined
    const library = await getAudioLibrary(supabase, user.id, projectId)
    return NextResponse.json({ success: true, ...library })
  } catch (error) {
    console.error('Audio library error:', error)
    return jsonError('Internal server error', 500)
  }
}
