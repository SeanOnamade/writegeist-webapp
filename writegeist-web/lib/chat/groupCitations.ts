export interface ContextCitation {
  chapterId: string | null
  chapterTitle: string
  similarity: number
  excerpt: string
  excerpts?: string[]
}

export interface GroupedCitation {
  chapterId: string | null
  chapterTitle: string
  bestSimilarity: number
  excerpts: string[]
}

export function groupCitations(citations: ContextCitation[]): GroupedCitation[] {
  const groups = new Map<string, GroupedCitation>()

  for (const citation of citations) {
    const key = citation.chapterId || citation.chapterTitle
    const existing = groups.get(key)

    const citationExcerpts = citation.excerpts?.length
      ? citation.excerpts
      : citation.excerpt
        ? [citation.excerpt]
        : []

    if (!existing) {
      groups.set(key, {
        chapterId: citation.chapterId,
        chapterTitle: citation.chapterTitle,
        bestSimilarity: citation.similarity,
        excerpts: citationExcerpts,
      })
      continue
    }

    existing.bestSimilarity = Math.max(existing.bestSimilarity, citation.similarity)
    for (const excerpt of citationExcerpts) {
      if (!existing.excerpts.includes(excerpt)) {
        existing.excerpts.push(excerpt)
      }
    }
  }

  return [...groups.values()].sort((a, b) => b.bestSimilarity - a.bestSimilarity)
}

export function dedupeCitationsForDisplay(citations: ContextCitation[]): ContextCitation[] {
  return groupCitations(citations).map((group) => ({
    chapterId: group.chapterId,
    chapterTitle: group.chapterTitle,
    similarity: group.bestSimilarity,
    excerpt: group.excerpts[0] || '',
  }))
}
