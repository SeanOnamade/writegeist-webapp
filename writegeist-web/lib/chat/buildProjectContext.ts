import { createServiceRoleClient } from '@/lib/supabase/server'
import { loadChapterRowContent } from '@/lib/data/chapters'
import { searchProjectEmbeddings, type EmbeddingSearchResult } from '@/lib/embeddings/searchProject'
import { hasProjectEmbeddings, indexProjectEmbeddings } from '@/lib/embeddings/indexProject'
import {
  getTargetChapterOrder,
  isOpeningOrSummaryQuery,
  isSpeculativeQuery,
  isThematicQuery,
} from '@/lib/chat/queryIntent'

export interface ContextCitation {
  chapterId: string | null
  chapterTitle: string
  similarity: number
  excerpt: string
  excerpts?: string[]
}

export interface BuildProjectContextResult {
  context: string
  projectTitle: string
  citations: ContextCitation[]
  indexed: boolean
  indexing: boolean
  hasContent: boolean
  confidence: 'high' | 'low'
  isSummary: boolean
  isThematic: boolean
  isSpeculative: boolean
}

const OPENING_EXCERPT_CHARS = 2500

const MAX_CONTEXT_LENGTH = 12000

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

function appendChapterExcerpts(
  context: string,
  citations: ContextCitation[],
  chapters: Array<{ id: string; order_index: number; title: string; content: string }>,
  sectionTitle: string,
  baseSimilarity = 0.85,
  maxChars = OPENING_EXCERPT_CHARS
): string {
  let updated = `${context}\n=== ${sectionTitle} ===\n`

  for (const chapter of chapters) {
    const excerpt = chapter.content.substring(0, maxChars)
    const chapterTitle = `Chapter ${chapter.order_index}: ${chapter.title}`
    updated += `\n=== ${chapterTitle.toUpperCase()} ===\n${excerpt}`
    if (chapter.content.length > maxChars) {
      updated += '\n...[content truncated]...'
    }
    updated += '\n'

    citations.push({
      chapterId: chapter.id,
      chapterTitle,
      similarity: baseSimilarity - (chapter.order_index - 1) * 0.03,
      excerpt: excerpt.substring(0, 120),
    })
  }

  return updated
}

function dedupeCitationsByChapter(citations: ContextCitation[]): ContextCitation[] {
  const groups = new Map<string, ContextCitation>()

  for (const citation of citations) {
    const key = citation.chapterId || citation.chapterTitle
    const existing = groups.get(key)

    if (!existing) {
      groups.set(key, {
        ...citation,
        excerpts: citation.excerpt ? [citation.excerpt] : [],
      })
      continue
    }

    existing.similarity = Math.max(existing.similarity, citation.similarity)
    if (citation.excerpt && !existing.excerpts?.includes(citation.excerpt)) {
      existing.excerpts = [...(existing.excerpts || []), citation.excerpt]
    }
  }

  return [...groups.values()].sort((a, b) => b.similarity - a.similarity)
}

export async function buildProjectContext(
  searchQuery: string,
  projectId: string,
  userId: string,
  latestUserQuery = ''
): Promise<BuildProjectContextResult> {
  const supabase = await createServiceRoleClient()

  const { data: project } = await supabase
    .from('projects')
    .select('title, description')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  // Ownership gate: never build context (or run embedding search) for a
  // project that doesn't exist or belongs to another user.
  if (!project) {
    return {
      context: '',
      projectTitle: 'Untitled Project',
      citations: [],
      indexed: false,
      indexing: false,
      hasContent: false,
      confidence: 'low',
      isSummary: false,
      isThematic: false,
      isSpeculative: false,
    }
  }

  const projectTitle = project.title || 'Untitled Project'
  let context = `Project: ${projectTitle}\n`
  if (project?.description) {
    context += `Description: ${project.description}\n`
  }

  const indexed = await hasProjectEmbeddings(projectId, userId)
  let indexing = false

  if (!indexed) {
    // Indexing normally happens on chapter save; this backfills older projects
    // without blocking the request. This response falls back to raw chapter
    // excerpts; the next one uses embeddings.
    indexing = true
    void indexProjectEmbeddings(projectId, userId).catch((error) =>
      console.error('Background project indexing failed:', error)
    )
  }

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, title, content, order_index, content_file_path')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('order_index', { ascending: true })

  const loaded = await Promise.all(
    (chapters ?? []).map(async (chapter) => ({
      id: chapter.id,
      order_index: chapter.order_index,
      title: chapter.title,
      content: await loadChapterRowContent(supabase, chapter),
    }))
  )
  const chaptersWithContent = loaded.filter((chapter) => chapter.content)

  const citations: ContextCitation[] = []
  let searchResults: EmbeddingSearchResult[] = []
  const intentQuery = latestUserQuery.trim() || searchQuery
  const isSummary = isOpeningOrSummaryQuery(intentQuery)
  const isThematic = isThematicQuery(intentQuery)
  const isSpeculative = isSpeculativeQuery(intentQuery)
  const targetChapterOrder = getTargetChapterOrder(intentQuery)

  if (isSummary && chaptersWithContent.length > 0) {
    const openingChapters = chaptersWithContent
      .filter((c) => c.order_index <= 3)
      .sort((a, b) => a.order_index - b.order_index)
    context = appendChapterExcerpts(
      context,
      citations,
      openingChapters,
      'OPENING CHAPTERS (for summary)',
      0.9
    )
  } else if (targetChapterOrder !== null) {
    const targetChapter = chaptersWithContent.find((c) => c.order_index === targetChapterOrder)
    if (targetChapter) {
      context = appendChapterExcerpts(
        context,
        citations,
        [targetChapter],
        `CHAPTER ${targetChapterOrder} CONTENT`,
        0.9
      )
    }
  } else if (isThematic && chaptersWithContent.length > 0) {
    const earlyChapters = chaptersWithContent
      .filter((c) => c.order_index <= 6)
      .sort((a, b) => a.order_index - b.order_index)
    context = appendChapterExcerpts(
      context,
      citations,
      earlyChapters,
      'EARLY CHAPTERS (for thematic analysis)',
      0.75,
      1200
    )
    if (searchQuery.trim() && indexed) {
      searchResults = await searchProjectEmbeddings(searchQuery, projectId, userId, 8)
    }
  } else if (searchQuery.trim() && indexed) {
    searchResults = await searchProjectEmbeddings(searchQuery, projectId, userId, 8)
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

  const displayCitations = dedupeCitationsByChapter(citations)
  const maxSimilarity = displayCitations.length > 0
    ? Math.max(...displayCitations.map((c) => c.similarity))
    : 0
  const confidence: 'high' | 'low' = maxSimilarity >= 0.4 ? 'high' : 'low'

  const boostedConfidence: 'high' | 'low' =
    (isSummary || isThematic) && displayCitations.length > 0 ? 'high' : confidence

  return {
    context: truncateContext(context),
    projectTitle,
    citations: displayCitations,
    indexed,
    indexing,
    hasContent: chaptersWithContent.length > 0 || indexed,
    confidence: boostedConfidence,
    isSummary,
    isThematic,
    isSpeculative,
  }
}
