import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAIApiKey } from '@/lib/api/openai-key'
import { contentChunker } from '@/lib/embeddings/chunking'

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json()

    const { apiKey } = await getOpenAIApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add it in Settings.' },
        { status: 500 }
      )
    }

    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user for embeddings:', userError)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get all chapters for the project
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, title, content, project_id, order_index, content_file_path')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true })

    if (chaptersError) {
      console.error('Error fetching chapters:', chaptersError)
      return NextResponse.json(
        { error: 'Failed to fetch chapters' },
        { status: 500 }
      )
    }

    if (!chapters || chapters.length === 0) {
      return NextResponse.json(
        { error: 'No chapters found for this project' },
        { status: 404 }
      )
    }

    console.log(`Found ${chapters.length} chapters to process`)
    console.log('Chapter details:')
    chapters.forEach((chapter, index) => {
      console.log(`  ${index + 1}. Chapter ${chapter.order_index}: ${chapter.title} (${chapter.id})`)
      console.log(`     Database content length: ${chapter.content?.length || 0}`)
      console.log(`     Has storage path: ${!!chapter.content_file_path}`)
      console.log(`     Storage path: ${chapter.content_file_path}`)
    })

    // Delete existing embeddings for this project
    const { error: deleteError } = await supabase
      .from('document_embeddings')
      .delete()
      .eq('project_id', projectId)

    if (deleteError) {
      console.error('Error deleting existing embeddings:', deleteError)
    } else {
      console.log('Deleted existing embeddings for project')
    }

    // Generate chunked embeddings for each chapter
    const results = []
    let totalChunks = 0
    let chaptersWithContent = 0

    for (const chapter of chapters) {
      try {
        let content = chapter.content

        // If content is not in database, try to load from storage
        if (!content && chapter.content_file_path) {
          try {
            console.log(`Loading content from storage for chapter ${chapter.order_index}: ${chapter.title}`)
            const { data: storageData, error: downloadError } = await supabase.storage
              .from('chapter-content')
              .download(chapter.content_file_path)

            if (downloadError) {
              console.error(`Storage download error for chapter ${chapter.title}:`, downloadError)
            } else if (storageData) {
              content = await storageData.text()
              console.log(`✅ Loaded content from storage: ${content.length} characters`)
            }
          } catch (storageError) {
            console.error(`Error loading from storage for chapter ${chapter.title}:`, storageError)
          }
        }

        if (!content || content.length < 50) {
          console.log(`Skipping chapter ${chapter.title} - no content or too short`)
          continue
        }

        chaptersWithContent++
        console.log(`Processing chapter ${chapter.order_index}: ${chapter.title} (${content.length} chars)`)

        // Chunk the content intelligently
        const chunks = contentChunker.chunk(content, {
          maxChars: 1200, // Smaller chunks for more granular search
          preserveContext: true,
          overlapChars: 150
        })

        console.log(`Created ${chunks.length} chunks for chapter ${chapter.order_index}: ${chapter.title}`)

        // Generate embeddings for each chunk
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex]

          try {
            console.log(`Generating embedding for chunk ${chunkIndex + 1}/${chunks.length} (${chunk.text.length} chars)`)

            const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: chunk.text,
                encoding_format: 'float'
              }),
            })

            if (!embeddingResponse.ok) {
              const errorText = await embeddingResponse.text()
              console.error(`Failed to generate embedding for chunk ${chunkIndex} of chapter ${chapter.title}:`, embeddingResponse.status, errorText)
              continue
            }

            const embeddingData = await embeddingResponse.json()
            const embedding = embeddingData.data[0].embedding

            // Store chunked embedding in database
            const { data: insertData, error: insertError } = await supabase
              .from('document_embeddings')
              .insert({
                content_text: chunk.text,
                content_hash: Buffer.from(chunk.text).toString('base64').substring(0, 50),
                embedding: embedding, // Store as array directly, not JSON string
                chapter_id: chapter.id,
                project_id: projectId,
                user_id: user.id,
                content_type: 'chapter_chunk',
                metadata: {
                  generated_at: new Date().toISOString(),
                  model: 'text-embedding-3-small',
                  chapter_title: chapter.title,
                  chunk_index: chunk.index,
                  chunk_start: chunk.startChar,
                  chunk_end: chunk.endChar,
                  total_chunks: chunks.length,
                  source: 'regenerate_project_hybrid'
                }
              })
              .select()

            if (insertError) {
              console.error(`Error storing embedding for chunk ${chunkIndex} of chapter ${chapter.title}:`, insertError)
              continue
            }

            console.log(`Successfully generated embedding for chunk ${chunkIndex + 1}/${chunks.length} of chapter: ${chapter.title}`)
            totalChunks++

            results.push({
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              chunkIndex: chunkIndex,
              embeddingId: insertData?.[0]?.id,
              contentLength: chunk.text.length,
              embeddingLength: embedding.length
            })

          } catch (error) {
            console.error(`Error processing chunk ${chunkIndex} of chapter ${chapter.title}:`, error)
          }
        }

      } catch (error) {
        console.error(`Error processing chapter ${chapter.title}:`, error)
      }
    }

    console.log(`Successfully generated ${totalChunks} chunked embeddings from ${chaptersWithContent} chapters with content`)

    return NextResponse.json({
      success: true,
      totalChapters: chapters.length,
      chaptersWithContent: chaptersWithContent,
      totalChunks: totalChunks,
      successfulEmbeddings: results.length,
      results: results
    })

  } catch (error) {
    console.error('Project embedding regeneration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
