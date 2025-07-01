import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Chapter, SyncPayload } from '@/types';

interface ChapterEditorProps {
  chapter?: Chapter | null;
  onSave?: () => void;
  onCancel?: () => void;
}

export const ChapterEditor: React.FC<ChapterEditorProps> = ({ 
  chapter = null, 
  onSave, 
  onCancel 
}) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isEditing = !!chapter;

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setText(chapter.text);
    } else {
      setTitle('');
      setText('');
    }
  }, [chapter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !text.trim()) {
      toast({
        title: "Error",
        description: "Please fill in both title and text fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        // Update existing chapter
        const updatedChapter = {
          ...chapter,
          title: title.trim(),
          text: text.trim(),
        };
        
        await window.api.updateChapter(updatedChapter);
        
        toast({
          title: "Success",
          description: "Chapter updated successfully!",
        });
      } else {
        // Create new chapter with AI analysis
        const data = await window.api.ingestChapter({ title: title.trim(), text: text.trim() });
        
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
          // Dispatch event to refresh project page
          window.dispatchEvent(new Event("project-doc-updated"));
        } catch (error) {
          console.error('Failed to sync chapter dynamically:', error);
          // Don't fail the whole operation if sync fails
        }
        
        toast({
          title: "Success",
          description: "Chapter created successfully!",
        });
      }
      
      // Clear form if creating new chapter
      if (!isEditing) {
        setTitle('');
        setText('');
      }
      
      // Call onSave callback if provided
      if (onSave) {
        onSave();
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

  const handleCancel = () => {
    if (isEditing) {
      // Reset to original values
      if (chapter) {
        setTitle(chapter.title);
        setText(chapter.text);
      }
    } else {
      // Clear form for new chapter
      setTitle('');
      setText('');
    }
    
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-100 mb-2">
            {isEditing ? `Edit Chapter: ${chapter?.title}` : 'Add New Chapter'}
          </h2>
          <p className="text-neutral-400">
            {isEditing 
              ? 'Make changes to your chapter content below.'
              : 'Enter your chapter content below. The AI will automatically extract characters, locations, and POV information.'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
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

          <div>
            <label htmlFor="text" className="block text-sm font-medium text-neutral-200 mb-2">
              Chapter Text
            </label>
            <Textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your chapter content here..."
              className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500 min-h-[400px]"
              disabled={loading}
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading || !title.trim() || !text.trim()}
              className="flex-1 bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
            >
              {loading ? 'Processing...' : (isEditing ? 'Update Chapter' : 'Save Chapter')}
            </Button>
            
            {(isEditing || onCancel) && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
                className="border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}; 