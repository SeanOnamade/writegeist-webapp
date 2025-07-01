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
}

// Extend the global Window interface to include our API
declare global {
  interface Window {
    api: {
      echo: (text: string) => Promise<string>;
      ingestChapter: (payload: { title: string; text: string }) => Promise<any>;
      saveChapterToDB: (chapter: any) => Promise<void>;
      getChapters: () => Promise<Chapter[]>;
      deleteChapter: (id: string) => Promise<void>;
      getProjectDoc: () => Promise<string>;
      saveProjectDoc: (markdown: string) => Promise<void>;
      appendCharacters: (chars: string[]) => Promise<void>;
      updateChapter: (chapter: any) => Promise<void>;
      syncChapterDynamic: (result: SyncPayload) => Promise<{ success: boolean }>;
    };
  }
} 