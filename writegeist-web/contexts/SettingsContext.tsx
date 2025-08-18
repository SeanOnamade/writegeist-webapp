'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api/client'

interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  openaiApiKey: string
  autoSave: boolean
  autoSaveInterval: number
  defaultProjectStatus: 'draft' | 'active' | 'archived'
  wordCountGoal: number
  enableNotifications: boolean
  language: string
}

interface SettingsContextType {
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => Promise<boolean>
  loading: boolean
  error: string | null
}

const defaultSettings: AppSettings = {
  theme: 'system',
  openaiApiKey: '',
  autoSave: true,
  autoSaveInterval: 30,
  defaultProjectStatus: 'draft',
  wordCountGoal: 50000,
  enableNotifications: true,
  language: 'en'
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
      const result = await api.getSettings()
      
      if (result.success && result.data) {
        setSettings({ ...defaultSettings, ...result.data })
      }
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
      const newSettings = { ...settings, ...updates }
      
      const result = await api.saveSettings(newSettings)
      
      if (result.success) {
        setSettings(newSettings)
        return true
      } else {
        setError(result.error || 'Failed to save settings')
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
  const { settings, updateSettings } = useSettings()
  
  const setTheme = (theme: AppSettings['theme']) => {
    updateSettings({ theme })
  }

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    
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
  }, [settings.theme])

  return {
    theme: settings.theme,
    setTheme
  }
}

