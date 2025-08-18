'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export function AppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const result = await api.getSettings()
      if (result.success && result.data) {
        setSettings({ ...defaultSettings, ...result.data })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const result = await api.saveSettings(settings as unknown as Record<string, unknown>)
      if (result.success) {
        setMessage('Settings saved successfully!')
      } else {
        setMessage('Failed to save settings: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      setMessage('Error saving settings: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted animate-pulse rounded w-1/3"></div>
        <div className="h-10 bg-muted animate-pulse rounded"></div>
        <div className="h-10 bg-muted animate-pulse rounded"></div>
        <div className="h-10 bg-muted animate-pulse rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Application Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure your writing environment and preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Theme Settings */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Appearance</h4>
          <div>
            <label htmlFor="theme" className="block text-sm font-medium mb-2">
              Theme
            </label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value as AppSettings['theme'])}
              className="w-full p-2 border border-input rounded-md bg-background"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>

        {/* AI Settings */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">AI Integration</h4>
          <div>
            <label htmlFor="openaiApiKey" className="block text-sm font-medium mb-2">
              OpenAI API Key
            </label>
            <Input
              id="openaiApiKey"
              type="password"
              value={settings.openaiApiKey}
              onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required for AI-powered features like chapter analysis and chat.
            </p>
          </div>
        </div>

        {/* Writing Settings */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Writing</h4>
          
          <div>
            <label htmlFor="wordCountGoal" className="block text-sm font-medium mb-2">
              Daily Word Count Goal
            </label>
            <Input
              id="wordCountGoal"
              type="number"
              value={settings.wordCountGoal}
              onChange={(e) => updateSetting('wordCountGoal', parseInt(e.target.value) || 0)}
              min="0"
              step="100"
            />
          </div>

          <div>
            <label htmlFor="defaultProjectStatus" className="block text-sm font-medium mb-2">
              Default Project Status
            </label>
            <select
              id="defaultProjectStatus"
              value={settings.defaultProjectStatus}
              onChange={(e) => updateSetting('defaultProjectStatus', e.target.value as AppSettings['defaultProjectStatus'])}
              className="w-full p-2 border border-input rounded-md bg-background"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Auto-Save Settings */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Auto-Save</h4>
          
          <div className="flex items-center space-x-2">
            <input
              id="autoSave"
              type="checkbox"
              checked={settings.autoSave}
              onChange={(e) => updateSetting('autoSave', e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="autoSave" className="text-sm">
              Enable auto-save
            </label>
          </div>

          {settings.autoSave && (
            <div>
              <label htmlFor="autoSaveInterval" className="block text-sm font-medium mb-2">
                Auto-save interval (seconds)
              </label>
              <Input
                id="autoSaveInterval"
                type="number"
                value={settings.autoSaveInterval}
                onChange={(e) => updateSetting('autoSaveInterval', parseInt(e.target.value) || 30)}
                min="10"
                max="300"
                step="10"
              />
            </div>
          )}
        </div>

        {/* Notification Settings */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Notifications</h4>
          
          <div className="flex items-center space-x-2">
            <input
              id="enableNotifications"
              type="checkbox"
              checked={settings.enableNotifications}
              onChange={(e) => updateSetting('enableNotifications', e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="enableNotifications" className="text-sm">
              Enable notifications
            </label>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-md text-sm ${
            message.includes('successfully') 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}
