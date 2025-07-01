import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkSlug from 'remark-slug';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Save, X } from 'lucide-react';

export const ProjectPage: React.FC = () => {
  const [markdown, setMarkdown] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const defaultMarkdown = `# My Project

## Ideas/Notes

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

  const loadProjectDoc = async () => {
    try {
      setIsLoading(true);
      const doc = await window.api.getProjectDoc();
      setMarkdown(doc || defaultMarkdown);
      
      // Set last project ID in localStorage for auto-open functionality
      localStorage.setItem('lastProjectId', '1');
    } catch (error) {
      console.error('Failed to load project document:', error);
      setMarkdown(defaultMarkdown);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setEditContent(markdown);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await window.api.saveProjectDoc(editContent);
      setMarkdown(editContent);
      setIsEditing(false);
      
      // Trigger a custom event to notify Layout component to refresh sections
      window.dispatchEvent(new CustomEvent('projectUpdated'));
    } catch (error) {
      console.error('Failed to save project document:', error);
    }
  };

  const handleCancel = () => {
    setEditContent('');
    setIsEditing(false);
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
            <h1 className="text-2xl font-bold text-neutral-100">Project</h1>
            <p className="text-neutral-400 text-sm">Manage your project overview and notes</p>
          </div>
          {!isEditing ? (
            <Button
              onClick={handleEdit}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[600px] font-mono text-sm bg-neutral-900 border-neutral-700 text-neutral-100"
              placeholder="Write your project markdown here..."
            />
          </div>
        ) : (
          <div className="prose prose-invert prose-neutral max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkSlug]}
              components={{
                h2: ({ children, ...props }) => (
                  <h2 {...props} className="scroll-mt-6">
                    {children}
                  </h2>
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}; 