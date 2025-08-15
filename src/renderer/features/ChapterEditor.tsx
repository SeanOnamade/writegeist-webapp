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
  const [saving, setSaving] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftData, setDraftData] = useState<{ content: string; timestamp: string } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [draftModalDismissed, setDraftModalDismissed] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  // Add auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const saveManager = useChapterSaveManager();
  const { stats, updateStats, resetSession, formatDuration } = useWritingStats(content);

  const isEditing = !!chapter;
  const chapterId = chapter?.id || 'new-chapter';
  const hasUnsavedChanges = content !== (chapter?.text || '') && content.trim() !== '';

  // Simple, direct save function
  const directSave = useCallback(async (showToast = true) => {
    if (!isEditing || !content.trim()) return false;
    
    // Clear any pending auto-save when manually saving
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    
    setSaving(true);
    
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
      
      setLastSavedAt(new Date());
      
      if (showToast) {
        toast({
          title: "Saved!",
          description: "Chapter saved successfully.",
          duration: 2000,
        });
      }
      
      return true;
    } catch (error) {
      if (showToast) {
        toast({
          title: "Error",
          description: "Failed to save chapter.",
          variant: "destructive",
          duration: 3000,
        });
      }
      
      return false;
    } finally {
      setSaving(false);
    }
  }, [isEditing, content, chapter, toast, saveManager]);

  // Simple Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        event.stopPropagation();
        
        // Save if we have content and aren't already saving
        if (!saving && content.trim()) {
          if (isEditing) {
            // For editing, use directSave
          directSave();
          } else {
            // For new chapters, trigger the manual save
            const manualSaveEvent = new CustomEvent('manualSave');
            document.dispatchEvent(manualSaveEvent);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, saving, content, directSave]);

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
            description: "Chapter updated successfully.",
          });
          onSave?.();
        }
      } else {
        // Creating new chapter
        const chapterTitle = title.trim() || 'Untitled Chapter';
        const newChapter = {
          title: chapterTitle,
          text: content,
          characters: [],
          locations: [],
          pov: [],
        };
        
        // First save the chapter to get an ID
        const saveResult = await window.api.saveChapterToDB(newChapter);
        
        // Then extract metadata using the ingest API
        try {
          const ingestResult = await window.api.ingestChapter({
            title: chapterTitle,
            text: content
          });
          
          // Update the chapter with extracted metadata using the returned chapter ID
          if (ingestResult && saveResult.chapterId && (ingestResult.characters || ingestResult.locations || ingestResult.pov)) {
            await window.api.updateChapter({
              id: saveResult.chapterId,
              title: chapterTitle,
              text: content,
              characters: ingestResult.characters || [],
              locations: ingestResult.locations || [],
              pov: ingestResult.pov || [],
            });
            
            // Auto-populate project page with extracted metadata
            try {
              const autoPopulatePromises = [];
              
              // Add characters to project page
              if (ingestResult.characters && ingestResult.characters.length > 0) {
                autoPopulatePromises.push(
                  window.api.appendCharacters(ingestResult.characters)
                    .then((result) => {
                      if (result.success && result.added && result.added.length > 0) {
                        console.log('Auto-populated characters:', result.added);
                      }
                    })
                    .catch((error) => {
                      console.warn('Failed to auto-populate characters:', error);
                    })
                );
              }
              
              // Add locations to project page
              if (ingestResult.locations && ingestResult.locations.length > 0) {
                autoPopulatePromises.push(
                  window.api.appendLocations(ingestResult.locations)
                    .then((result) => {
                      if (result.success && result.added && result.added.length > 0) {
                        console.log('Auto-populated locations:', result.added);
                      }
                    })
                    .catch((error) => {
                      console.warn('Failed to auto-populate locations:', error);
                    })
                );
              }
              
              // Add summaries to project page
              if (ingestResult.metadata && ingestResult.metadata.summary && ingestResult.metadata.summary.trim()) {
                autoPopulatePromises.push(
                  window.api.appendSummaries([ingestResult.metadata.summary])
                    .then((result) => {
                      if (result.success && result.added && result.added.length > 0) {
                        console.log('Auto-populated summaries:', result.added);
                      }
                    })
                    .catch((error) => {
                      console.warn('Failed to auto-populate summaries:', error);
                    })
                );
              }
              
              // Wait for all auto-population to complete
              if (autoPopulatePromises.length > 0) {
                await Promise.all(autoPopulatePromises);
              }
            } catch (autoPopulateError) {
              console.warn('Auto-population failed:', autoPopulateError);
              // Don't fail the entire operation if auto-population fails
            }
          }
          
          // Enhanced success message with auto-population feedback
          let successMessage = "Chapter created and analyzed successfully.";
          
          // Check if auto-population happened and add to message
          if (ingestResult && saveResult.chapterId && (ingestResult.characters || ingestResult.locations || ingestResult.pov || (ingestResult.metadata && ingestResult.metadata.summary))) {
            const parts = [];
            if (ingestResult.characters && ingestResult.characters.length > 0) {
              parts.push(`${ingestResult.characters.length} character${ingestResult.characters.length > 1 ? 's' : ''}`);
            }
            if (ingestResult.locations && ingestResult.locations.length > 0) {
              parts.push(`${ingestResult.locations.length} location${ingestResult.locations.length > 1 ? 's' : ''}`);
            }
            if (ingestResult.metadata && ingestResult.metadata.summary && ingestResult.metadata.summary.trim()) {
              parts.push('1 summary');
            }
            if (parts.length > 0) {
              successMessage += ` Added ${parts.join(', ')} to project page.`;
            }
          }
          
          toast({
            title: "Success",
            description: successMessage,
          });
        } catch (ingestError) {
          console.error('Chapter metadata extraction failed:', ingestError);
        toast({
          title: "Success",
            description: "Chapter created successfully. Metadata extraction failed - AI service may be unavailable.",
        });
        }
        
        onSave?.();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} chapter.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Listen for manual save events from Ctrl+S
  useEffect(() => {
    const handleManualSaveEvent = () => {
      if (!isEditing && content.trim()) {
        handleManualSave();
      }
    };

    document.addEventListener('manualSave', handleManualSaveEvent);
    return () => document.removeEventListener('manualSave', handleManualSaveEvent);
  }, [isEditing, content, handleManualSave]);

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
    let icon, text, colorClass, bgClass;
    
    if (saving) {
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
    if (hasUnsavedChanges) {
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
    
    // Update SaveManager content but don't schedule auto-save (we'll use our own)
    saveManager.setContent(newContent);
    
    // DISABLED: Schedule auto-save using directSave for consistency - conflicts with SaveManager
    if (isEditing) {
      // Clear existing auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      // Set new auto-save timer (30 seconds)
      // DISABLED: Auto-save timer to prevent conflicts with SaveManager
      // autoSaveTimerRef.current = setTimeout(async () => {
      //   // Check if we're still in editing mode, not currently saving, and have content
      //   if (isEditing && !saving && newContent.trim()) {
      //     try {
      //       setSaving(true);
      //       
      //       const updatedChapter = {
      //         ...chapter,
      //         text: newContent, // Use the content from when timer was set
      //         characters: chapter.characters || [],
      //         locations: chapter.locations || [],
      //         pov: chapter.pov || [],
      //       };
      //       
      //       await window.api.updateChapter(updatedChapter);
      //       
      //       // Clear any drafts after successful save
      //       saveManager.clearDraft();
      //       
      //       setLastSavedAt(new Date());
      //     } catch (error) {
      //       console.error('Auto-save failed:', error);
      //       setSaving(false);
      //     }
      //   }
      // }, 30000);
    }
  }, [isEditing, saveManager, chapter, saving]);

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
          const recentSave = lastSavedAt && 
            (Date.now() - lastSavedAt.getTime()) < 10000; // 10 seconds
          
          const shouldShowDraft = 
            !saving && 
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
  }, [isEditing, saveManager, content, lastSavedAt, saving, draftModalDismissed]);

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
            disabled={saving || !content.trim()}
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
