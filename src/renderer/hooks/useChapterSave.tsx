import { useCallback } from 'react';
import { SaveManagerProvider, useSaveManager } from './useSaveManager';
import type { Chapter } from '@/types';

interface UseChapterSaveProps {
  chapterId: string;
  initialContent?: string;
  onSave: (content: string) => Promise<void>;
}

export function useChapterSave({ chapterId, initialContent, onSave }: UseChapterSaveProps) {
  const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

  const handleSave = useCallback(async (content: string) => {
    await onSave(content);
  }, [onSave]);

  return {
    draftKey: `chapter-${chapterId}`,
    autoSaveDelayMs: AUTO_SAVE_INTERVAL,
    initialContent: initialContent || '',
    onSave: handleSave,
  };
}

interface ChapterSaveProviderProps {
  children: React.ReactNode;
  chapterId: string;
  initialContent?: string;
  onSave: (content: string) => Promise<void>;
}

export function ChapterSaveProvider({ 
  children, 
  chapterId, 
  initialContent, 
  onSave 
}: ChapterSaveProviderProps) {
  const { draftKey, autoSaveDelayMs, onSave: handleSave } = useChapterSave({
    chapterId,
    initialContent,
    onSave,
  });

  return (
    <SaveManagerProvider
      onSave={handleSave}
      initialContent={initialContent}
      autoSaveDelayMs={autoSaveDelayMs}
      draftKeyPrefix={draftKey}
    >
      {children}
    </SaveManagerProvider>
  );
}

export { useSaveManager as useChapterSaveManager }; 