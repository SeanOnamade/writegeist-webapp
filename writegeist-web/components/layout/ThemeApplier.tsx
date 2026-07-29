'use client'

import { useTheme } from '@/contexts/SettingsContext'

/**
 * Mounts the theme effect: applies the `dark` class to <html> based on the
 * user's saved theme setting and keeps localStorage in sync so the inline
 * no-flash script in the root layout picks the right theme on next load.
 */
export function ThemeApplier() {
  useTheme()
  return null
}
