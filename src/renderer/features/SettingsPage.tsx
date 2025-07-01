import React, { useState, useEffect } from 'react';
import { Settings, Save, Key, Server, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';

interface Config {
  OPENAI_API_KEY: string;
  PORT: number;
}

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<Config>({ OPENAI_API_KEY: '', PORT: 8000 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await window.api.getConfig();
      setConfig(loadedConfig);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const result = await window.api.saveConfig(config);
      if (result.success) {
        toast({
          title: 'Settings Saved',
          description: 'Configuration saved successfully. API backend is restarting...',
        });
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof Config, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const isConfigValid = config.OPENAI_API_KEY.trim() !== '' && config.PORT > 0 && config.PORT < 65536;

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-400">Loading settings...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">Settings</h1>
            <p className="text-neutral-400 text-sm">Configure your writing environment</p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* API Configuration */}
          <div className="bg-neutral-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Key className="h-5 w-5 text-neutral-400" />
              <h2 className="text-lg font-semibold text-neutral-100">API Configuration</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  OpenAI API Key
                </label>
                <Input
                  type="password"
                  value={config.OPENAI_API_KEY}
                  onChange={(e) => handleInputChange('OPENAI_API_KEY', e.target.value)}
                  placeholder="sk-..."
                  className="bg-neutral-700 border-neutral-600 text-neutral-100"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">OpenAI Platform</a>
                </p>
              </div>
            </div>
          </div>

          {/* Server Configuration */}
          <div className="bg-neutral-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Server className="h-5 w-5 text-neutral-400" />
              <h2 className="text-lg font-semibold text-neutral-100">Server Configuration</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Backend Port
                </label>
                <Input
                  type="number"
                  value={config.PORT}
                  onChange={(e) => handleInputChange('PORT', parseInt(e.target.value) || 8000)}
                  min="1"
                  max="65535"
                  className="bg-neutral-700 border-neutral-600 text-neutral-100"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Port for the local API backend (default: 8000)
                </p>
              </div>
            </div>
          </div>

          {/* Status & Save */}
          <div className="bg-neutral-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isConfigValid ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-neutral-300">Configuration is valid</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <span className="text-neutral-300">Please configure your API key</span>
                  </>
                )}
              </div>
              
              <Button
                onClick={handleSaveConfig}
                disabled={saving || !isConfigValid}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
            
            {saving && (
              <p className="text-xs text-neutral-500 mt-2">
                Saving configuration and restarting API backend...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 