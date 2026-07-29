import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/server'
import { jsonError, parseBody } from '@/lib/api/http'
import { encryptData } from '@/lib/crypto'
import {
  isValidKeyFormat,
  PROVIDER_PREFERENCE_FIELD,
  type AiProvider,
} from '@/lib/api/provider-keys'
import type { Json } from '@/types/database'

const providerSchema = z.enum(['openai', 'anthropic'])

const bodySchema = z
  .object({
    provider: providerSchema,
    apiKey: z.string().trim().min(20, 'Invalid API key format'),
  })
  .refine((data) => isValidKeyFormat(data.provider, data.apiKey), {
    message: 'Invalid API key format for this provider',
    path: ['apiKey'],
  })

async function loadPreferences(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  userId: string
): Promise<Record<string, unknown>> {
  const { data } = await supabase.from('users').select('preferences').eq('id', userId).single()
  return (data?.preferences as Record<string, unknown> | null) ?? {}
}

/** Reports which providers have a stored key — never returns key material. */
export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) {
    return jsonError('Not authenticated', 401)
  }

  const preferences = await loadPreferences(supabase, user.id)
  return NextResponse.json({
    openai: Boolean(preferences[PROVIDER_PREFERENCE_FIELD.openai]),
    anthropic: Boolean(preferences[PROVIDER_PREFERENCE_FIELD.anthropic]),
  })
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return jsonError('Not authenticated', 401)
  }

  const body = await parseBody(request, bodySchema)
  if (!body.ok) return body.response
  const { provider, apiKey } = body.data

  let encrypted: string
  try {
    encrypted = encryptData(apiKey)
  } catch {
    return jsonError(
      'Server encryption is not configured. Set the ENCRYPTION_KEY environment variable.',
      500
    )
  }

  const preferences = await loadPreferences(supabase, user.id)
  const { error } = await supabase
    .from('users')
    .update({
      preferences: { ...preferences, [PROVIDER_PREFERENCE_FIELD[provider]]: encrypted } as Json,
    })
    .eq('id', user.id)

  if (error) {
    return jsonError('Failed to save API key', 500)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return jsonError('Not authenticated', 401)
  }

  const parsed = providerSchema.safeParse(request.nextUrl.searchParams.get('provider'))
  if (!parsed.success) {
    return jsonError('Missing or invalid provider', 400)
  }
  const provider: AiProvider = parsed.data

  const preferences = await loadPreferences(supabase, user.id)
  delete preferences[PROVIDER_PREFERENCE_FIELD[provider]]

  const { error } = await supabase
    .from('users')
    .update({ preferences: preferences as Json })
    .eq('id', user.id)

  if (error) {
    return jsonError('Failed to remove API key', 500)
  }

  return NextResponse.json({ success: true })
}
