import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/server'
import { jsonError, parseBody } from '@/lib/api/http'
import {
  getProviderApiKey,
  isValidKeyFormat,
  PROVIDER_LABELS,
  type AiProvider,
} from '@/lib/api/provider-keys'

// apiKey is optional: without it this validates the stored/env key.
const bodySchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  apiKey: z.string().optional(),
})

async function validateWithProvider(
  provider: AiProvider,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  // Listing models is free on both platforms and confirms the key is live.
  const response =
    provider === 'openai'
      ? await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
      : await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        })

  if (response.ok) {
    return { valid: true }
  }

  const label = PROVIDER_LABELS[provider]
  if (response.status === 401 || response.status === 403) {
    return { valid: false, error: `Invalid API key. Please check your ${label} API key.` }
  }
  if (response.status === 429) {
    return { valid: false, error: `${label} rate limit exceeded. Please try again later.` }
  }
  return { valid: false, error: `${label} returned an unexpected error (${response.status}).` }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser()
    if (!user) {
      return jsonError('Not authenticated', 401)
    }

    const body = await parseBody(request, bodySchema)
    if (!body.ok) return body.response
    const { provider } = body.data

    let apiKey = body.data.apiKey?.trim()
    if (!apiKey) {
      const resolved = await getProviderApiKey(provider, user.id)
      apiKey = resolved.apiKey ?? undefined
    }

    const label = PROVIDER_LABELS[provider]
    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: `No ${label} API key configured. Add your key in Settings.` },
        { status: 400 }
      )
    }

    if (!isValidKeyFormat(provider, apiKey)) {
      const expected = provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'
      return NextResponse.json(
        { valid: false, error: `Invalid key format. Expected a ${label} ${expected} key.` },
        { status: 400 }
      )
    }

    const result = await validateWithProvider(provider, apiKey)
    return NextResponse.json(result, { status: result.valid ? 200 : 400 })
  } catch (error) {
    console.error('API key validation error:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to validate API key. Please try again.' },
      { status: 500 }
    )
  }
}
