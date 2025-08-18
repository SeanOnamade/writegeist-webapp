import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { contentChunker } from '@/lib/embeddings/chunking'
import OpenAI from 'openai'

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

    console.log('Generating chunked embeddings...')
    console.log('Chapter ID:', chapterId)
    console.log('Project ID:', projectId)
    console.log('Content length:', content.length)

    // Chunk the content intelligently
    const chunks = contentChunker.chunk(content, {
      maxChars: 1800,
      preserveContext: true,
      overlapChars: 200
    })

    console.log(`Created ${chunks.length} chunks for embedding`)

    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user for embeddings:', userError)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }
    
    // Delete any existing embeddings for this chapter
    const { error: deleteError } = await supabase
      .from('document_embeddings')
      .delete()
      .eq('chapter_id', chapterId)
      
    if (deleteError) {
      console.error('Error deleting existing embeddings:', deleteError)
    } else {
      console.log('Successfully deleted existing embeddings for chapter:', chapterId)
    }

    console.log('Deleted existing embeddings, generating new chunked embeddings...')

    // Generate embeddings for each chunk
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const embeddingPromises = chunks.map(async (chunk, index) => {
      try {
        console.log(`Generating embedding for chunk ${index + 1}/${chunks.length} (${chunk.text.length} chars)`)
        
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.text,
        })
        const embedding = embeddingResponse.data[0].embedding

        // Store embedding in database
        const { data: insertData, error: insertError } = await supabase
          .from('document_embeddings')
          .insert({
            content_text: chunk.text,
            content_hash: Buffer.from(chunk.text).toString('base64').substring(0, 50),
            embedding: embedding,
            chapter_id: chapterId,
            project_id: projectId,
            user_id: user.id,
            content_type: 'chapter_chunk',
            metadata: {
              generated_at: new Date().toISOString(),
              model: 'text-embedding-3-small',
              chunk_index: chunk.index,
              chunk_start: chunk.startChar,
              chunk_end: chunk.endChar,
              total_chunks: chunks.length,
              source: 'chunked'
            }
          })
          .select()

        if (insertError) {
          console.error(`Error storing embedding for chunk ${index}:`, insertError)
          return null
        }

        console.log(`Chunk ${index + 1} embedding stored:`, insertData?.[0]?.id)
        return insertData?.[0]
      } catch (error) {
        console.error(`Error processing chunk ${index}:`, error)
        return null
      }
    })

    // Wait for all embeddings to complete
    const results = await Promise.all(embeddingPromises)
    const successful = results.filter(r => r !== null)

    console.log(`Successfully generated ${successful.length}/${chunks.length} chunked embeddings`)

    return NextResponse.json({ 
      success: true,
      totalChunks: chunks.length,
      successfulEmbeddings: successful.length,
      embeddingIds: successful.map(r => r.id),
      chunkSizes: chunks.map(c => c.text.length)
    })

  } catch (error) {
    console.error('Chunked embedding generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
