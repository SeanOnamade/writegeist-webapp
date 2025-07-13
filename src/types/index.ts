export interface Chapter {
  id: string;
  title: string;
  text: string;
  characters: string; // JSON string
  locations: string; // JSON string
  pov: string; // JSON string
  createdAt: string;
}

export interface SyncPayload {
  title: string;
  text: string;
  characters: string[];
  locations: string[];
  summary: string;
  tropes?: string[];
  metadata?: {
    word_count: number;
    character_count: number;
    location_count: number;
    reading_time_minutes: number;
    sentiment: string;
    summary: string;
    tropes: string[];
  };
}

// Extend the global Window interface to include our API
declare global {
  interface Window {
    api: {
      echo: (text: string) => Promise<string>;
      ingestChapter: (payload: { title: string; text: string }) => Promise<any>;
      saveChapterToDB: (chapter: any) => Promise<{ success: boolean; chapterId?: string }>;
      getChapters: () => Promise<Chapter[]>;
      deleteChapter: (id: string) => Promise<void>;
      getProjectDoc: () => Promise<string>;
      saveProjectDoc: (markdown: string) => Promise<void>;
      appendCharacters: (chars: string[]) => Promise<{ success: boolean; added?: string[]; message?: string; error?: string }>;
      appendLocations: (locations: string[]) => Promise<{ success: boolean; added?: string[]; message?: string; error?: string }>;
      appendSummaries: (summaries: string[]) => Promise<{ success: boolean; added?: string[]; message?: string; error?: string }>;
      updateChapter: (chapter: any) => Promise<void>;
      syncChapterDynamic: (result: SyncPayload) => Promise<{ success: boolean }>;
      getConfig: () => Promise<{ OPENAI_API_KEY: string; PORT: number }>;
      saveConfig: (config: { OPENAI_API_KEY: string; PORT: number }) => Promise<{ success: boolean }>;
      registerGlobalSaveHandler: (handler: () => void) => void;
      unregisterGlobalSaveHandler: () => void;
    };
  }
} 