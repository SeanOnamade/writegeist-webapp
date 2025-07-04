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

  const refetchMarkdown = () => {
    loadProjectDoc();
  };

  useEffect(() => {
    const onUpdate = () => refetchMarkdown();
    window.addEventListener("project-doc-updated", onUpdate);
    return () => window.removeEventListener("project-doc-updated", onUpdate);
  }, []);

  // Listen for project-doc-updated event and refresh editor content
  useEffect(() => {
    const handleDocUpdate = async () => {
      try {
        const newMarkdown = await window.api.getProjectDoc();
        if (newMarkdown && newMarkdown !== markdown) {
          setMarkdown(newMarkdown);
        }
      } catch (error) {
        console.error('Failed to refresh project document:', error);
      }
    };
    
    window.addEventListener("project-doc-updated", handleDocUpdate);
    return () => window.removeEventListener("project-doc-updated", handleDocUpdate);
  }, [markdown]);

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
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
              Project
              {saving && <Badge>Saving…</Badge>}
            </h1>
            <p className="text-neutral-400 text-sm">Manage your project overview and notes with inline editing</p>
          </div>
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