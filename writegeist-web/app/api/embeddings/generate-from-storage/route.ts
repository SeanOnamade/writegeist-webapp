import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chapterContentStorage } from '@/lib/storage/chapterContent'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const { chapterId, projectId, filePath } = await request.json()
    
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    console.log('Generating embeddings from storage file...')
    console.log('Chapter ID:', chapterId)
    console.log('Project ID:', projectId)
    console.log('File Path:', filePath)

    // Load content from storage
    const content = await chapterContentStorage.loadChapterContent(chapterId)
    if (!content) {
      return NextResponse.json(
        { error: 'Could not load content from storage' },
        { status: 404 }
      )
    }

    console.log('Loaded content length:', content.length)

    // Generate embedding using OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: content,
    })
    const embedding = embeddingResponse.data[0].embedding

    // Store embedding in database
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user for embeddings:', userError)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }
    
    // First, delete any existing embedding for this chapter
    await supabase
      .from('document_embeddings')
      .delete()
      .eq('chapter_id', chapterId)

    console.log('Storing embedding for storage-based content...')

    // Insert new embedding
    const { data: insertData, error: insertError } = await supabase
      .from('document_embeddings')
      .insert({
        content_text: content,
        content_hash: Buffer.from(content).toString('base64').substring(0, 50),
        embedding: embedding,
        chapter_id: chapterId,
        project_id: projectId,
        user_id: user.id,
        content_type: 'chapter',
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'text-embedding-3-small',
          source: 'storage',
          file_path: filePath
        }
      })
      .select()

    if (insertError) {
      console.error('Error storing embedding:', insertError)
      return NextResponse.json(
        { error: 'Failed to store embedding' },
        { status: 500 }
      )
    }

    console.log('Storage-based embedding stored successfully:', insertData?.[0]?.id)

    return NextResponse.json({ 
      success: true,
      embeddingLength: embedding.length,
      contentLength: content.length,
      source: 'storage'
    })

  } catch (error) {
    console.error('Storage embedding generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

