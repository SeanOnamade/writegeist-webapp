import { createServiceRoleClient } from '@/lib/supabase/server'
import { getOpenAIApiKey } from '@/lib/api/openai-key'
import type { Json } from '@/types/database'

export interface EmbeddingSearchResult {
  id: string
  content_text: string
  content_type: string
  similarity: number
  metadata: Json
  chapter_id: string | null
  project_id: string | null
}

const MATCH_THRESHOLD = 0.25
const DEFAULT_LIMIT = 8

export function extractSearchTerms(query: string): string[] {
  const stripped = query
    .replace(/^(who is|what is|tell me about|describe|what happens|how does|where is|when does|what about)\s+/gi, '')
    .trim()

  const terms = new Set<string>()

  for (const match of stripped.match(/\b[A-Z][a-z]+\b/g) || []) {
    terms.add(match)
  }

  for (const word of stripped.toLowerCase().split(/\s+/)) {
    if (word.length > 2) {
      terms.add(word)
    }
  }

  return [...terms]
}

async function vectorSearch(
  query: string,
  projectId: string,
  userId: string,
  limit: number
): Promise<EmbeddingSearchResult[]> {
  const { apiKey } = await getOpenAIApiKey(userId)
  if (!apiKey) return []

  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float',
    }),
  })

  if (!embeddingResponse.ok) return []

  const embeddingData = await embeddingResponse.json()
  const queryEmbedding = embeddingData.data[0].embedding

  const supabase = await createServiceRoleClient()

  const { data: results, error } = await supabase.rpc('search_embeddings', {
    query_embedding: queryEmbedding,
    match_threshold: MATCH_THRESHOLD,
    match_count: limit * 2,
    project_filter: projectId,
  })

  if (error || !results) return []

  return results.slice(0, limit) as EmbeddingSearchResult[]
}

async function keywordSearch(
  query: string,
  projectId: string,
  userId: string,
  limit: number
): Promise<EmbeddingSearchResult[]> {
  const terms = extractSearchTerms(query)
  if (terms.length === 0) return []

  const supabase = await createServiceRoleClient()
  const fallbackResults: EmbeddingSearchResult[] = []
  const perTerm = Math.max(1, Math.floor(limit / terms.length))

  for (const term of terms) {
    const { data: termResults } = await supabase
      .from('document_embeddings')
      .select('id, content_text, chapter_id, project_id, content_type, metadata')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .ilike('content_text', `%${term}%`)
      .limit(perTerm)

    if (termResults) {
      fallbackResults.push(
        ...termResults.map((r, index) => ({
          ...r,
          similarity: 0.55 - index * 0.03,
        }))
      )
    }
  }

  return fallbackResults.filter(
    (result, index, self) => index === self.findIndex((r) => r.id === result.id)
  )
}

function mergeResults(
  vectorResults: EmbeddingSearchResult[],
  keywordResults: EmbeddingSearchResult[],
  limit: number
): EmbeddingSearchResult[] {
  const merged = new Map<string, EmbeddingSearchResult>()

  for (const result of [...vectorResults, ...keywordResults]) {
    const existing = merged.get(result.id)
    if (!existing || result.similarity > existing.similarity) {
      merged.set(result.id, result)
    }
  }

  return [...merged.values()].sort((a, b) => b.similarity - a.similarity).slice(0, limit)
}

export async function searchProjectEmbeddings(
  query: string,
  projectId: string,
  userId: string,
  limit = DEFAULT_LIMIT
): Promise<EmbeddingSearchResult[]> {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(query, projectId, userId, limit),
    keywordSearch(query, projectId, userId, limit),
  ])

  return mergeResults(vectorResults, keywordResults, limit)
}
