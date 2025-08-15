import { useState, useEffect } from 'react';
import { useSaveManager } from '../hooks/useSaveManager';

export default function SaveStatusIndicator() {
  const { isSaving, lastSavedAt, lastError, unsyncedChanges } = useSaveManager();
  const [showTooltip, setShowTooltip] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState<string>('');

  // Update time display every minute
  useEffect(() => {
    const updateTimeDisplay = () => {
      if (!lastSavedAt) {
        setTimeDisplay('');
        return;
      }

      const now = new Date();
      const diffMs = now.getTime() - lastSavedAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) {
        setTimeDisplay('just now');
      } else if (diffMins === 1) {
        setTimeDisplay('1m ago');
      } else if (diffMins < 60) {
        setTimeDisplay(`${diffMins}m ago`);
      } else {
        setTimeDisplay(lastSavedAt.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        }));
      }
    };

    updateTimeDisplay();
    const interval = setInterval(updateTimeDisplay, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [lastSavedAt]);

  // Determine status and styling
  let statusColor = 'bg-green-500';
  let statusText = 'Saved';
  let showSpinner = false;

  if (isSaving) {
    statusColor = 'bg-blue-500';
    statusText = 'Saving...';
    showSpinner = true;
  } else if (lastError) {
    statusColor = 'bg-red-500';
    statusText = 'Error';
  } else if (unsyncedChanges) {
    statusColor = 'bg-yellow-500';
    statusText = 'Unsaved';
  } else if (lastSavedAt) {
    statusColor = 'bg-green-500';
    statusText = `Saved ${timeDisplay}`;
  }

  const handleMouseEnter = () => setShowTooltip(true);
  const handleMouseLeave = () => setShowTooltip(false);

  return (
    <div className="fixed top-8 right-8 z-50">
      <div 
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Main Status Pill */}
        <div className={`
          ${statusColor} text-white px-3 py-1 rounded-full text-xs font-medium
          flex items-center gap-2 shadow-lg transition-all duration-200
          hover:scale-105 cursor-default
        `}>
          {/* Spinner Animation */}
          {showSpinner && (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          )}
          
          {/* Status Dot */}
          {!showSpinner && (
            <div className="w-2 h-2 bg-white rounded-full"></div>
          )}
          
          {/* Status Text */}
          <span className="whitespace-nowrap">{statusText}</span>
        </div>

        {/* Error Tooltip */}
        {showTooltip && lastError && (
          <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-red-800 text-white text-xs rounded-lg shadow-xl border border-red-600">
            <div className="font-semibold mb-1">Save Error:</div>
            <div className="break-words">{lastError}</div>
            {/* Tooltip Arrow */}
            <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-800"></div>
          </div>
        )}

        {/* Unsaved Changes Tooltip */}
        {showTooltip && unsyncedChanges && !lastError && (
          <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-yellow-800 text-white text-xs rounded-lg shadow-xl border border-yellow-600">
            <div>You have unsaved changes</div>
            <div className="text-yellow-200 mt-1">Press Ctrl+S to save now</div>
            {/* Tooltip Arrow */}
            <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-yellow-800"></div>
          </div>
        )}

        {/* Success Tooltip */}
        {showTooltip && lastSavedAt && !lastError && !unsyncedChanges && (
          <div className="absolute top-full right-0 mt-2 w-40 p-2 bg-green-800 text-white text-xs rounded-lg shadow-xl border border-green-600">
            <div>Last saved:</div>
            <div className="font-semibold">{lastSavedAt.toLocaleString()}</div>
            {/* Tooltip Arrow */}
            <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-green-800"></div>
          </div>
        )}
      </div>
    </div>
  );
} 