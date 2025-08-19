import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAIApiKey } from '@/lib/api/openai-key'

export async function POST(request: NextRequest) {
  try {
    const { query, projectId, limit = 3 } = await request.json()
    
    const { apiKey } = await getOpenAIApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add it in Settings.' },
        { status: 500 }
      )
    }

    // Generate embedding for the query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
        encoding_format: 'float'
      }),
    })

    if (!embeddingResponse.ok) {
      console.error('Failed to generate query embedding')
      return NextResponse.json({ results: [] })
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // Search for similar embeddings using vector similarity
    const supabase = await createClient()
    
    // First, let's check if we have any embeddings at all (force fresh query)
    const { data: allEmbeddings } = await supabase
      .from('document_embeddings')
      .select('id, content_text, project_id, user_id, chapter_id, content_type, metadata, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50)

    console.log('Total embeddings for project:', allEmbeddings?.length || 0)
    if (allEmbeddings && allEmbeddings.length > 0) {
      console.log('Sample embedding content:', allEmbeddings[0].content_text?.substring(0, 100))
      console.log('Sample embedding project_id:', allEmbeddings[0].project_id)
      console.log('Sample embedding user_id:', allEmbeddings[0].user_id)
      console.log('Sample embedding chapter_id:', allEmbeddings[0].chapter_id)
      console.log('Sample embedding content_type:', allEmbeddings[0].content_type)
      console.log('All embedding types:', allEmbeddings.map(e => e.content_type))
      console.log('All chapter IDs:', [...new Set(allEmbeddings.map(e => e.chapter_id))])
      console.log('Chunked embeddings count:', allEmbeddings.filter(e => e.content_type === 'chapter_chunk').length)
      console.log('Regular embeddings count:', allEmbeddings.filter(e => e.content_type === 'chapter').length)
      
      // Show recent chunked embeddings
      const recentChunked = allEmbeddings.filter(e => e.content_type === 'chapter_chunk').slice(0, 3)
      if (recentChunked.length > 0) {
        console.log('Recent chunked embedding sample:', recentChunked[0].content_text?.substring(0, 100))
        console.log('Recent chunked embedding created_at:', recentChunked[0].created_at)
      }
    }

    // Also check ALL embeddings regardless of project  
    const { data: allEmbeddingsGlobal } = await supabase
      .from('document_embeddings')
      .select('id, content_text, project_id, user_id, chapter_id, content_type, created_at')
      .order('created_at', { ascending: false })
      .limit(30)

    console.log('Total embeddings globally:', allEmbeddingsGlobal?.length || 0)
    if (allEmbeddingsGlobal && allEmbeddingsGlobal.length > 0) {
      console.log('Global embeddings project IDs:', allEmbeddingsGlobal.map(e => e.project_id))
      console.log('Global chunked embeddings:', allEmbeddingsGlobal.filter(e => e.content_type === 'chapter_chunk').length)
      
      // Show most recent embeddings
      const recentEmbeddings = allEmbeddingsGlobal.slice(0, 5)
      console.log('Most recent embeddings:')
      recentEmbeddings.forEach((e, i) => {
        console.log(`  ${i+1}. Type: ${e.content_type}, Project: ${e.project_id}, Chapter: ${e.chapter_id}`)
      })
    }

    // Try with no project filter first to see if embeddings exist at all
    const { data: allResults } = await supabase
      .rpc('search_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1,
        match_count: limit,
        project_filter: null // No project filter
      })

    console.log('Search without project filter:', allResults?.length || 0)

               const { data: results, error } = await supabase
             .rpc('search_embeddings', {
               query_embedding: queryEmbedding,
               match_threshold: 0.1, // Much lower threshold to catch more results
               match_count: limit * 4, // Get even more results to find best matches
               project_filter: projectId
             })

    console.log('Vector search results:', results?.length || 0)
    if (results && results.length > 0) {
      console.log('Best match similarity:', results[0].similarity)
      console.log('Best match content preview:', results[0].content_text?.substring(0, 100))
    }

    if (error) {
      console.error('Error searching embeddings:', error)
      return NextResponse.json({ results: [] })
    }

               // Process and combine chunk results
           const processedResults = results || []
           
           // If we have chunked results, combine them intelligently
           const combinedResults = processedResults.slice(0, limit).map(result => {
             // Add chunk information to metadata
             const isChunk = result.content_type === 'chapter_chunk'
             return {
               ...result,
               is_chunk: isChunk,
               chunk_info: isChunk ? {
                 chunk_index: result.metadata?.chunk_index,
                 total_chunks: result.metadata?.total_chunks,
                 chunk_start: result.metadata?.chunk_start,
                 chunk_end: result.metadata?.chunk_end
               } : null
             }
           })

           console.log('Processed results with chunk info:', combinedResults.length)

           return NextResponse.json({ 
             results: combinedResults,
             query: query,
             total_found: processedResults.length,
             chunks_found: processedResults.filter(r => r.content_type === 'chapter_chunk').length
           })

  } catch (error) {
    console.error('Embedding search error:', error)
    return NextResponse.json({ results: [] })
  }
}
