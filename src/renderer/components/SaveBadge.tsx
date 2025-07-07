import React from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { SaveState } from '@/renderer/hooks/useSaveManager';

interface SaveBadgeProps {
  saveState: SaveState;
  className?: string;
}

export function SaveBadge({ saveState, className = "" }: SaveBadgeProps) {
  const { isSaving, lastSavedAt, lastError, unsyncedChanges } = saveState;

  let icon;
  let text;
  let colorClass;
  let bgClass;

  if (isSaving) {
    icon = <Loader2 className="h-3 w-3 animate-spin" />;
    text = "Saving...";
    colorClass = "text-blue-400";
    bgClass = "bg-blue-950/20";
  } else if (lastError) {
    icon = <AlertCircle className="h-3 w-3" />;
    text = "Save failed";
    colorClass = "text-red-400";
    bgClass = "bg-red-950/20";
  } else if (unsyncedChanges) {
    icon = <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />;
    text = "Unsaved changes";
    colorClass = "text-yellow-400";
    bgClass = "bg-yellow-950/20";
  } else if (lastSavedAt) {
    icon = <CheckCircle className="h-3 w-3" />;
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
    <div 
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${colorClass} ${bgClass} ${className}`}
      title={lastError || text}
    >
      {icon}
      <span className="whitespace-nowrap">{text}</span>
    </div>
  );
} 