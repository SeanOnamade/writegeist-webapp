// Re-export types for convenience
export type { Chapter, SyncPayload } from './index';

// Window API interface for Electron preload script
declare global {
  interface Window {
    api: {
      echo: (text: string) => Promise<string>;
      ingestChapter: (payload: { title: string; text: string }) => Promise<any>;
      saveChapterToDB: (chapter: any) => Promise<{ success: boolean; chapterId?: string }>;
      getChapters: () => Promise<any[]>;
      deleteChapter: (id: string) => Promise<void>;
      reorderChapters: (chapterIds: string[]) => Promise<void>;
      getProjectDoc: () => Promise<string>;
      saveProjectDoc: (markdown: string) => Promise<void>;
      appendCharacters: (chars: string[]) => Promise<{ success: boolean; added?: string[]; message?: string; error?: string }>;
      appendLocations: (locations: string[]) => Promise<{ success: boolean; added?: string[]; message?: string; error?: string }>;
      appendSummaries: (summaries: string[]) => Promise<{ success: boolean; added?: string[]; message?: string; error?: string }>;
      updateChapter: (chapter: any) => Promise<void>;
      syncChapterDynamic: (result: any) => Promise<void>;
      getConfig: () => Promise<any>;
      saveConfig: (config: any) => Promise<any>;
      registerGlobalSaveHandler: (handler: () => void) => void;
      unregisterGlobalSaveHandler: () => void;
      syncToVM: () => Promise<any>;
      syncFromVM: () => Promise<{ success: boolean; message?: string; error?: string }>;
      systemHealthCheck: () => Promise<{ success: boolean; healthStatus?: any; error?: string }>;
      cleanupBackups: () => Promise<{ success: boolean; message: string; beforeCount: number; afterCount: number; deletedCount: number }>;
      onProjectDocUpdated: (callback: () => void) => () => void;
      generateAudio: (chapterId: string) => Promise<any>;
      getAudioStatus: (chapterId: string) => Promise<any>;
      getAllAudio: () => Promise<any[]>;
    };
  }
}

// This file ensures proper TypeScript module resolution
export {}; 