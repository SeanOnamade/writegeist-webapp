'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getSettings, saveSettings, defaultSettings, type AppSettings } from '@/lib/data/settings'

export type { AppSettings }

interface SettingsContextType {
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => Promise<boolean>
  loading: boolean
  error: string | null
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setError(null)
      setSettings(await getSettings(supabase))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
      console.error('Error loading settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (updates: Partial<AppSettings>): Promise<boolean> => {
    try {
      setError(null)

      // Save only the changed fields; saveSettings merges with stored
      // preferences, so this never clobbers values changed elsewhere.
      const saved = await saveSettings(supabase, updates)

      if (saved) {
        setSettings(prev => ({ ...prev, ...updates }))
        return true
      } else {
        setError('Failed to save settings')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings'
      setError(errorMessage)
      console.error('Error updating settings:', err)
      return false
    }
  }

  const value: SettingsContextType = {
    settings,
    updateSettings,
    loading,
    error
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

// Hook for theme management
export function useTheme() {
  const { settings, updateSettings, loading } = useSettings()
  
  const setTheme = (theme: AppSettings['theme']) => {
    updateSettings({ theme })
  }

  // Apply theme to document and mirror it to localStorage for the no-flash
  // script in the root layout. Waits for settings to load so the default
  // ('system') never overrides what the inline script already applied.
  useEffect(() => {
    if (loading) return

    const root = document.documentElement

    try {
      localStorage.setItem('writegeist-theme', settings.theme)
    } catch {
      // localStorage unavailable (private mode etc.) — theme still applies below.
    }

    if (settings.theme === 'dark') {
      root.classList.add('dark')
    } else if (settings.theme === 'light') {
      root.classList.remove('dark')
    } else {
      // System theme
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const updateTheme = () => {
        if (mediaQuery.matches) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
      
      updateTheme()
      mediaQuery.addEventListener('change', updateTheme)
      
      return () => mediaQuery.removeEventListener('change', updateTheme)
    }
  }, [settings.theme, loading])

  return {
    theme: settings.theme,
    setTheme
  }
}

