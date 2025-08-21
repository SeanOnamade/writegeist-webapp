'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api/client'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { encryptData, getApiKey } from '@/lib/crypto'

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
  const [validatingApiKey, setValidatingApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<'valid' | 'invalid' | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const result = await api.getSettings()
      if (result.success && result.data) {
        const loadedSettings = { ...defaultSettings, ...result.data }
        
        // Decrypt API key if it exists
        if (loadedSettings.openaiApiKey) {
          try {
            loadedSettings.openaiApiKey = getApiKey(loadedSettings.openaiApiKey as string)
          } catch (error) {
            console.error('Error decrypting API key:', error)
            loadedSettings.openaiApiKey = '' // Clear invalid key
          }
        }
        
        setSettings(loadedSettings)
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
      // Encrypt API key before saving
      const settingsToSave = { ...settings }
      if (settingsToSave.openaiApiKey && settingsToSave.openaiApiKey.trim()) {
        settingsToSave.openaiApiKey = encryptData(settingsToSave.openaiApiKey.trim())
      }

      const result = await api.saveSettings(settingsToSave as unknown as Record<string, unknown>)
      if (result.success) {
        setMessage('Settings saved successfully! (API key encrypted)')
        setApiKeyStatus(null) // Reset validation status after save
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
    // Reset API key status when key changes
    if (key === 'openaiApiKey') {
      setApiKeyStatus(null)
    }
  }

  const validateApiKey = async () => {
    const keyToTest = settings.openaiApiKey?.trim()
    
    if (!keyToTest || keyToTest.length === 0) {
      toast({
        title: "⚠️ No API Key",
        description: "Please enter an OpenAI API key first.",
        variant: "destructive",
      })
      return
    }

    setValidatingApiKey(true)
    setApiKeyStatus(null)

    try {
      // Test the current input value, not the saved one
      const response = await fetch('/api/audio/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest })
      })

      const result = await response.json()
      
      if (result.valid) {
        setApiKeyStatus('valid')
        toast({
          title: "✅ API Key Valid",
          description: result.message || "Your OpenAI API key is working correctly!",
        })
      } else {
        setApiKeyStatus('invalid')
        toast({
          title: "❌ API Key Invalid",
          description: result.error || "Please check your OpenAI API key.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('API key validation error:', error)
      setApiKeyStatus('invalid')
      toast({
        title: "⚠️ Validation Failed",
        description: "Unable to validate API key. Please try again.",
        variant: "destructive",
      })
    } finally {
      setValidatingApiKey(false)
    }
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
            <div className="flex gap-2">
              <Input
                id="openaiApiKey"
                type="password"
                value={settings.openaiApiKey}
                onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
                placeholder="sk-..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={validateApiKey}
                disabled={validatingApiKey || !settings.openaiApiKey?.trim()}
                className="flex items-center gap-2 px-3"
              >
                {validatingApiKey ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : apiKeyStatus === 'valid' ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Valid
                  </>
                ) : apiKeyStatus === 'invalid' ? (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    Invalid
                  </>
                ) : (
                  'Validate'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Required for AI-powered features like chapter analysis, chat, and audio generation.
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
          <p className="text-xs text-muted-foreground">
            Show notifications for auto-saves, word count goals, and writing reminders.
          </p>
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
