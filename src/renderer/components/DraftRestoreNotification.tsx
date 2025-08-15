import { useState, useEffect } from 'react';
import { useSaveManager } from '../hooks/useSaveManager';

interface DraftRestoreNotificationProps {
  onRestore: (content: string) => void;
  onDiscard: () => void;
}

export default function DraftRestoreNotification({ onRestore, onDiscard }: DraftRestoreNotificationProps) {
  const { restoreDraft, clearDraft } = useSaveManager();
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const draft = restoreDraft();
    if (draft) {
      setDraftContent(draft);
      setIsVisible(true);
    }
  }, [restoreDraft]);

  const handleRestore = () => {
    if (draftContent) {
      onRestore(draftContent);
      setIsVisible(false);
    }
  };

  const handleDiscard = () => {
    clearDraft();
    onDiscard();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !draftContent) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-neutral-800 border border-neutral-600 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">!</span>
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              Unsaved Draft Detected
            </h3>
            <p className="text-neutral-300 text-sm mb-4">
              We found unsaved changes from a previous session. Would you like to restore them or continue with the current content?
            </p>
            
            <div className="bg-neutral-700 rounded p-3 mb-4 max-h-32 overflow-y-auto">
              <div className="text-xs text-neutral-400 mb-1">Draft preview:</div>
              <div className="text-sm text-neutral-200 font-mono">
                {draftContent.substring(0, 200)}
                {draftContent.length > 200 && '...'}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleRestore}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Restore Draft
              </button>
              <button
                onClick={handleDiscard}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Discard Draft
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-neutral-400 hover:text-white text-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 