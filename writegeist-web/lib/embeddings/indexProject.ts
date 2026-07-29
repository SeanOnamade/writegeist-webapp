import { createServiceRoleClient } from '@/lib/supabase/server'
import { getOpenAIApiKey } from '@/lib/api/provider-keys'
import { loadChapterRowContent } from '@/lib/data/chapters'
import { contentChunker } from '@/lib/embeddings/chunking'

export const CHUNK_MAX_CHARS = 1200
export const CHUNK_OVERLAP = 150

export interface IndexProjectResult {
  indexed: boolean
  totalChapters: number
  chaptersWithContent: number
  totalChunks: number
}

export interface IndexChapterResult {
  chunkCount: number
}

export async function indexChapterEmbeddings(
  chapterId: string,
  projectId: string,
  userId: string,
  content: string,
  chapterTitle = 'Untitled Chapter'
): Promise<IndexChapterResult> {
  const supabase = await createServiceRoleClient()
  const { apiKey } = await getOpenAIApiKey(userId)

  if (!apiKey || !content || content.length < 50) {
    return { chunkCount: 0 }
  }

  await supabase
    .from('document_embeddings')
    .delete()
    .eq('chapter_id', chapterId)
    .eq('user_id', userId)

  const chunks = contentChunker.chunk(content, {
    maxChars: CHUNK_MAX_CHARS,
    preserveContext: true,
    overlapChars: CHUNK_OVERLAP,
  })

  let chunkCount = 0

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]

    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: chunk.text,
        encoding_format: 'float',
      }),
    })

    if (!embeddingResponse.ok) continue

    const embeddingData = await embeddingResponse.json()
    const embedding = embeddingData.data[0].embedding

    const { error: insertError } = await supabase.from('document_embeddings').insert({
      content_text: chunk.text,
      content_hash: Buffer.from(chunk.text).toString('base64').substring(0, 50),
      embedding,
      chapter_id: chapterId,
      project_id: projectId,
      user_id: userId,
      content_type: 'chapter_chunk',
      metadata: {
        generated_at: new Date().toISOString(),
        model: 'text-embedding-3-small',
        chapter_title: chapterTitle,
        chunk_index: chunk.index,
        chunk_start: chunk.startChar,
        chunk_end: chunk.endChar,
        total_chunks: chunks.length,
        source: 'chapter_save',
      },
    })

    if (!insertError) chunkCount++
  }

  return { chunkCount }
}

export async function indexProjectEmbeddings(
  projectId: string,
  userId: string
): Promise<IndexProjectResult> {
  const supabase = await createServiceRoleClient()
  const { apiKey } = await getOpenAIApiKey(userId)

  if (!apiKey) {
    return { indexed: false, totalChapters: 0, chaptersWithContent: 0, totalChunks: 0 }
  }

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, title, content, project_id, order_index, content_file_path')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('order_index', { ascending: true })

  if (!chapters || chapters.length === 0) {
    return { indexed: false, totalChapters: 0, chaptersWithContent: 0, totalChunks: 0 }
  }

  await supabase.from('document_embeddings').delete().eq('project_id', projectId).eq('user_id', userId)

  let totalChunks = 0
  let chaptersWithContent = 0

  for (const chapter of chapters) {
    const content = await loadChapterRowContent(supabase, chapter)
    if (!content || content.length < 50) continue

    chaptersWithContent++
    const result = await indexChapterEmbeddings(
      chapter.id,
      projectId,
      userId,
      content,
      chapter.title
    )
    totalChunks += result.chunkCount
  }

  return {
    indexed: totalChunks > 0,
    totalChapters: chapters.length,
    chaptersWithContent,
    totalChunks,
  }
}

export async function hasProjectEmbeddings(projectId: string, userId: string): Promise<boolean> {
  const supabase = await createServiceRoleClient()
  const { count } = await supabase
    .from('document_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('user_id', userId)

  return (count ?? 0) > 0
}
