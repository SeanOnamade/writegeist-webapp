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

export async function searchProjectEmbeddings(
  query: string,
  projectId: string,
  userId: string,
  limit = 5
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
    match_threshold: 0.1,
    match_count: limit * 2,
    project_filter: projectId,
  })

  if (!error && results && results.length > 0) {
    return results.slice(0, limit) as EmbeddingSearchResult[]
  }

  const keyTerms = query
    .toLowerCase()
    .replace(/^(who is|what is|tell me about|describe|what happens|how does|where is|when does)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter((term) => term.length > 2)

  const fallbackResults: EmbeddingSearchResult[] = []

  for (const term of keyTerms) {
    const { data: termResults } = await supabase
      .from('document_embeddings')
      .select('id, content_text, chapter_id, project_id, content_type, metadata')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .ilike('content_text', `%${term}%`)
      .limit(Math.max(1, Math.floor(limit / keyTerms.length)))

    if (termResults) {
      fallbackResults.push(
        ...termResults.map((r, index) => ({
          ...r,
          similarity: 0.8 - index * 0.05,
        }))
      )
    }
  }

  const unique = fallbackResults.filter(
    (result, index, self) => index === self.findIndex((r) => r.id === result.id)
  )

  return unique.slice(0, limit)
}
