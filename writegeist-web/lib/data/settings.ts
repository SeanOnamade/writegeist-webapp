import type { DbClient } from './types'
import type { Json } from '@/types/database'
import { getCurrentUserProfile, updateUserProfile } from './users'

/**
 * Single source of truth for the app settings shape (was previously
 * duplicated in SettingsContext and the AppSettings component).
 *
 * Provider API keys are intentionally NOT part of this type — they are
 * managed server-side via /api/settings/api-keys and never sent to the
 * browser.
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  autoSave: boolean
  autoSaveInterval: number
  defaultProjectStatus: 'draft' | 'active' | 'archived'
  wordCountGoal: number
  enableNotifications: boolean
  language: string
  /** Which provider answers chat questions. Embeddings and audio always use OpenAI. */
  chatProvider: 'openai' | 'anthropic'
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  autoSave: true,
  autoSaveInterval: 30,
  defaultProjectStatus: 'draft',
  wordCountGoal: 50000,
  enableNotifications: true,
  language: 'en',
  chatProvider: 'openai',
}

export async function getSettings(db: DbClient): Promise<AppSettings> {
  const profile = await getCurrentUserProfile(db)
  const prefs = (profile?.preferences as Partial<AppSettings> | null) ?? {}
  return { ...defaultSettings, ...prefs }
}

/**
 * Persist a partial settings update, merged into the stored preferences so
 * unrelated fields (including the server-managed encrypted API keys) are
 * never clobbered.
 */
export async function saveSettings(
  db: DbClient,
  updates: Partial<AppSettings>
): Promise<boolean> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return false

  const { data: row } = await db
    .from('users')
    .select('preferences')
    .eq('id', user.id)
    .single()

  const current = (row?.preferences as Record<string, unknown> | null) ?? {}
  const sanitized = { ...updates } as Record<string, unknown>
  delete sanitized.openaiApiKey
  delete sanitized.anthropicApiKey

  const updated = await updateUserProfile(db, {
    preferences: { ...current, ...sanitized } as Json,
  })
  return updated !== null
}
