// Re-export types for convenience
export type { Chapter, SyncPayload } from './index';

// Window API interface for Electron preload script
declare global {
  interface Window {
    api: {
      echo: (text: string) => Promise<string>;
      ingestChapter: (payload: { title: string; text: string }) => Promise<any>;
      saveChapterToDB: (chapter: any) => Promise<void>;
      getChapters: () => Promise<any[]>;
      deleteChapter: (id: string) => Promise<void>;
      reorderChapters: (chapterIds: string[]) => Promise<void>;
      getProjectDoc: () => Promise<string>;
      saveProjectDoc: (markdown: string) => Promise<void>;
      appendCharacters: (chars: string[]) => Promise<any>;
      updateChapter: (chapter: any) => Promise<void>;
      syncChapterDynamic: (result: any) => Promise<void>;
      getConfig: () => Promise<any>;
      saveConfig: (config: any) => Promise<any>;
      registerGlobalSaveHandler: (handler: () => void) => void;
      unregisterGlobalSaveHandler: () => void;
      syncToVM: () => Promise<any>;
      syncFromVM: () => Promise<{ success: boolean; message?: string; error?: string }>;
    };
  }
}

// This file ensures proper TypeScript module resolution
export {}; 