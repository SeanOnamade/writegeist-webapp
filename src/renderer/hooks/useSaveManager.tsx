import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';

export interface SaveState {
  isSaving: boolean;
  lastSavedAt: Date | null;
  lastError: string | null;
  unsyncedChanges: boolean;
}

export interface SaveManager extends SaveState {
  saveNow: () => Promise<void>;
  scheduleSave: (content: string) => void;
  setContent: (content: string) => void;
  restoreDraft: () => string | null;
  clearDraft: () => void;
  hasDraft: () => boolean;
}

const SaveManagerContext = createContext<SaveManager | null>(null);

interface SaveManagerProviderProps {
  children: ReactNode;
  onSave: (content: string) => Promise<void>;
  initialContent?: string;
  autoSaveDelayMs?: number;
  draftKeyPrefix?: string;
}

const DRAFT_BACKUP_INTERVAL = 2000; // 2 seconds
const DEFAULT_AUTO_SAVE_DELAY = 30000; // 30 seconds

export function SaveManagerProvider({ 
  children, 
  onSave, 
  initialContent = '', 
  autoSaveDelayMs = DEFAULT_AUTO_SAVE_DELAY,
  draftKeyPrefix = 'writegeist-draft'
}: SaveManagerProviderProps) {
  const [saveState, setSaveState] = useState<SaveState>({
    isSaving: false,
    lastSavedAt: null,
    lastError: null,
    unsyncedChanges: false
  });

  const currentContentRef = useRef<string>(initialContent);
  const lastSavedContentRef = useRef<string>(initialContent);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftBackupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const draftKey = `${draftKeyPrefix}-${window.location.pathname}`;

  // Save draft to localStorage every 2 seconds
  const saveDraftToStorage = useCallback(() => {
    const content = currentContentRef.current;
    if (content !== lastSavedContentRef.current) {
      localStorage.setItem(draftKey, JSON.stringify({
        content,
        timestamp: new Date().toISOString(),
        lastSavedContent: lastSavedContentRef.current
      }));
    }
  }, [draftKey]);

  // Schedule draft backup
  const scheduleDraftBackup = useCallback(() => {
    if (draftBackupTimeoutRef.current) {
      clearTimeout(draftBackupTimeoutRef.current);
    }
    draftBackupTimeoutRef.current = setTimeout(saveDraftToStorage, DRAFT_BACKUP_INTERVAL);
  }, [saveDraftToStorage]);

  // Check if there's a draft available
  const hasDraft = useCallback((): boolean => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return false;
      
      const draft = JSON.parse(stored);
      return draft.content && draft.content !== draft.lastSavedContent;
    } catch (error) {
      console.warn('Failed to check for draft:', error);
      return false;
    }
  }, [draftKey]);

  // Restore draft from localStorage
  const restoreDraft = useCallback((): string | null => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return null;
      
      const draft = JSON.parse(stored);
      if (draft.content && draft.content !== draft.lastSavedContent) {
        return draft.content;
      }
    } catch (error) {
      console.warn('Failed to restore draft:', error);
    }
    return null;
  }, [draftKey]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
  }, [draftKey]);

  // Perform the actual save operation
  const performSave = useCallback(async (content: string): Promise<void> => {
    setSaveState(prev => ({ ...prev, isSaving: true, lastError: null }));
    
    try {
      await onSave(content);
      lastSavedContentRef.current = content;
      setSaveState(prev => ({
        ...prev,
        isSaving: false,
        lastSavedAt: new Date(),
        unsyncedChanges: false,
        lastError: null
      }));
      clearDraft();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown save error';
      setSaveState(prev => ({
        ...prev,
        isSaving: false,
        lastError: errorMessage
      }));
      throw error;
    }
  }, [onSave, clearDraft]);

  // Manual save function
  const saveNow = useCallback(async (): Promise<void> => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    
    const content = currentContentRef.current;
    if (content === lastSavedContentRef.current) {
      return; // No changes to save
    }
    
    return performSave(content);
  }, [performSave]);

  // Schedule auto-save
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      const content = currentContentRef.current;
      if (content !== lastSavedContentRef.current) {
        performSave(content).catch(error => {
          console.error('Auto-save failed:', error);
        });
      }
    }, autoSaveDelayMs);
  }, [performSave, autoSaveDelayMs]);

  // Schedule save (for auto-save)
  const scheduleSave = useCallback((content: string) => {
    currentContentRef.current = content;
    setSaveState(prev => ({ ...prev, unsyncedChanges: content !== lastSavedContentRef.current }));
    
    scheduleAutoSave();
    scheduleDraftBackup();
  }, [scheduleAutoSave, scheduleDraftBackup]);

  // Set content (for external updates)
  const setContent = useCallback((content: string) => {
    currentContentRef.current = content;
    lastSavedContentRef.current = content;
    setSaveState(prev => ({ ...prev, unsyncedChanges: false }));
    clearDraft();
  }, [clearDraft]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (draftBackupTimeoutRef.current) {
        clearTimeout(draftBackupTimeoutRef.current);
      }
    };
  }, []);

  // Initialize without automatic draft restoration
  useEffect(() => {
    if (initialContent) {
      lastSavedContentRef.current = initialContent;
      currentContentRef.current = initialContent;
    }
  }, [initialContent]);

  const saveManager: SaveManager = {
    ...saveState,
    saveNow,
    scheduleSave,
    setContent,
    restoreDraft,
    clearDraft,
    hasDraft
  };

  // Expose SaveManager to global scope for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).saveManager = saveManager;
    }
  }, [saveManager]);

  return (
    <SaveManagerContext.Provider value={saveManager}>
      {children}
    </SaveManagerContext.Provider>
  );
}

export function useSaveManager(): SaveManager {
  const context = useContext(SaveManagerContext);
  if (!context) {
    throw new Error('useSaveManager must be used within a SaveManagerProvider');
  }
  return context;
} 