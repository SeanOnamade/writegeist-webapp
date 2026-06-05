import { createServiceRoleClient } from '@/lib/supabase/server'
import { getOpenAIApiKey } from '@/lib/api/openai-key'
import { contentChunker } from '@/lib/embeddings/chunking'

export interface IndexProjectResult {
  indexed: boolean
  totalChapters: number
  chaptersWithContent: number
  totalChunks: number
}

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
    const content = await loadChapterContent(supabase, chapter)
    if (!content || content.length < 50) continue

    chaptersWithContent++
    const chunks = contentChunker.chunk(content, {
      maxChars: 1200,
      preserveContext: true,
      overlapChars: 150,
    })

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
        chapter_id: chapter.id,
        project_id: projectId,
        user_id: userId,
        content_type: 'chapter_chunk',
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'text-embedding-3-small',
          chapter_title: chapter.title,
          chunk_index: chunk.index,
          chunk_start: chunk.startChar,
          chunk_end: chunk.endChar,
          total_chunks: chunks.length,
          source: 'auto_index',
        },
      })

      if (!insertError) totalChunks++
    }
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
