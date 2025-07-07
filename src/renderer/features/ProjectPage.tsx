import React, { useState, useEffect, useRef } from 'react';
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
  const editorRef = useRef<any>(null);
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

  const refetchMarkdown = async () => {
    try {
      await loadProjectDoc();
      setRefreshPending(false); // Clear pending refresh state
      toast({
        title: "Refreshed!",
        description: "Project content has been reloaded from database.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Failed to reload project content. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const onUpdate = () => {
      setRefreshPending(true);
      toast({
        title: "New content available",
        description: "Click the refresh button to see the latest changes.",
        variant: "default",
      });
    };
    window.addEventListener("project-doc-updated", onUpdate);
    return () => window.removeEventListener("project-doc-updated", onUpdate);
  }, []);

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
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-md border transition-all duration-200 hover:scale-105 ${
              refreshPending 
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 animate-pulse' 
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border-neutral-600'
            }`}
            title={refreshPending ? "New content available - click to refresh" : "Refresh content from database"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? 'Loading...' : refreshPending ? 'Refresh Now' : 'Refresh'}
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