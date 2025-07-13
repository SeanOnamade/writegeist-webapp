import React, { useState, useEffect, useRef, useCallback } from 'react';
import EnhancedNovelEditor from '../components/EnhancedNovelEditor';
import { useToast } from '@/hooks/use-toast';
import { normalizeMarkdown } from '@/lib/normalizeMarkdown';

// Simple Badge component
const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'secondary' }> = ({ 
  children, 
  variant = 'default' 
}) => (
  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
    variant === 'secondary' 
      ? 'bg-neutral-700 text-neutral-300' 
      : 'bg-blue-600 text-white'
  }`}>
    {children}
  </span>
);

export const ProjectPage: React.FC = () => {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const editorRef = useRef<any>(null);
  const autoRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const defaultMarkdown = `# My Project

## Ideas-Notes

## Setting

## Full Outline

## Characters`;

  useEffect(() => {
    loadProjectDoc();
  }, []);

  // Simple scroll restoration prevention
  useEffect(() => {
    // Prevent browser scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  const refetchMarkdown = useCallback(async () => {
    if (isRefreshing) {
      console.log('Refresh already in progress, skipping...');
      return;
    }
    
    try {
      setIsRefreshing(true);
      
      // STEP 1: First, sync any local changes to cloud to prevent data loss
      console.log('Syncing local changes to cloud before refresh...');
      
      try {
        // Get current local content
        const localContent = await window.api.getProjectDoc();
        
        if (localContent) {
          // Push local changes to cloud first (same as IdeaInbox sync)
          const syncController = new AbortController();
          const syncTimeoutId = setTimeout(() => syncController.abort(), 15000);
          
          const syncResponse = await fetch('https://python-fastapi-u50080.vm.elestio.app/n8n/proposal', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              section: "FULL_DOCUMENT_SYNC",
              replace: localContent
            }),
            signal: syncController.signal,
          });
          
          clearTimeout(syncTimeoutId);
          
          if (syncResponse.ok) {
            console.log('Successfully synced local changes to cloud before refresh');
          } else {
            console.warn(`Failed to sync local changes to cloud: HTTP ${syncResponse.status}`);
          }
        }
      } catch (localSyncError) {
        console.warn('Failed to sync local changes to cloud before refresh:', localSyncError);
        // Continue with refresh even if local sync fails - local content is still safe
      }
      
      // STEP 2: Now fetch the latest content from cloud (which includes our local changes)
      console.log('Fetching latest content from cloud database...');
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('https://python-fastapi-u50080.vm.elestio.app/project/raw', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const cloudData = await response.json();
          if (cloudData.raw_markdown) {
            // Save the cloud content to local database
            await window.api.saveProjectDoc(cloudData.raw_markdown);
            console.log('Successfully synced cloud content to local database');
          } else {
            console.warn('Cloud database returned empty content');
          }
        } else {
          console.warn(`Cloud sync failed: HTTP ${response.status}`);
        }
      } catch (syncError) {
        if (syncError.name === 'AbortError') {
          console.warn('Cloud sync timed out after 10 seconds, using local database');
        } else {
          console.warn('Failed to sync from cloud, using local database:', syncError);
        }
        // Continue with local database refresh even if cloud sync fails
      }
      
      // STEP 3: Now load from local database (which should have the latest content)
      await loadProjectDoc();
      setRefreshPending(false); // Clear pending refresh state
      toast({
        title: "Refreshed!",
        description: "Project content has been reloaded with latest changes preserved.",
        variant: "default",
      });
    } catch (error) {
      console.error('Refresh failed:', error);
      toast({
        title: "Refresh failed",
        description: "Failed to reload project content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [toast, isRefreshing]);

  // Add keyboard shortcut for refresh (F5 or Ctrl+R)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
        event.preventDefault();
        refetchMarkdown();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [refetchMarkdown]);

  useEffect(() => {
    const onUpdate = () => {
      setRefreshPending(true);
      toast({
        title: "New content available",
        description: "Press F5 or Ctrl+R to refresh and see the latest changes.",
        variant: "default",
      });
      
      // Clear any existing auto-refresh timeout
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
      }
      
      // Auto-refresh after 3 seconds if user doesn't manually refresh
      autoRefreshTimeoutRef.current = setTimeout(() => {
        if (refreshPending && !isRefreshing) {
          console.log('Auto-refreshing project content after 3 seconds...');
          refetchMarkdown();
        }
      }, 3000);
    };
    
    window.addEventListener("project-doc-updated", onUpdate);
    
    return () => {
      window.removeEventListener("project-doc-updated", onUpdate);
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
      }
    };
  }, [refreshPending, refetchMarkdown, isRefreshing]);

  const loadProjectDoc = async () => {
    try {
      setIsLoading(true);
      const doc = await window.api.getProjectDoc();
      // Apply normalization as a safety net for documents loaded from database
      const normalizedDoc = normalizeMarkdown(doc || defaultMarkdown);
      setMarkdown(normalizedDoc);
      
      // Set last project ID in localStorage for auto-open functionality
      localStorage.setItem('lastProjectId', '1');
    } catch (error) {
      console.error('Failed to load project document:', error);
      setMarkdown(defaultMarkdown);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDoc = async (newMarkdown: string) => {
    console.log('saveDoc called with content length:', newMarkdown.length);
    setSaving(true);
    try {
      await window.api.saveProjectDoc(newMarkdown);
      setMarkdown(newMarkdown);
      
      // Trigger a custom event to notify Layout component to refresh sections
      window.dispatchEvent(new CustomEvent('projectUpdated'));
      
      toast({
        title: "Saved!",
        description: "Project document has been saved successfully.",
        variant: "default",
      });
      console.log('Database save completed successfully');
    } catch (error) {
      console.error('Failed to save project document:', error);
      toast({
        title: "Save failed",
        description: "Failed to save project document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (newMarkdown: string) => {
    await saveDoc(newMarkdown);
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-neutral-800 rounded mb-4"></div>
            <div className="h-4 bg-neutral-800 rounded mb-2"></div>
            <div className="h-4 bg-neutral-800 rounded mb-2"></div>
            <div className="h-4 bg-neutral-800 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="project-page-container" className="flex-1 p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
              Project
              {saving && <Badge>Saving…</Badge>}
              {refreshPending && <Badge variant="secondary">Refresh Pending</Badge>}
            </h1>
            <p className="text-neutral-400 text-sm">Manage your project overview and notes with inline editing</p>
          </div>
          <button
            onClick={refetchMarkdown}
            disabled={isLoading || isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-md border transition-all duration-200 hover:scale-105 ${
              refreshPending 
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 animate-pulse' 
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border-neutral-600'
            }`}
            title={
              isRefreshing 
                ? "Syncing local changes and refreshing..." 
                : refreshPending 
                  ? "New content available - click to refresh" 
                  : "Refresh content (preserves local changes)"
            }
          >
            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? 'Loading...' : isRefreshing ? 'Refreshing...' : refreshPending ? 'Refresh Now' : 'Refresh'}
          </button>
        </div>

        <EnhancedNovelEditor 
          initialMarkdown={markdown}
          onChange={handleSave}
          onSave={saveDoc}
        />
      </div>
    </div>
  );
}; 