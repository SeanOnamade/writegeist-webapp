'use client'

import { useCallback, useState } from 'react'
import { parseSSEStream } from '@/lib/sse'
import type { ContextCitation } from '@/lib/chat/groupCitations'

export interface ChatStreamResult {
  message: string
  citations: ContextCitation[]
  confidence: 'high' | 'low'
}

/**
 * Consumes the streaming /api/chat endpoint. Exposes the in-flight streamed
 * text (for the live bubble) and the indexing status from the meta event.
 */
export function useChatStream() {
  const [streamingText, setStreamingText] = useState('')
  const [indexingStatus, setIndexingStatus] = useState<string | null>(null)

  const resetStream = useCallback(() => setStreamingText(''), [])

  const requestChatResponse = useCallback(
    async (
      messages: { role: 'user' | 'assistant'; content: string }[],
      projectId: string | null | undefined
    ): Promise<ChatStreamResult> => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          temperature: 0.3,
          max_tokens: 1000,
          projectId: projectId || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const serverError = typeof errorData.error === 'string' ? errorData.error : ''
        if (serverError.includes('API key')) {
          // Missing/invalid key is a setup problem, not a failure: answer in
          // the chat itself with the actionable server message.
          return {
            message: `${serverError} Once your key is saved, ask me anything about your manuscript.`,
            citations: [],
            confidence: 'low',
          }
        }
        throw new Error(serverError || `API request failed: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Empty response from chat API')
      }

      // The endpoint streams SSE: one `meta` event (citations, indexing state),
      // then `delta` tokens, then `done` with the full message.
      let citations: ContextCitation[] = []
      let confidence: 'high' | 'low' = 'high'
      let message = ''
      let streamError: string | null = null

      await parseSSEStream(response.body, (event, data) => {
        if (event === 'meta') {
          citations = (data.citations as ContextCitation[] | undefined) || []
          confidence = data.confidence === 'low' ? 'low' : 'high'
          if (data.indexing) {
            setIndexingStatus('Indexing manuscript...')
          } else if (data.indexed) {
            setIndexingStatus('Manuscript indexed')
          } else if (!data.hasContent) {
            setIndexingStatus('No chapter content found')
          } else {
            setIndexingStatus(null)
          }
        } else if (event === 'delta' && typeof data.text === 'string') {
          message += data.text
          setStreamingText(message)
        } else if (event === 'done') {
          message = (data.message as string | undefined) || message
        } else if (event === 'error') {
          streamError = (data.error as string | undefined) || 'Chat request failed'
        }
      })

      if (streamError) {
        throw new Error(streamError)
      }

      return {
        message: message || "I couldn't find an answer in your manuscript.",
        citations,
        confidence,
      }
    },
    []
  )

  return { streamingText, indexingStatus, requestChatResponse, resetStream }
}
