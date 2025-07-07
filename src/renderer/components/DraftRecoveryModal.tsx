import React from 'react';
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
} from '@/components/ui/alert-dialog';
import { FileText, Clock } from 'lucide-react';

interface DraftRecoveryModalProps {
  isOpen: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  draftTimestamp?: string;
  chapterTitle?: string;
}

export function DraftRecoveryModal({
  isOpen,
  onRestore,
  onDiscard,
  draftTimestamp,
  chapterTitle,
}: DraftRecoveryModalProps) {
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffMins > 0) {
        return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      } else {
        return 'just now';
      }
    } catch {
      return 'recently';
    }
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="bg-neutral-900 border-neutral-700 max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-amber-950/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <AlertDialogTitle className="text-neutral-100 text-lg">
                Unsaved Draft Detected
              </AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription className="text-neutral-400 text-sm">
            {chapterTitle ? (
              <>
                We found an unsaved draft for <span className="font-medium text-neutral-300">"{chapterTitle}"</span>
                {draftTimestamp && (
                  <span className="flex items-center gap-1 mt-2 text-xs text-neutral-500">
                    <Clock className="h-3 w-3" />
                    Last modified {formatTimestamp(draftTimestamp)}
                  </span>
                )}
              </>
            ) : (
              <>
                We found an unsaved draft for this chapter
                {draftTimestamp && (
                  <span className="flex items-center gap-1 mt-2 text-xs text-neutral-500">
                    <Clock className="h-3 w-3" />
                    Last modified {formatTimestamp(draftTimestamp)}
                  </span>
                )}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel 
            onClick={onDiscard}
            className="bg-neutral-800 text-neutral-100 border-neutral-700 hover:bg-neutral-700"
          >
            Discard Draft
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onRestore}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            Restore Draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 