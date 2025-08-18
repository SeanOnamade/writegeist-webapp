import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { query, projectId, userId } = await request.json()
    
    console.log('Chat context request:')
    console.log('- Query:', query)
    console.log('- Project ID:', projectId)
    console.log('- User ID:', userId)
    
    const supabase = await createClient()
    
    // First, try to get relevant context from the project
    let context = ""
    let fallbackChapters: any[] = []
    
    if (projectId) {
      // Get project details
      const { data: project } = await supabase
        .from('projects')
        .select('title, description')
        .eq('id', projectId)
        .single()
      
      if (project) {
        context += `Project: ${project.title}\n`
        if (project.description) {
          context += `Description: ${project.description}\n`
        }
      }
      
      // Get recent chapters from this project
      const { data: chapters } = await supabase
        .from('chapters')
        .select('title, content, order_index')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true })
        .limit(5)
      
      // Store chapters for fallback use
      fallbackChapters = chapters || []
      
      if (chapters && chapters.length > 0) {
        context += "\nChapter Content:\n"
        chapters.forEach(chapter => {
          context += `\n=== Chapter ${chapter.order_index}: ${chapter.title} ===\n`
          if (chapter.content) {
            // Include reasonable excerpt - up to 800 characters per chapter
            const excerpt = chapter.content.substring(0, 800)
            context += `${excerpt}${chapter.content.length > 800 ? '\n...[content truncated]...' : ''}\n`
          }
        })
        context += "\n"
      }
      
      // Get related ideas
      const { data: ideas } = await supabase
        .from('ideas')
        .select('title, content, tags')
        .eq('project_id', projectId)
        .limit(3)
      
      if (ideas && ideas.length > 0) {
        context += "\nRelated Ideas:\n"
        ideas.forEach(idea => {
          context += `- ${idea.title}: ${idea.content}\n`
          if (idea.tags && idea.tags.length > 0) {
            context += `  Tags: ${idea.tags.join(', ')}\n`
          }
        })
      }
    }
    
    // Use vector search to find the most relevant content
    if (projectId && query.trim()) {
      try {
        const searchResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/embeddings/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: query,
            projectId: projectId,
            limit: 3
          })
        })
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
                     if (searchData.results && searchData.results.length > 0) {
             context += "\n=== MOST RELEVANT CONTENT (Vector Search) ===\n"
             searchData.results.forEach((result: any, index: number) => {
               context += `\nRelevant Content ${index + 1} (${Math.round(result.similarity * 100)}% match):\n`
               context += `${result.content_text}\n`
             })
             context += "\n"
             console.log('Vector search found', searchData.results.length, 'results')
             console.log('First result similarity:', searchData.results[0]?.similarity)
             console.log('First result preview:', searchData.results[0]?.content_text?.substring(0, 200))
           } else {
             console.log('No vector search results found - falling back to direct chapter content')
             // Fallback: if no embeddings found, use the chapter content directly
             if (fallbackChapters && fallbackChapters.length > 0) {
               context += "\n=== CHAPTER CONTENT (Fallback) ===\n"
               fallbackChapters.forEach(chapter => {
                 if (chapter.content) {
                   context += `\n=== Chapter ${chapter.order_index}: ${chapter.title} ===\n`
                   context += `${chapter.content}\n`
                 }
               })
               context += "\n"
             }
           }
        }
      } catch (error) {
        console.error('Error performing vector search:', error)
        // Fallback: if vector search fails, use chapter content directly (truncated)
        if (fallbackChapters && fallbackChapters.length > 0) {
          context += "\n=== CHAPTER CONTENT (Fallback) ===\n"
          fallbackChapters.forEach(chapter => {
            if (chapter.content) {
              context += `\n=== Chapter ${chapter.order_index}: ${chapter.title} ===\n`
              // Limit fallback content to 1000 characters per chapter
              const excerpt = chapter.content.substring(0, 1000)
              context += `${excerpt}${chapter.content.length > 1000 ? '\n...[content truncated]...' : ''}\n`
            }
          })
          context += "\n"
        }
      }
    }
    
    // Smart context truncation to stay under token limits
    const MAX_CONTEXT_LENGTH = 12000 // ~3000 tokens, better balance
    if (context.length > MAX_CONTEXT_LENGTH) {
      // Smarter truncation - keep project info and recent content
      const lines = context.split('\n')
      const projectInfo = lines.slice(0, 10).join('\n') // Keep project details
      const remainingLength = MAX_CONTEXT_LENGTH - projectInfo.length - 200
      
      if (remainingLength > 0) {
        const contentLines = lines.slice(10)
        let truncatedContent = ""
        let currentLength = 0
        
        // Add content until we hit the limit
        for (const line of contentLines) {
          if (currentLength + line.length < remainingLength) {
            truncatedContent += line + '\n'
            currentLength += line.length + 1
          } else {
            break
          }
        }
        
        context = projectInfo + '\n' + truncatedContent + '\n\n...[Additional content truncated to fit token limits]...'
      } else {
        context = projectInfo + '\n\n...[Content truncated to fit token limits]...'
      }
    }
    
    console.log('Final context being sent to AI:')
    console.log('Context length:', context.length)
    console.log('Context preview:', context.substring(0, 500))
    
    return NextResponse.json({ context })
    
  } catch (error) {
    console.error('Error getting chat context:', error)
    return NextResponse.json({ context: "" })
  }
}
