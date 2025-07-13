import React, { useState, useEffect } from 'react';
import { Settings, Save, Key, Server, CheckCircle, AlertCircle, ExternalLink, Database, Trash2 } from 'lucide-react';
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
  const [cleaningBackups, setCleaningBackups] = useState(false);
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

  const handleCleanupBackups = async () => {
    setCleaningBackups(true);
    try {
      const result = await (window.api as any).cleanupBackups();
      if (result.success) {
        toast({
          title: 'Backup Cleanup Complete',
          description: `${result.deletedCount} old backup files were removed. ${result.afterCount} backups remaining.`,
        });
      } else {
        throw new Error('Failed to cleanup backups');
      }
    } catch (error) {
      toast({
        title: 'Cleanup Failed',
        description: 'Failed to cleanup backup files. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCleaningBackups(false);
    }
  };

  const isConfigValid = config.OPENAI_API_KEY.trim() !== '' && config.PORT > 0 && config.PORT < 65536;

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-400">Loading settings...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="h-6 w-6 text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">Settings</h1>
            <p className="text-neutral-400">Configure your writing environment</p>
          </div>
        </div>
        
        <div className="space-y-8">
          {/* API Configuration */}
          <div className="bg-neutral-900/50 rounded-lg p-6 border border-neutral-800">
            <div className="flex items-center gap-3 mb-6">
              <Key className="h-5 w-5 text-blue-400" />
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
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 focus:border-blue-500"
                />
                <p className="text-xs text-neutral-500 mt-2 flex items-center gap-1">
                  Get your API key from{' '}
                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 hover:underline"
                  >
                    OpenAI Platform
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Server Configuration */}
          <div className="bg-neutral-900/50 rounded-lg p-6 border border-neutral-800">
            <div className="flex items-center gap-3 mb-6">
              <Server className="h-5 w-5 text-green-400" />
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
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 focus:border-blue-500"
                />
                <p className="text-xs text-neutral-500 mt-2">
                  Port for the local API backend (default: 8000)
                </p>
              </div>
            </div>
          </div>

          {/* Database Management */}
          <div className="bg-neutral-900/50 rounded-lg p-6 border border-neutral-800">
            <div className="flex items-center gap-3 mb-6">
              <Database className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-neutral-100">Database Management</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-neutral-300 mb-2">Backup Cleanup</h3>
                <p className="text-xs text-neutral-500 mb-4">
                  Writegeist automatically creates backups during sync operations. 
                  Clean up old backup files to save disk space. (Keeps the 15 most recent backups)
                </p>
                <Button
                  onClick={handleCleanupBackups}
                  disabled={cleaningBackups}
                  variant="outline"
                  className="bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                >
                  {cleaningBackups ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400 mr-2"></div>
                      Cleaning up...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clean Up Old Backups
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Save Section */}
          <div className="bg-neutral-900/50 rounded-lg p-6 border border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isConfigValid ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <div>
                      <span className="text-neutral-200 font-medium">Configuration is valid</span>
                      <p className="text-xs text-neutral-500 mt-1">Ready to save changes</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                    <div>
                      <span className="text-neutral-200 font-medium">Configuration incomplete</span>
                      <p className="text-xs text-neutral-500 mt-1">Please configure your API key</p>
                    </div>
                  </>
                )}
              </div>
              
              <Button
                onClick={handleSaveConfig}
                disabled={saving || !isConfigValid}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-neutral-700 disabled:text-neutral-400"
                size="lg"
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
              <div className="mt-4 p-3 bg-blue-950/20 rounded-md border border-blue-800/20">
                <p className="text-sm text-blue-400">
                  Saving configuration and restarting API backend...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 