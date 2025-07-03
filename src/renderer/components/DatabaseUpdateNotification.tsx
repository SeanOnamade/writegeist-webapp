import { useState, useEffect } from 'react';

interface DatabaseUpdateNotificationProps {
  onReload: () => void;
}

interface DbUpdateEvent {
  table: string;
  updatedAt: string;
}

export default function DatabaseUpdateNotification({ onReload }: DatabaseUpdateNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<DbUpdateEvent | null>(null);

  useEffect(() => {
    const handleDbUpdate = (_event: any, data: DbUpdateEvent) => {
      setUpdateInfo(data);
      setIsVisible(true);
    };

    // Listen for database update events from main process
    // Note: This would need to be properly implemented in the preload script
    // For now, we'll use a different approach or implement it later
    const cleanup = () => {
      // Cleanup logic would go here
    };

    return cleanup;
  }, []);

  const handleReload = () => {
    onReload();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !updateInfo) {
    return null;
  }

  return (
    <div className="fixed top-16 right-4 z-40 max-w-sm">
      <div className="bg-yellow-800 border border-yellow-600 rounded-lg p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xs">!</span>
          </div>
          
          <div className="flex-1">
            <h4 className="text-yellow-100 font-semibold text-sm mb-1">
              Database Updated
            </h4>
            <p className="text-yellow-200 text-xs mb-3">
              The database was updated externally. Your current changes may be out of sync.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleReload}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
              >
                Reload
              </button>
              <button
                onClick={handleDismiss}
                className="text-yellow-300 hover:text-yellow-100 px-3 py-1 text-xs transition-colors"
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