import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { requireUser } from '@/lib/supabase/server'
import { jsonError, parseBody } from '@/lib/api/http'
import { getOpenAIApiKey, isValidKeyFormat } from '@/lib/api/provider-keys'

// The body is optional: without an apiKey this validates the stored/env key.
const bodySchema = z
  .object({
    apiKey: z.string().optional(),
  })
  .default({})

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser()
    if (!user) {
      return jsonError('Not authenticated', 401)
    }

    const body = await parseBody(request, bodySchema)
    if (!body.ok) return body.response

    let apiKey = body.data.apiKey?.trim()
    if (!apiKey) {
      const resolved = await getOpenAIApiKey(user.id)
      apiKey = resolved.apiKey ?? undefined
    }

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: 'No OpenAI API key configured. Please add your API key in Settings.' },
        { status: 400 }
      )
    }

    if (!isValidKeyFormat('openai', apiKey)) {
      return NextResponse.json(
        { valid: false, error: 'Invalid API key format. Expected an OpenAI sk-... key.' },
        { status: 400 }
      )
    }

    try {
      const openai = new OpenAI({ apiKey })
      const models = await openai.models.list()

      const hasTTSModels = models.data.some(
        (model) => model.id.includes('tts-1') || model.id.includes('text-to-speech')
      )

      return NextResponse.json({
        valid: true,
        hasTTSModels,
        message: hasTTSModels
          ? 'API key is valid and TTS models are available'
          : 'API key is valid but TTS models may not be accessible',
      })
    } catch (openaiError) {
      const status = (openaiError as { status?: number }).status
      let errorMessage = 'Unknown API validation error'
      if (status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI API key.'
      } else if (status === 403) {
        errorMessage = 'API key lacks necessary permissions for TTS.'
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.'
      } else if (openaiError instanceof Error && openaiError.message) {
        errorMessage = openaiError.message
      }

      return NextResponse.json({ valid: false, error: errorMessage }, { status: 400 })
    }
  } catch (error) {
    console.error('API key validation error:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to validate API key. Please try again.' },
      { status: 500 }
    )
  }
}
