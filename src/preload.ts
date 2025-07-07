// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Global save manager for keyboard shortcuts
let globalSaveHandler: (() => void) | null = null;

// Global keyboard handler for Ctrl/Cmd+S
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    event.stopPropagation();
    
    if (globalSaveHandler) {
      globalSaveHandler();
    }
  }
}, { capture: true });

contextBridge.exposeInMainWorld('api', {
  echo: async (text: string) => {
    const res = await fetch('http://127.0.0.1:8000/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return (await res.json()).echo as string;
  },
  ingestChapter: async (payload: { title: string; text: string }) => {
    const res = await fetch('http://127.0.0.1:8000/ingest_chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  },
  saveChapterToDB: async (chapter: any) => {
    return await ipcRenderer.invoke('save-chapter', chapter);
  },
  getChapters: async () => {
    return await ipcRenderer.invoke('get-chapters');
  },
  deleteChapter: async (id: string) => {
    return await ipcRenderer.invoke('delete-chapter', id);
  },
  reorderChapters: async (chapterIds: string[]) => {
    return await ipcRenderer.invoke('reorder-chapters', chapterIds);
  },
  getProjectDoc: async () => {
    return await ipcRenderer.invoke('get-project-doc');
  },
  saveProjectDoc: async (markdown: string) => {
    return await ipcRenderer.invoke('save-project-doc', markdown);
  },
  appendCharacters: async (chars: string[]) => {
    return await ipcRenderer.invoke('append-characters', chars);
  },
  updateChapter: async (chapter: any) => {
    return await ipcRenderer.invoke('update-chapter', chapter);
  },
  syncChapterDynamic: async (result: any) => {
    return await ipcRenderer.invoke('sync-chapter-dynamic', result);
  },
  getConfig: async () => {
    return await ipcRenderer.invoke('get-config');
  },
  saveConfig: async (config: any) => {
    return await ipcRenderer.invoke('save-config', config);
  },
  registerGlobalSaveHandler: (handler: () => void) => {
    globalSaveHandler = handler;
  },
  unregisterGlobalSaveHandler: () => {
    globalSaveHandler = null;
  },
  syncToVM: async () => {
    return await ipcRenderer.invoke('sync-to-vm');
  },
  syncFromVM: async () => {
    return await ipcRenderer.invoke('sync-from-vm');
  },
});
