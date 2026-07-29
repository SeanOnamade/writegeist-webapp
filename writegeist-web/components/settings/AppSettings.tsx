'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import {
  getSettings,
  saveSettings,
  defaultSettings,
  type AppSettings as AppSettingsType,
} from '@/lib/data/settings'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from '@/contexts/SettingsContext'

// Theme is applied and saved instantly through useTheme(), so the form state
// only tracks the remaining settings. It must never hold theme, or "Save
// Settings" would write a stale theme over one picked after the page loaded.
type GeneralSettings = Omit<AppSettingsType, 'theme'>

function stripTheme({ theme: _theme, ...rest }: AppSettingsType): GeneralSettings {
  return rest
}

type Provider = 'openai' | 'anthropic'

const PROVIDER_FIELDS: {
  provider: Provider
  label: string
  placeholder: string
  hint: string
}[] = [
  {
    provider: 'openai',
    label: 'OpenAI API Key',
    placeholder: 'sk-...',
    hint: 'Used for manuscript search, audio narration, and GPT chat responses.',
  },
  {
    provider: 'anthropic',
    label: 'Anthropic API Key',
    placeholder: 'sk-ant-...',
    hint: 'Optional. Powers chat responses when Claude is selected below.',
  },
]

type PerProvider<T> = Record<Provider, T>

export function AppSettings() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState<GeneralSettings>(() => stripTheme(defaultSettings))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [apiKeyInputs, setApiKeyInputs] = useState<PerProvider<string>>({
    openai: '',
    anthropic: '',
  })
  const [hasStoredKeys, setHasStoredKeys] = useState<PerProvider<boolean>>({
    openai: false,
    anthropic: false,
  })
  const [validatingProvider, setValidatingProvider] = useState<Provider | null>(null)
  const [keyStatuses, setKeyStatuses] = useState<PerProvider<'valid' | 'invalid' | null>>({
    openai: null,
    anthropic: null,
  })
  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [stored, keyResponse] = await Promise.all([
        getSettings(supabase),
        fetch('/api/settings/api-keys').then((res) => (res.ok ? res.json() : null)).catch(() => null),
      ])

      setSettings(stripTheme(stored))
      setHasStoredKeys({
        openai: Boolean(keyResponse?.openai),
        anthropic: Boolean(keyResponse?.anthropic),
      })
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
      // API keys are encrypted and stored server-side, separately from the
      // rest of the preferences.
      for (const { provider, label } of PROVIDER_FIELDS) {
        const trimmedKey = apiKeyInputs[provider].trim()
        if (!trimmedKey) continue

        const keyResponse = await fetch('/api/settings/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, apiKey: trimmedKey }),
        })
        const keyResult = await keyResponse.json()
        if (!keyResponse.ok) {
          setMessage(`Failed to save ${label}: ` + (keyResult.error || 'Unknown error'))
          setSaving(false)
          return
        }
        setHasStoredKeys((prev) => ({ ...prev, [provider]: true }))
        setApiKeyInputs((prev) => ({ ...prev, [provider]: '' }))
        setKeyStatuses((prev) => ({ ...prev, [provider]: null }))
      }

      const saved = await saveSettings(supabase, settings)
      if (saved) {
        setMessage('Settings saved successfully!')
      } else {
        setMessage('Failed to save settings')
      }
    } catch (error) {
      setMessage('Error saving settings: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const validateApiKey = async (provider: Provider) => {
    const keyToTest = apiKeyInputs[provider].trim()
    const { label } = PROVIDER_FIELDS.find((f) => f.provider === provider)!

    if (!keyToTest) {
      toast({
        title: "No API Key",
        description: `Please enter an ${label} first.`,
        variant: "destructive",
      })
      return
    }

    setValidatingProvider(provider)
    setKeyStatuses((prev) => ({ ...prev, [provider]: null }))

    try {
      // Test the current input value, not the saved one
      const response = await fetch('/api/settings/api-keys/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: keyToTest })
      })

      const result = await response.json()

      if (result.valid) {
        setKeyStatuses((prev) => ({ ...prev, [provider]: 'valid' }))
        toast({
          title: "API Key Valid",
          description: result.message || "Your API key is working correctly!",
        })
      } else {
        setKeyStatuses((prev) => ({ ...prev, [provider]: 'invalid' }))
        toast({
          title: "API Key Invalid",
          description: result.error || `Please check your ${label}.`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('API key validation error:', error)
      setKeyStatuses((prev) => ({ ...prev, [provider]: 'invalid' }))
      toast({
        title: "Validation Failed",
        description: "Unable to validate API key. Please try again.",
        variant: "destructive",
      })
    } finally {
      setValidatingProvider(null)
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
            <Select
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Applied and saved immediately.
            </p>
          </div>
        </div>

        {/* AI Settings */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">AI Integration</h4>
          {PROVIDER_FIELDS.map(({ provider, label, placeholder, hint }) => (
            <div key={provider}>
              <label htmlFor={`${provider}ApiKey`} className="block text-sm font-medium mb-2">
                {label}
              </label>
              <div className="flex gap-2">
                <Input
                  id={`${provider}ApiKey`}
                  type="password"
                  value={apiKeyInputs[provider]}
                  onChange={(e) => {
                    const value = e.target.value
                    setApiKeyInputs((prev) => ({ ...prev, [provider]: value }))
                    setKeyStatuses((prev) => ({ ...prev, [provider]: null }))
                  }}
                  placeholder={
                    hasStoredKeys[provider]
                      ? 'Key saved — enter a new key to replace it'
                      : placeholder
                  }
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => validateApiKey(provider)}
                  disabled={validatingProvider !== null || !apiKeyInputs[provider].trim()}
                  className="flex items-center gap-2 px-3"
                >
                  {validatingProvider === provider ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : keyStatuses[provider] === 'valid' ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Valid
                    </>
                  ) : keyStatuses[provider] === 'invalid' ? (
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
                {hint} Stored encrypted on the server and never sent back to the browser.
              </p>
            </div>
          ))}

          <div>
            <label htmlFor="chatProvider" className="block text-sm font-medium mb-2">
              Chat Model
            </label>
            <Select
              id="chatProvider"
              value={settings.chatProvider}
              onChange={(e) => updateSetting('chatProvider', e.target.value as Provider)}
            >
              <option value="openai">OpenAI (GPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Chooses which model answers chat questions. Manuscript search and audio always use
              your OpenAI key — Anthropic does not offer embeddings or text-to-speech.
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
            <Select
              id="defaultProjectStatus"
              value={settings.defaultProjectStatus}
              onChange={(e) => updateSetting('defaultProjectStatus', e.target.value as GeneralSettings['defaultProjectStatus'])}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
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
