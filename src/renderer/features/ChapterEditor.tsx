import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChapterSaveProvider, useChapterSaveManager } from '@/renderer/hooks/useChapterSave';
import { useWritingStats } from '@/renderer/hooks/useWritingStats';
import { DraftRecoveryModal } from '@/renderer/components/DraftRecoveryModal';
import NovelEditor from '@/renderer/components/NovelEditor';
import { RotateCcw, BarChart3 } from 'lucide-react';
import type { Chapter, SyncPayload } from '@/types';

interface LocalSaveState {
  isSaving: boolean;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
}

interface ChapterEditorProps {
  chapter?: Chapter | null;
  onSave?: () => void;
  onCancel?: () => void;
}

// Inner component that has access to SaveManager context
function ChapterEditorInner({ chapter, onSave, onCancel }: ChapterEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftData, setDraftData] = useState<{ content: string; timestamp: string } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [draftModalDismissed, setDraftModalDismissed] = useState(false);
  
  // Simple local save state - bypass SaveManager complexity
  const [localSaveState, setLocalSaveState] = useState<LocalSaveState>({
    isSaving: false,
    lastSavedAt: null,
    hasUnsavedChanges: false
  });
  
  // Add auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  const saveManager = useChapterSaveManager();
  const { stats, updateStats, resetSession, formatDuration } = useWritingStats(content);

  const isEditing = !!chapter;
  const chapterId = chapter?.id || 'new-chapter';

  // Track content changes for local state
  useEffect(() => {
    const initialContent = chapter?.text || '';
    const hasChanges = content !== initialContent && content.trim() !== '';
    setLocalSaveState(prev => ({ ...prev, hasUnsavedChanges: hasChanges }));
  }, [content, chapter?.text]);

  // Simple, direct save function
  const directSave = useCallback(async (showToast = true) => {
    if (!isEditing || !content.trim()) return false;
    
    // Clear any pending auto-save when manually saving
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    
    setLocalSaveState(prev => ({ ...prev, isSaving: true }));
    
    try {
      const updatedChapter = {
        ...chapter,
        text: content, // Preserve original content formatting, including newlines
        characters: chapter.characters || [],
        locations: chapter.locations || [],
        pov: chapter.pov || [],
      };
      
      await window.api.updateChapter(updatedChapter);
      
      // Clear any drafts after successful save
      saveManager.clearDraft();
      
      setLocalSaveState({
        isSaving: false,
        lastSavedAt: new Date(),
        hasUnsavedChanges: false
      });
      
      if (showToast) {
        toast({
          title: "Saved!",
          description: "Chapter saved successfully.",
          duration: 2000,
        });
      }
      
      return true;
    } catch (error) {
      setLocalSaveState(prev => ({ ...prev, isSaving: false }));
      
      if (showToast) {
        toast({
          title: "Error",
          description: "Failed to save chapter.",
          variant: "destructive",
          duration: 3000,
        });
      }
      
      return false;
    }
  }, [isEditing, content, chapter, toast, saveManager]);

  // Simple Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        event.stopPropagation();
        
        // Only save if we're editing, not already saving, and have content
        if (isEditing && !localSaveState.isSaving && content.trim()) {
          directSave();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, localSaveState.isSaving, content, directSave]);

  // Initialize content and check for drafts
  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title || '');
      setContent(chapter.text || '');
      
      // After content is loaded, check for drafts (only once)
      if (saveManager.hasDraft() && !draftModalDismissed) {
        const draft = saveManager.restoreDraft();
        if (draft && draft !== (chapter.text || '') && draft.trim() !== (chapter.text || '').trim()) {
          setDraftData({
            content: draft,
            timestamp: new Date().toISOString()
          });
          setShowDraftModal(true);
        }
      }
    }
  }, [chapter]);

  // Update stats when content changes - debounced for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      updateStats(content);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [content, updateStats]);

  // Auto-save is handled by the SaveManager provider

  // Manual save handler
  const handleManualSave = async () => {
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please write some content before saving.",
        variant: "destructive",
      });
      return;
    }
    
    // Clear any pending auto-save when manually saving
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    
    setLoading(true);
    try {
      if (isEditing) {
        // For editing chapters, use directSave but update title first if needed
        if (title.trim() !== chapter.title) {
          // Update title separately if it changed
          const updatedChapter = {
            ...chapter,
            title: title.trim() || 'Untitled Chapter',
          };
          await window.api.updateChapter(updatedChapter);
        }
        
        // Use directSave for consistent save behavior
        const saved = await directSave(false);
        
        if (saved) {
          toast({
            title: "Success",
            description: "Chapter updated successfully!",
          });
          
          // Navigate back immediately after successful save
          if (onSave) {
            onSave();
          }
        }
      } else {
        // Generate unique untitled chapter name if no title provided for new chapters
        let chapterTitle = title.trim();
        if (!chapterTitle) {
          try {
            const existingChapters = await window.api.getChapters();
            const untitledChapters = existingChapters.filter((ch: any) => 
              ch.title && ch.title.match(/^Untitled Chapter( \d+)?$/)
            );
            
            if (untitledChapters.length === 0) {
              chapterTitle = 'Untitled Chapter';
            } else {
              const numbers = untitledChapters
                .map((ch: any) => {
                  const match = ch.title.match(/^Untitled Chapter(?: (\d+))?$/);
                  return match ? (match[1] ? parseInt(match[1]) : 0) : -1;
                })
                .filter(n => n >= 0)
                .sort((a, b) => a - b);
              
              const nextNumber = numbers.length === 0 ? 1 : numbers[numbers.length - 1] + 1;
              chapterTitle = nextNumber === 0 ? 'Untitled Chapter' : `Untitled Chapter ${nextNumber}`;
            }
          } catch (error) {
            console.warn('Failed to check existing chapters for untitled numbering:', error);
            chapterTitle = 'Untitled Chapter';
          }
        }
        
        // Create new chapter with AI analysis (with fallback)
        let data;
        try {
          // Try AI analysis first (with timeout) - preserve content formatting
          data = await Promise.race([
            window.api.ingestChapter({ title: chapterTitle, text: content }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI analysis timeout')), 10000))
          ]);
        } catch (error) {
          console.warn('AI analysis failed, creating simple chapter:', error);
          // Fallback: create simple chapter without AI analysis - preserve content formatting
          data = {
            id: `chapter_${Date.now()}`,
            title: chapterTitle,
            text: content,
            characters: [],
            locations: [],
            pov: [],
            metadata: {
              summary: "Chapter created without AI analysis.",
              tropes: [],
              wordCount: content.trim().split(/\s+/).length
            }
          };
        }
        
        // Save to database
        await window.api.saveChapterToDB(data);
        
        // Dynamic H2-aware sync to project document
        try {
          const summary = data.metadata?.summary || "Chapter summary unavailable.";
          const syncPayload: SyncPayload = {
            title: data.title,
            text: data.text,
            characters: data.characters || [],
            locations: data.locations || [],
            summary: summary,
            tropes: data.metadata?.tropes || [],
            metadata: data.metadata
          };
          await window.api.syncChapterDynamic(syncPayload);
          window.dispatchEvent(new Event("project-doc-updated"));
        } catch (error) {
          console.error('Failed to sync chapter dynamically:', error);
        }
        
        toast({
          title: "Success",
          description: "Chapter created successfully!",
        });
        
        // Navigate back immediately after successful save
        if (onSave) {
          onSave();
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} chapter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle draft restoration
  const handleRestoreDraft = () => {
    const draft = saveManager.restoreDraft();
    if (draft) {
      console.log('Restoring draft:', draft.substring(0, 100) + '...');
      
      // Clear the draft and dismiss modal
      saveManager.clearDraft();
      setShowDraftModal(false);
      setDraftModalDismissed(true);
      
      // Update content
      setContent(draft);
      // Update SaveManager state to recognize this as the current content
      saveManager.setContent(draft);
    }
  };

  // Handle draft discard
  const handleDiscardDraft = () => {
    saveManager.clearDraft();
    setShowDraftModal(false);
    setDraftModalDismissed(true);
  };

  // Simple save badge component
  const SimpleSaveBadge = () => {
    const { isSaving, lastSavedAt, hasUnsavedChanges } = localSaveState;
    
    let icon, text, colorClass, bgClass;
    
    if (isSaving) {
      icon = <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />;
      text = "Saving...";
      colorClass = "text-blue-400";
      bgClass = "bg-blue-950/20";
    } else if (hasUnsavedChanges) {
      icon = <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />;
      text = "Unsaved changes";
      colorClass = "text-yellow-400";
      bgClass = "bg-yellow-950/20";
    } else if (lastSavedAt) {
      icon = <div className="h-3 w-3 rounded-full bg-green-500" />;
      const timeSince = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
      if (timeSince < 60) {
        text = `Saved ${timeSince}s ago`;
      } else if (timeSince < 3600) {
        text = `Saved ${Math.floor(timeSince / 60)}m ago`;
      } else {
        text = `Saved ${Math.floor(timeSince / 3600)}h ago`;
      }
      colorClass = "text-green-400";
      bgClass = "bg-green-950/20";
    } else {
      icon = <div className="h-3 w-3 rounded-full bg-neutral-500" />;
      text = "Not saved";
      colorClass = "text-neutral-400";
      bgClass = "bg-neutral-950/20";
    }
    
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${colorClass} ${bgClass}`}>
        {icon}
        <span className="whitespace-nowrap">{text}</span>
      </div>
    );
  };

  // Handle navigation away with unsaved changes
  const handleCancel = () => {
    if (localSaveState.hasUnsavedChanges) {
      const shouldSave = window.confirm(
        "You have unsaved changes. Would you like to save before leaving?\n\nOK = Save and leave\nCancel = Leave without saving"
      );
      
      if (shouldSave) {
        directSave(false).then((saved) => {
          if (saved && onCancel) {
            onCancel();
          }
        });
        return;
      }
    }
    
    // No unsaved changes or user chose to discard
    if (isEditing && chapter) {
      setTitle(chapter.title || '');
      setContent(chapter.text || '');
    } else {
      setTitle('');
      setContent('');
    }
    
    if (onCancel) {
      onCancel();
    }
  };

  // Handle content changes (triggers auto-save) - now uses directSave for consistency  
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    
    // Update local state to show unsaved changes
    setLocalSaveState(prev => ({ ...prev, hasUnsavedChanges: true }));
    
    // Update SaveManager content but don't schedule auto-save (we'll use our own)
    saveManager.setContent(newContent);
    
    // Schedule auto-save using directSave for consistency
    if (isEditing) {
      // Clear existing auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      // Set new auto-save timer (30 seconds)
      autoSaveTimerRef.current = setTimeout(async () => {
        // Check if we're still in editing mode, not currently saving, and have content
        if (isEditing && !localSaveState.isSaving && newContent.trim()) {
          try {
            setLocalSaveState(prev => ({ ...prev, isSaving: true }));
            
            const updatedChapter = {
              ...chapter,
              text: newContent, // Use the content from when timer was set
              characters: chapter.characters || [],
              locations: chapter.locations || [],
              pov: chapter.pov || [],
            };
            
            await window.api.updateChapter(updatedChapter);
            
            // Clear any drafts after successful save
            saveManager.clearDraft();
            
            setLocalSaveState({
              isSaving: false,
              lastSavedAt: new Date(),
              hasUnsavedChanges: false
            });
          } catch (error) {
            console.error('Auto-save failed:', error);
            setLocalSaveState(prev => ({ ...prev, isSaving: false }));
          }
        }
      }, 30000);
    }
  }, [isEditing, saveManager, chapter]);

  // Clean up auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Draft detection and handling
  useEffect(() => {
    const checkForDrafts = async () => {
      if (!isEditing) return;
      
      // Check if there's a draft available
      if (saveManager.hasDraft()) {
        const draftContent = saveManager.restoreDraft();
        
        if (draftContent && draftContent !== content) {
          // Only show draft modal if:
          // 1. Draft content is different from current content
          // 2. Not currently saving
          // 3. Draft hasn't been dismissed recently
          // 4. Has recent save state (to avoid showing after successful saves)
          const recentSave = localSaveState.lastSavedAt && 
            (Date.now() - localSaveState.lastSavedAt.getTime()) < 10000; // 10 seconds
          
          const shouldShowDraft = 
            !localSaveState.isSaving && 
            !draftModalDismissed &&
            !recentSave;
          
          if (shouldShowDraft) {
            setDraftData({
              content: draftContent,
              timestamp: new Date().toISOString() // Convert to ISO string format
            });
            setShowDraftModal(true);
          }
        }
      }
    };
    
    // Small delay to let the component settle
    const timer = setTimeout(checkForDrafts, 500);
    return () => clearTimeout(timer);
  }, [isEditing, saveManager, content, localSaveState.lastSavedAt, localSaveState.isSaving, draftModalDismissed]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header with save badge and stats */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-neutral-100">
            {isEditing ? `Edit: ${chapter?.title}` : 'New Chapter'}
          </h2>
          <SimpleSaveBadge />
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick Save Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => directSave()}
            disabled={localSaveState.isSaving || !content.trim()}
            className="text-neutral-400 hover:text-neutral-100"
            title="Quick Save (Ctrl+S)"
          >
            Save
          </Button>
          
          {/* Writing Stats Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="text-neutral-400 hover:text-neutral-100"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          
          {/* Reset Session Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={resetSession}
            className="text-neutral-400 hover:text-neutral-100"
            title="Reset writing session"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Writing Stats Bar */}
      {showStats && (
        <div className="flex items-center gap-6 px-4 py-2 bg-neutral-900/30 border-b border-neutral-800 text-sm text-neutral-400">
          <span className="flex items-center gap-1">
            <strong className="text-neutral-300">{stats.wordCount.toLocaleString()}</strong> words
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-neutral-300">{stats.sessionWordCount.toLocaleString()}</strong> this session
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-neutral-300">{stats.wordsPerMinute}</strong> WPM
          </span>
          <span className="flex items-center gap-1">
            Session: <strong className="text-neutral-300">{formatDuration(stats.sessionDuration)}</strong>
          </span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Title Input */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-medium text-neutral-200 mb-2">
              Chapter Title
            </label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter chapter title..."
              className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500"
              disabled={loading}
            />
          </div>

          {/* Rich Text Editor */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-200 mb-2">
              Chapter Content
            </label>
            <div className="border border-neutral-700 rounded-lg overflow-hidden bg-neutral-800">
              <NovelEditor
                initialMarkdown={content}
                onChange={handleContentChange}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleManualSave}
              disabled={loading || !content.trim()}
              className="flex-1 bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
            >
              {loading ? 'Processing...' : (isEditing ? 'Save Chapter' : 'Create Chapter')}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Draft Recovery Modal */}
      <DraftRecoveryModal
        isOpen={showDraftModal}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
        draftTimestamp={draftData?.timestamp}
        chapterTitle={chapter?.title}
      />
    </div>
  );
}

// Main component with SaveManager provider
export const ChapterEditor: React.FC<ChapterEditorProps> = ({ chapter, onSave, onCancel }) => {
  // Generate a unique ID for new chapters to avoid draft key conflicts
  const [uniqueNewChapterId] = useState(() => `new-chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const chapterId = chapter?.id || uniqueNewChapterId;
  const initialContent = chapter?.text || '';

  const handleSave = async (content: string) => {
    // This is the actual auto-save function that gets called by SaveManager
    if (!chapter?.id) {
      return;
    }
    
    try {
      // For auto-save, include all required fields
      const updatedChapter = {
        ...chapter,
        text: content,
        // Ensure required fields are present
        characters: chapter.characters || [],
        locations: chapter.locations || [],
        pov: chapter.pov || [],
      };
      
      await window.api.updateChapter(updatedChapter);
      
      // Only log on errors, not on every successful save
    } catch (error) {
      console.error('Auto-save failed:', error);
      throw error;
    }
  };

  return (
    <ChapterSaveProvider
      chapterId={chapterId}
      initialContent={initialContent}
      onSave={handleSave}
    >
      <ChapterEditorInner
        chapter={chapter}
        onSave={onSave}
        onCancel={onCancel}
      />
    </ChapterSaveProvider>
  );
}; 