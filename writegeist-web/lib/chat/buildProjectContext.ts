import { createServiceRoleClient } from '@/lib/supabase/server'
import { searchProjectEmbeddings, type EmbeddingSearchResult } from '@/lib/embeddings/searchProject'
import { hasProjectEmbeddings, indexProjectEmbeddings } from '@/lib/embeddings/indexProject'

export interface ContextCitation {
  chapterId: string | null
  chapterTitle: string
  similarity: number
  excerpt: string
}

export interface BuildProjectContextResult {
  context: string
  projectTitle: string
  citations: ContextCitation[]
  indexed: boolean
  indexing: boolean
  hasContent: boolean
}

const MAX_CONTEXT_LENGTH = 12000

async function loadChapterContent(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  chapter: { content: string; content_file_path: string | null }
): Promise<string> {
  let content = chapter.content || ''

  if (!content && chapter.content_file_path) {
    const { data: storageData, error } = await supabase.storage
      .from('chapter-content')
      .download(chapter.content_file_path)

    if (!error && storageData) {
      content = await storageData.text()
    }
  }

  return content
}

function truncateContext(context: string): string {
  if (context.length <= MAX_CONTEXT_LENGTH) return context

  const lines = context.split('\n')
  const projectInfo = lines.slice(0, 10).join('\n')
  const remainingLength = MAX_CONTEXT_LENGTH - projectInfo.length - 200
  let truncatedContent = ''
  let currentLength = 0

  for (const line of lines.slice(10)) {
    if (currentLength + line.length < remainingLength) {
      truncatedContent += line + '\n'
      currentLength += line.length + 1
    } else {
      break
    }
  }

  return `${projectInfo}\n${truncatedContent}\n\n...[Additional content truncated to fit token limits]...`
}

function buildFallbackContext(
  chapters: Array<{ order_index: number; title: string; content: string }>
): string {
  let context = '\n=== CHAPTER CONTENT (Fallback) ===\n'
  for (const chapter of chapters) {
    if (!chapter.content) continue
    context += `\n=== Chapter ${chapter.order_index}: ${chapter.title} ===\n`
    const excerpt = chapter.content.substring(0, 1000)
    context += `${excerpt}${chapter.content.length > 1000 ? '\n...[content truncated]...' : ''}\n`
  }
  return context + '\n'
}

export async function buildProjectContext(
  query: string,
  projectId: string,
  userId: string
): Promise<BuildProjectContextResult> {
  const supabase = await createServiceRoleClient()

  const { data: project } = await supabase
    .from('projects')
    .select('title, description')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  const projectTitle = project?.title || 'Untitled Project'
  let context = `Project: ${projectTitle}\n`
  if (project?.description) {
    context += `Description: ${project.description}\n`
  }

  let indexed = await hasProjectEmbeddings(projectId, userId)
  let indexing = false

  if (!indexed) {
    indexing = true
    const indexResult = await indexProjectEmbeddings(projectId, userId)
    indexed = indexResult.indexed
    indexing = false
  }

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, title, content, order_index, content_file_path')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('order_index', { ascending: true })

  const chaptersWithContent: Array<{
    id: string
    order_index: number
    title: string
    content: string
  }> = []

  if (chapters) {
    for (const chapter of chapters) {
      const content = await loadChapterContent(supabase, chapter)
      if (content) {
        chaptersWithContent.push({
          id: chapter.id,
          order_index: chapter.order_index,
          title: chapter.title,
          content,
        })
      }
    }
  }

  const citations: ContextCitation[] = []
  let searchResults: EmbeddingSearchResult[] = []

  if (query.trim() && indexed) {
    searchResults = await searchProjectEmbeddings(query, projectId, userId, 5)
  }

  if (searchResults.length > 0) {
    const chapterIds = [...new Set(searchResults.map((r) => r.chapter_id).filter(Boolean))] as string[]
    const { data: chapterDetails } = await supabase
      .from('chapters')
      .select('id, title, order_index')
      .in('id', chapterIds)

    context += '\n=== MOST RELEVANT EXCERPTS (from your manuscript) ===\n'

    const resultsByChapter = new Map<string, EmbeddingSearchResult[]>()
    for (const result of searchResults) {
      const chapterId = result.chapter_id || 'unknown'
      if (!resultsByChapter.has(chapterId)) {
        resultsByChapter.set(chapterId, [])
      }
      resultsByChapter.get(chapterId)!.push(result)
    }

    resultsByChapter.forEach((results, chapterId) => {
      const chapterInfo = chapterDetails?.find((c) => c.id === chapterId)
      const chapterTitle = chapterInfo
        ? `Chapter ${chapterInfo.order_index}: ${chapterInfo.title}`
        : 'Unknown Chapter'

      context += `\n=== FROM ${chapterTitle.toUpperCase()} ===\n`
      for (const result of results) {
        context += `${result.content_text}\n`
        citations.push({
          chapterId: result.chapter_id,
          chapterTitle,
          similarity: result.similarity,
          excerpt: result.content_text.substring(0, 120),
        })
      }
      context += '\n'
    })
  } else if (chaptersWithContent.length > 0) {
    context += buildFallbackContext(chaptersWithContent)
  }

  return {
    context: truncateContext(context),
    projectTitle,
    citations,
    indexed,
    indexing,
    hasContent: chaptersWithContent.length > 0 || indexed,
  }
}
