import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAIApiKey } from '@/lib/api/openai-key'

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
      .select('id, title, content, project_id, content_file_path')
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

    // Generate embeddings for each chapter
    const results = []
    for (const chapter of chapters) {
      try {
        console.log(`Processing chapter: ${chapter.title} (${chapter.id})`)
        
        let content = chapter.content
        
        // If content is not in database, try to load from storage
        if (!content && chapter.content_file_path) {
          try {
            const { data: storageData } = await supabase.storage
              .from('chapter-content')
              .download(chapter.content_file_path)
            
            if (storageData) {
              content = await storageData.text()
              console.log(`Loaded content from storage: ${content.length} characters`)
            }
          } catch (storageError) {
            console.error('Error loading from storage:', storageError)
          }
        }

        if (!content || content.length < 50) {
          console.log(`Skipping chapter ${chapter.title} - no content or too short`)
          continue
        }

        // Generate embedding using OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: content,
            encoding_format: 'float'
          }),
        })

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text()
          console.error(`Failed to generate embedding for chapter ${chapter.title}:`, embeddingResponse.status, errorText)
          continue
        }

        const embeddingData = await embeddingResponse.json()
        const embedding = embeddingData.data[0].embedding

        // Store embedding in database - use the embedding array directly for vector type
        const { data: insertData, error: insertError } = await supabase
          .from('document_embeddings')
          .insert({
            content_text: content,
            content_hash: Buffer.from(content).toString('base64').substring(0, 50),
            embedding: embedding, // Store as array directly, not JSON string
            chapter_id: chapter.id,
            project_id: projectId,
            user_id: user.id,
            content_type: 'chapter',
            metadata: {
              generated_at: new Date().toISOString(),
              model: 'text-embedding-3-small',
              chapter_title: chapter.title,
              source: 'regenerate_project'
            }
          })
          .select()

        if (insertError) {
          console.error(`Error storing embedding for chapter ${chapter.title}:`, insertError)
          continue
        }

        console.log(`Successfully generated embedding for chapter: ${chapter.title}`)
        results.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          embeddingId: insertData?.[0]?.id,
          contentLength: content.length,
          embeddingLength: embedding.length
        })

      } catch (error) {
        console.error(`Error processing chapter ${chapter.title}:`, error)
      }
    }

    console.log(`Successfully generated ${results.length}/${chapters.length} embeddings`)

    return NextResponse.json({ 
      success: true,
      totalChapters: chapters.length,
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
