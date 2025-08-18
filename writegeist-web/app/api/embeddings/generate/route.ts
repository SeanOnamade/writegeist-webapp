import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { chapterId, content, projectId } = await request.json()
    
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Generate embedding using OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small', // More cost-effective than ada-002
        input: content,
        encoding_format: 'float'
      }),
    })

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text()
      console.error('OpenAI embedding error:', error)
      return NextResponse.json(
        { error: 'Failed to generate embedding' },
        { status: embeddingResponse.status }
      )
    }

    const embeddingData = await embeddingResponse.json()
    const embedding = embeddingData.data[0].embedding

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

    console.log('Attempting to store embedding:')
    console.log('- Chapter ID:', chapterId)
    console.log('- Project ID:', projectId)
    console.log('- User ID:', user.id)
    console.log('- Content length:', content.length)
    console.log('- Embedding length:', embedding.length)

    // Insert new embedding
    const { data: insertData, error: insertError } = await supabase
      .from('document_embeddings')
      .insert({
        content_text: content,
        content_hash: Buffer.from(content).toString('base64').substring(0, 50), // Simple hash
        embedding: embedding,
        chapter_id: chapterId,
        project_id: projectId,
        user_id: user.id,
        content_type: 'chapter',
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'text-embedding-3-small'
        }
      })
      .select()

    if (insertError) {
      console.error('Error storing embedding:', insertError)
      console.error('Insert error details:', JSON.stringify(insertError, null, 2))
      return NextResponse.json(
        { error: 'Failed to store embedding' },
        { status: 500 }
      )
    }

    console.log('Embedding stored successfully:', insertData?.[0]?.id)

    return NextResponse.json({ 
      success: true,
      embeddingLength: embedding.length 
    })

  } catch (error) {
    console.error('Embedding generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
