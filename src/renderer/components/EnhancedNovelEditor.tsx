import React, { useEffect, useState, useCallback } from 'react';
import { SaveManagerProvider, useSaveManager } from '../hooks/useSaveManager';
import NovelEditor, { NovelEditorProps } from './NovelEditor';
import SaveStatusIndicator from './SaveStatusIndicator';
import DraftRestoreNotification from './DraftRestoreNotification';
import DatabaseUpdateNotification from './DatabaseUpdateNotification';

interface EnhancedNovelEditorProps extends NovelEditorProps {
  onSave?: (content: string) => Promise<void>;
}

// Internal component that uses SaveManager
function EditorWithSaveManager({ 
  initialMarkdown, 
  onChange, 
  ...props 
}: NovelEditorProps) {
  const { saveNow, scheduleSave, hasDraft, restoreDraft, clearDraft } = useSaveManager();
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const [draftContent, setDraftContent] = useState<string | null>(null);

  // Handle content changes from NovelEditor
  const handleEditorChange = useCallback((content: string) => {
    // Schedule save with the SaveManager
    scheduleSave(content);
  }, [scheduleSave]);

  // Register global save handler
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api) {
      const globalSaveHandler = () => {
        saveNow().catch(error => {
          console.error('Global save failed:', error);
        });
      };
      
      window.api.registerGlobalSaveHandler(globalSaveHandler);
      
      return () => {
        window.api.unregisterGlobalSaveHandler();
      };
    }
  }, [saveNow]);

  // Check for draft on mount
  useEffect(() => {
    if (hasDraft()) {
      const draft = restoreDraft();
      if (draft && draft !== initialMarkdown) {
        setDraftContent(draft);
        setShowDraftRestore(true);
      }
    }
  }, [hasDraft, restoreDraft, initialMarkdown]);

  // Handle draft restoration
  const handleRestoreDraft = useCallback((content: string) => {
    // This will trigger a re-render with the restored content
    onChange(content);
    setShowDraftRestore(false);
  }, [onChange]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setShowDraftRestore(false);
  }, [clearDraft]);

  // Handle database reload
  const handleDatabaseReload = useCallback(() => {
    // This could trigger a reload of the data from the database
    window.location.reload();
  }, []);

  return (
    <div className="relative">
      {/* Original NovelEditor */}
      <NovelEditor
        initialMarkdown={initialMarkdown}
        onChange={handleEditorChange}
        {...props}
      />

      {/* Enhanced components */}
      <SaveStatusIndicator />
      
      {/* Draft restoration notification */}
      {showDraftRestore && draftContent && (
        <DraftRestoreNotification
          onRestore={handleRestoreDraft}
          onDiscard={handleDiscardDraft}
        />
      )}

      {/* Database update notification */}
      <DatabaseUpdateNotification onReload={handleDatabaseReload} />
    </div>
  );
}

export default function EnhancedNovelEditor({ 
  initialMarkdown, 
  onChange, 
  onSave,
  ...props 
}: EnhancedNovelEditorProps) {
  // Save function that uses onSave if provided, otherwise calls onChange
  const handleSave = useCallback(async (content: string) => {
    if (onSave) {
      await onSave(content);
    } else {
      onChange(content);
    }
  }, [onChange, onSave]);

  return (
    <SaveManagerProvider 
      onSave={handleSave} 
      initialContent={initialMarkdown}
      draftKeyPrefix="writegeist-draft"
    >
      <EditorWithSaveManager
        initialMarkdown={initialMarkdown}
        onChange={onChange}
        {...props}
      />
    </SaveManagerProvider>
  );
} 