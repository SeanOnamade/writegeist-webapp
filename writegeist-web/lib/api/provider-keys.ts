import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getApiKey } from '@/lib/crypto'

export type AiProvider = 'openai' | 'anthropic'

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
}

/** Field inside users.preferences that stores the encrypted key. */
const PREFERENCE_FIELD: Record<AiProvider, string> = {
  openai: 'openaiApiKey',
  anthropic: 'anthropicApiKey',
}

const ENV_VAR: Record<AiProvider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
}

/**
 * OpenAI keys are `sk-...` and Anthropic keys are `sk-ant-...`, so the
 * Anthropic prefix must be excluded when checking an OpenAI key.
 */
export function isValidKeyFormat(provider: AiProvider, key: string): boolean {
  if (key.length < 20) return false
  return provider === 'anthropic'
    ? key.startsWith('sk-ant-')
    : key.startsWith('sk-') && !key.startsWith('sk-ant-')
}

interface ApiKeyResult {
  apiKey: string | null
  source: 'user_settings' | 'environment' | 'none'
}

/**
 * Get a provider API key with consistent priority:
 * 1. User settings (users.preferences.openaiApiKey / anthropicApiKey)
 * 2. Environment variable (OPENAI_API_KEY / ANTHROPIC_API_KEY)
 *
 * When `userId` is passed it MUST come from a verified session
 * (`requireUser()`), because the lookup then uses the service role client.
 */
export async function getProviderApiKey(
  provider: AiProvider,
  userId?: string
): Promise<ApiKeyResult> {
  try {
    const supabase = userId ? await createServiceRoleClient() : await createClient()

    let targetUserId = userId ?? null
    if (!targetUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      targetUserId = user?.id ?? null
    }

    if (targetUserId) {
      const { data: userData } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', targetUserId)
        .single()

      const preferences = userData?.preferences as Record<string, unknown> | null
      const stored = preferences?.[PREFERENCE_FIELD[provider]]
      if (typeof stored === 'string' && stored) {
        const apiKey = getApiKey(stored)
        if (apiKey) {
          return { apiKey, source: 'user_settings' }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading user ${provider} API key, falling back to environment:`, error)
  }

  const envApiKey = process.env[ENV_VAR[provider]]
  if (envApiKey) {
    return { apiKey: envApiKey, source: 'environment' }
  }

  return { apiKey: null, source: 'none' }
}

export const getOpenAIApiKey = (userId?: string) => getProviderApiKey('openai', userId)
export const getAnthropicApiKey = (userId?: string) => getProviderApiKey('anthropic', userId)

export { PREFERENCE_FIELD as PROVIDER_PREFERENCE_FIELD }
