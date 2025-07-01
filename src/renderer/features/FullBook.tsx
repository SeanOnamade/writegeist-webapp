import React, { useState, useEffect } from 'react';
import { Plus, Trash, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ChapterIngest } from './ChapterIngest';
import { ChapterEditor } from './ChapterEditor';
import type { Chapter } from '@/types';

export const FullBook: React.FC = () => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showIngest, setShowIngest] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadChapters = async () => {
    try {
      const data = await window.api.getChapters();
      setChapters(data);
    } catch (error) {
      console.error('Failed to load chapters:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteChapter = async (id: string) => {
    setDeletingId(id);
    try {
      await window.api.deleteChapter(id);
      await loadChapters(); // Refresh the list
      toast({
        title: "Success",
        description: "Chapter deleted successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete chapter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const startEditingChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
  };

  const finishEditingChapter = () => {
    setEditingChapter(null);
    loadChapters(); // Refresh the list to show updated content
  };

  const cancelEditingChapter = () => {
    setEditingChapter(null);
  };

  useEffect(() => {
    loadChapters();
  }, []);

  if (showIngest) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setShowIngest(false);
              loadChapters(); // Refresh chapters when returning
            }}
            className="text-neutral-400 hover:text-neutral-100"
          >
            ← Back to Full Book
          </Button>
        </div>
        <ChapterIngest />
      </div>
    );
  }

  if (editingChapter) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={cancelEditingChapter}
            className="text-neutral-400 hover:text-neutral-100"
          >
            ← Back to Full Book
          </Button>
        </div>
        <ChapterEditor 
          chapter={editingChapter}
          onSave={finishEditingChapter}
          onCancel={cancelEditingChapter}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-neutral-100 mb-2">Full Book</h2>
            <p className="text-neutral-400">
              Manage your chapters and view the complete manuscript.
            </p>
          </div>
          <Button
            onClick={() => setShowIngest(true)}
            className="bg-neutral-100 text-neutral-900 hover:bg-neutral-200 gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Chapter
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-neutral-400">Loading chapters...</p>
          </div>
        ) : chapters.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-4">No chapters yet.</p>
            <Button
              onClick={() => setShowIngest(true)}
              variant="outline"
              className="border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
            >
              Add your first chapter
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {chapters.map((chapter, index) => (
              <div
                key={chapter.id}
                className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 hover:bg-neutral-750 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-neutral-100">
                    Chapter {index + 1}: {chapter.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-400">
                      {new Date(chapter.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-neutral-400 hover:text-blue-400 hover:bg-blue-950/20 p-2"
                      onClick={() => startEditingChapter(chapter)}
                      title="Edit chapter"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-neutral-400 hover:text-red-400 hover:bg-red-950/20 p-2"
                          disabled={deletingId === chapter.id}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-neutral-900 border-neutral-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-neutral-100">
                            Delete Chapter?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-neutral-400">
                            Are you sure you want to delete "{chapter.title}"? This action cannot be undone and will permanently remove this chapter and all its content.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-neutral-800 text-neutral-100 border-neutral-700 hover:bg-neutral-700">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteChapter(chapter.id)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Delete Chapter
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <p className="text-neutral-300 text-sm line-clamp-3 mb-4">
                  {chapter.text.substring(0, 200)}...
                </p>
                <div className="flex gap-2 text-xs">
                  {(() => {
                    try {
                      const characters = JSON.parse(chapter.characters || '[]');
                      return characters.length > 0 && (
                        <span className="bg-neutral-700 text-neutral-300 px-2 py-1 rounded">
                          Characters: {characters.join(', ')}
                        </span>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                  {(() => {
                    try {
                      const locations = JSON.parse(chapter.locations || '[]');
                      return locations.length > 0 && (
                        <span className="bg-neutral-700 text-neutral-300 px-2 py-1 rounded">
                          Locations: {locations.join(', ')}
                        </span>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 