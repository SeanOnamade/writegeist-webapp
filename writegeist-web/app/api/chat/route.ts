import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/server'
import { jsonError, parseBody } from '@/lib/api/http'
import { getProviderApiKey, PROVIDER_LABELS, type AiProvider } from '@/lib/api/provider-keys'
import { buildProjectContext } from '@/lib/chat/buildProjectContext'
import { buildSearchQuery } from '@/lib/chat/buildSearchQuery'
import { buildManuscriptSystemPrompt, buildContextInjection } from '@/lib/chat/prompts'

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1),
  temperature: z.number().min(0).max(2).default(0.3),
  max_tokens: z.number().int().min(1).max(4000).default(1000),
  projectId: z.string().min(1).optional(),
})

type ChatMessage = z.infer<typeof bodySchema>['messages'][number]

const OPENAI_CHAT_MODEL = 'gpt-4o-mini'
const ANTHROPIC_CHAT_MODEL = 'claude-haiku-4-5'

function friendlyUpstreamError(provider: AiProvider, status: number): string {
  const label = PROVIDER_LABELS[provider]
  if (status === 401 || status === 403) {
    return `Your ${label} API key is invalid or expired. Update it in Settings.`
  }
  if (status === 429) {
    return `${label} rate limit or quota exceeded. Check your ${label} account usage and billing.`
  }
  return 'Failed to get AI response. Please try again.'
}

function openAIRequest(
  apiKey: string,
  systemContent: string,
  messages: ChatMessage[],
  temperature: number,
  max_tokens: number
): Promise<Response> {
  const enhanced = [...messages]
  if (enhanced.length > 0 && enhanced[0].role === 'system') {
    enhanced[0] = { ...enhanced[0], content: systemContent }
  } else {
    enhanced.unshift({ role: 'system', content: systemContent })
  }

  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      messages: enhanced,
      temperature,
      max_tokens,
      stream: true,
    }),
  })
}

function anthropicRequest(
  apiKey: string,
  systemContent: string,
  messages: ChatMessage[],
  temperature: number,
  max_tokens: number
): Promise<Response> {
  // The Messages API takes the system prompt as a top-level param and
  // requires strictly alternating user/assistant turns, so merge any
  // consecutive same-role messages.
  const turns: { role: 'user' | 'assistant'; content: string }[] = []
  for (const message of messages) {
    if (message.role === 'system') continue
    const last = turns[turns.length - 1]
    if (last && last.role === message.role) {
      last.content += `\n\n${message.content}`
    } else {
      turns.push({ role: message.role, content: message.content })
    }
  }

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_CHAT_MODEL,
      system: systemContent,
      messages: turns,
      temperature: Math.min(temperature, 1), // Anthropic caps temperature at 1.
      max_tokens,
      stream: true,
    }),
  })
}

/** Extract the incremental answer text from one upstream SSE data payload. */
function extractDelta(provider: AiProvider, payload: string): string | undefined {
  const parsed = JSON.parse(payload)
  if (provider === 'anthropic') {
    return parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta'
      ? parsed.delta.text
      : undefined
  }
  return parsed.choices?.[0]?.delta?.content
}

/**
 * Manuscript Q&A endpoint. Streams the answer as Server-Sent Events:
 * - `meta`  — citations, confidence, indexing state (sent once, first)
 * - `delta` — incremental answer tokens
 * - `done`  — full assembled answer
 * - `error` — terminal failure
 *
 * The answer model is chosen by the user's `chatProvider` setting (OpenAI or
 * Anthropic). Retrieval embeddings always use the OpenAI key and degrade
 * gracefully when it is missing.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser()
    if (!user) {
      return jsonError('Not authenticated', 401)
    }
    const userId = user.id

    const body = await parseBody(request, bodySchema)
    if (!body.ok) return body.response
    const { messages, temperature, max_tokens, projectId } = body.data

    const { data: userRow } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single()
    const preferences = (userRow?.preferences as Record<string, unknown> | null) ?? {}
    const provider: AiProvider = preferences.chatProvider === 'anthropic' ? 'anthropic' : 'openai'

    const { apiKey } = await getProviderApiKey(provider, userId)
    if (!apiKey) {
      return jsonError(
        `${PROVIDER_LABELS[provider]} API key not configured. Please add it in Settings.`,
        500
      )
    }

    const searchQuery = buildSearchQuery(messages)
    const latestUserQuery = [...messages].reverse().find((m) => m.role === 'user')?.content || ''

    const contextResult = projectId
      ? await buildProjectContext(searchQuery, projectId, userId, latestUserQuery)
      : null

    const projectTitle = contextResult?.projectTitle ?? 'your project'
    const intentFlags = {
      isSummary: contextResult?.isSummary ?? false,
      isThematic: contextResult?.isThematic ?? false,
      isSpeculative: contextResult?.isSpeculative ?? false,
    }

    const systemContent = contextResult?.context
      ? `${buildManuscriptSystemPrompt(projectTitle, intentFlags)}

PROJECT CONTEXT:
${buildContextInjection(contextResult.context)}`
      : buildManuscriptSystemPrompt(projectTitle, intentFlags)

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          sendEvent('meta', {
            citations: contextResult?.citations ?? [],
            indexed: contextResult?.indexed ?? false,
            indexing: contextResult?.indexing ?? false,
            hasContent: contextResult?.hasContent ?? false,
            projectTitle,
            confidence: contextResult?.confidence ?? 'high',
          })

          const response =
            provider === 'anthropic'
              ? await anthropicRequest(apiKey, systemContent, messages, temperature, max_tokens)
              : await openAIRequest(apiKey, systemContent, messages, temperature, max_tokens)

          if (!response.ok || !response.body) {
            const errorText = await response.text().catch(() => '')
            console.error(`${PROVIDER_LABELS[provider]} API error:`, response.status, errorText)
            sendEvent('error', { error: friendlyUpstreamError(provider, response.status) })
            controller.close()
            return
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let fullMessage = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data:')) continue
              const payload = trimmed.slice(5).trim()
              if (!payload || payload === '[DONE]') continue

              try {
                const delta = extractDelta(provider, payload)
                if (delta) {
                  fullMessage += delta
                  sendEvent('delta', { text: delta })
                }
              } catch {
                // Skip malformed SSE fragments from upstream.
              }
            }
          }

          sendEvent('done', { message: fullMessage })
          controller.close()
        } catch (error) {
          console.error('Chat stream error:', error)
          sendEvent('error', {
            error: error instanceof Error ? error.message : 'Chat request failed',
          })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return jsonError('Internal server error', 500)
  }
}
