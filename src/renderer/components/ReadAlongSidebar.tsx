import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Settings, Bookmark, RotateCcw, ChevronUp, ChevronDown, Target, Zap, AlertTriangle, Undo2, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TextChunk {
  text: string;
  startTime: number;
  endTime: number;
  index: number;
}

interface ReadAlongSidebarProps {
  isVisible: boolean;
  chapterTitle: string;
  chapterText: string;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  onClose: () => void;
  chapterId?: string;
  onRegenerateStart?: (chapterId: string) => void;
}

interface CalibrationPoint {
  textIndex: number;
  audioTime: number;
}

// Clean and normalize text for better display and processing
const cleanText = (text: string): string => {
  return text
    // First pass: Fix markdown artifacts and emphasis markers
    .replace(/^\*+\s*/gm, '') // Remove leading asterisks
    .replace(/\*+$/gm, '') // Remove trailing asterisks
    .replace(/\*+([^*]+)\*+/g, '$1') // Remove asterisks around text (*text* -> text)
    .replace(/\*+—/g, '—') // Fix asterisk before em dash (*— -> —)
    .replace(/\*+\s*([a-zA-Z])/g, '$1') // Remove asterisks before words (* word -> word)
    
    // Remove all markdown formatting
    .replace(/#{1,6}\s*/g, '') // Remove heading markers (# ## ###)
    .replace(/\*\*/g, '') // Remove bold markers (**)
    .replace(/__/g, '') // Remove underline markers (__)
    .replace(/~~(.+?)~~/g, '$1') // Remove strikethrough (~~text~~)
    .replace(/`{1,3}/g, '') // Remove code markers (` `` ```)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links [text](url) -> text
    
    // Fix encoding issues first
    .replace(/â€™/g, "'") // Fix apostrophe encoding
    .replace(/â€œ/g, '"') // Fix opening quote encoding
    .replace(/â€/g, '"') // Fix closing quote encoding
    .replace(/â€"/g, '—') // Fix em dash encoding
    
    // Normalize quotes and apostrophes
    .replace(/[""]/g, '"') // Smart quotes to regular quotes
    .replace(/['']/g, "'") // Smart apostrophes to regular apostrophes
    
    // Fix CRITICAL punctuation duplication issues
    .replace(/([.!?])[.!?]+/g, '$1') // Remove duplicate punctuation (?.? -> ?)
    .replace(/([.!?])\s*\.\s*/g, '$1 ') // Remove trailing periods after punctuation
    .replace(/\.+\s*([.!?])/g, '$1') // Remove leading periods before punctuation
    
    // Fix punctuation inside quotes - CORRECTED
    .replace(/([.!?])\."/g, '$1"') // Fix: "text?." -> "text?"
    .replace(/([.!?])\.'/g, "$1'") // Fix: "text?.' -> "text?'
    .replace(/"\s*([.!?])/g, '"$1') // Fix: " ? -> "?
    
    // Clean up multiple punctuation
    .replace(/\.{2,}/g, '.') // Multiple periods -> single period
    .replace(/!{2,}/g, '!') // Multiple exclamations -> single exclamation
    .replace(/\?{2,}/g, '?') // Multiple questions -> single question
    .replace(/,{2,}/g, ',') // Multiple commas -> single comma
    
    // Fix em dashes and hyphens
    .replace(/—+/g, '—') // Multiple em dashes -> single em dash
    .replace(/--+/g, '—') // Double/triple hyphens to em dash
    .replace(/\s*—\s*/g, ' — ') // Normalize spacing around em dashes
    
    // Fix spacing around punctuation
    .replace(/\s+([.!?,:;])/g, '$1') // Remove space before punctuation
    .replace(/([.!?])([A-Z])/g, '$1 $2') // Add space after sentence-ending punctuation
    .replace(/([.!?])\s*$/gm, '$1') // Ensure punctuation at line ends
    
    // Clean up whitespace
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/^\s+|\s+$/gm, '') // Trim lines
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines -> double newline max
    
    // Final aggressive cleanup of punctuation artifacts
    .replace(/([a-zA-Z])\.\s*\./g, '$1.') // Remove orphaned periods after words
    .replace(/\.\s*\.\s*$/gm, '.') // Trailing scattered periods
    .replace(/^\s*[.!?]+\s*/gm, '') // Lines starting with punctuation
    .replace(/([.!?])\s*[.]+\s*/g, '$1 ') // Clean up any remaining period artifacts
    .replace(/([.!?])\./g, '$1') // Fix cases like "honestly?." -> "honestly?"
    .replace(/([.!?])\s*\.\s*([A-Z])/g, '$1 $2') // Fix "text?. Next" -> "text? Next"
    
    .trim();
};

const estimateWordTiming = (text: string, totalDuration: number): TextChunk[] => {
  // Validate inputs
  if (!text || typeof text !== 'string' || !totalDuration || totalDuration <= 0) {
    return [];
  }
  
  // Clean the text first
  const cleanedText = cleanText(text);
  
  // Split text into natural speech chunks while preserving sentence flow
  const chunks = cleanedText
    // Primary split: Complete sentences and major breaks
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=["'])\s+(?=[A-Z])|\n{2,}/)
    .filter(chunk => chunk.trim().length > 0)
    .flatMap(segment => {
      const trimmedSegment = segment.trim();
      
      // For very long segments (>300 chars), split on natural pauses
      if (trimmedSegment.length > 300) {
        return trimmedSegment
          .split(/(?<=,)\s+(?=[A-Z])|(?<=;)\s+(?=[A-Z])|(?<=:)\s+(?=[A-Z])/)
          .filter(subChunk => subChunk.trim().length > 0);
      }
      
      // For medium segments (150-300 chars), try to split on dialogue or natural breaks
      if (trimmedSegment.length > 150) {
        // Split on dialogue breaks or after quotes if followed by capital letter
        const dialogueSplit = trimmedSegment.split(/(?<=["'])\s+(?=[A-Z])/);
        if (dialogueSplit.length > 1) {
          return dialogueSplit.filter(subChunk => subChunk.trim().length > 0);
        }
      }
      
      return [trimmedSegment];
    })
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 5); // Minimum chunk size to avoid fragments

  const totalWords = cleanedText.split(/\s+/).filter(word => word.length > 0).length;
  if (totalWords === 0) {
    return [];
  }
  
  const baseWordsPerSecond = totalWords / totalDuration;
  
  let currentTime = 0;
  
  return chunks
    .map((chunk, index) => {
      // Estimate words in this chunk
      const chunkWords = chunk.split(/\s+/).filter(word => word.length > 0).length;
      if (chunkWords === 0) return null; // Skip empty chunks
      
      // Apply timing adjustments based on content
      let adjustmentFactor = 1.0;
      
      // Dialogue tends to be spoken faster
      if (chunk.includes('"') || chunk.includes("'")) {
        adjustmentFactor = 0.9;
      }
      
      // Questions and exclamations have natural pauses
      if (chunk.includes('?') || chunk.includes('!')) {
        adjustmentFactor = 1.1;
      }
      
      // Longer chunks tend to have more natural pauses
      if (chunkWords > 15) {
        adjustmentFactor *= 1.05;
      }
      
      // Short chunks (like "Yep." or "Still here.") are often quicker
      if (chunkWords <= 3) {
        adjustmentFactor *= 0.8;
      }
      
      const adjustedWordsPerSecond = baseWordsPerSecond * adjustmentFactor;
      const chunkDuration = chunkWords / adjustedWordsPerSecond;
      
      // Add small pauses between chunks for more natural timing
      const pauseDuration = chunk.match(/[.!?]$/) ? 0.3 : 0.1;
      
      const textChunk: TextChunk = {
        text: chunk,
        startTime: currentTime,
        endTime: currentTime + chunkDuration,
        index
      };
      
      currentTime += chunkDuration + pauseDuration;
      return textChunk;
    })
    .filter((chunk): chunk is TextChunk => chunk !== null); // Filter out null values with type guard
};

export const ReadAlongSidebar: React.FC<ReadAlongSidebarProps> = ({
  isVisible,
  chapterTitle,
  chapterText,
  currentTime,
  totalDuration,
  onSeek,
  onClose,
  chapterId,
  onRegenerateStart
}) => {
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [calibrationHistory, setCalibrationHistory] = useState<CalibrationPoint[][]>([]);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [autoScrollBeforeCalibration, setAutoScrollBeforeCalibration] = useState(true);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeChunkRef = useRef<HTMLDivElement>(null);

  // Generate unique key for this chapter's calibration data
  const calibrationKey = `calibration_${chapterTitle.replace(/\s+/g, '_')}_${Math.round(totalDuration)}`;

  // Load calibration points from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(calibrationKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setCalibrationPoints(Array.isArray(parsed.points) ? parsed.points : []);
          setLastSyncTime(typeof parsed.lastSync === 'number' ? parsed.lastSync : 0);
        }
      }
    } catch (error) {
      console.warn('Failed to load calibration data:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem(calibrationKey);
      } catch (clearError) {
        console.warn('Failed to clear corrupted calibration data:', clearError);
      }
    }
  }, [calibrationKey]);

  // Save calibration points to localStorage when they change
  useEffect(() => {
    if (calibrationPoints.length > 0) {
      try {
        const dataToSave = {
          points: calibrationPoints,
          lastSync: lastSyncTime,
          version: 1 // For future compatibility
        };
        localStorage.setItem(calibrationKey, JSON.stringify(dataToSave));
      } catch (error) {
        console.warn('Failed to save calibration data:', error);
        // If storage is full, try to clear old calibration data
        if (error.name === 'QuotaExceededError') {
          try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith('calibration_'));
            keys.slice(0, Math.floor(keys.length / 2)).forEach(key => {
              localStorage.removeItem(key);
            });
            // Try saving again
            localStorage.setItem(calibrationKey, JSON.stringify(dataToSave));
          } catch (retryError) {
            console.error('Failed to save calibration data after cleanup:', retryError);
          }
        }
      }
    }
  }, [calibrationPoints, lastSyncTime, calibrationKey]);

  // Apply drift correction using calibration points
  const applyDriftCorrection = useCallback((chunks: TextChunk[], calibrations: CalibrationPoint[]): TextChunk[] => {
    if (calibrations.length < 2) return chunks;
    
    // Sort calibration points by text index
    const sortedCalibrations = [...calibrations].sort((a, b) => a.textIndex - b.textIndex);
    
    return chunks.map((chunk, index) => {
      // Find the closest calibration points
      let beforePoint: CalibrationPoint | null = null;
      let afterPoint: CalibrationPoint | null = null;
      
      for (let i = 0; i < sortedCalibrations.length; i++) {
        if (sortedCalibrations[i].textIndex <= index) {
          beforePoint = sortedCalibrations[i];
        }
        if (sortedCalibrations[i].textIndex > index && !afterPoint) {
          afterPoint = sortedCalibrations[i];
        }
      }
      
      if (!beforePoint && !afterPoint) return chunk;
      
      // Calculate timing adjustment
      let adjustedStartTime = chunk.startTime;
      let adjustedEndTime = chunk.endTime;
      
      if (beforePoint && afterPoint) {
        // Interpolate between two calibration points
        const progress = (index - beforePoint.textIndex) / (afterPoint.textIndex - beforePoint.textIndex);
        const baseTimeDiff = chunks[afterPoint.textIndex].startTime - chunks[beforePoint.textIndex].startTime;
        const actualTimeDiff = afterPoint.audioTime - beforePoint.audioTime;
        const correctionFactor = actualTimeDiff / baseTimeDiff;
        
        const timeFromBefore = chunk.startTime - chunks[beforePoint.textIndex].startTime;
        adjustedStartTime = beforePoint.audioTime + (timeFromBefore * correctionFactor);
        adjustedEndTime = adjustedStartTime + (chunk.endTime - chunk.startTime) * correctionFactor;
      } else if (beforePoint) {
        // Extrapolate from the last calibration point
        const timeDiff = chunk.startTime - chunks[beforePoint.textIndex].startTime;
        adjustedStartTime = beforePoint.audioTime + timeDiff;
        adjustedEndTime = adjustedStartTime + (chunk.endTime - chunk.startTime);
      } else if (afterPoint) {
        // Extrapolate from the first calibration point
        const timeDiff = chunks[afterPoint.textIndex].startTime - chunk.startTime;
        adjustedStartTime = afterPoint.audioTime - timeDiff;
        adjustedEndTime = adjustedStartTime + (chunk.endTime - chunk.startTime);
      }
      
      return {
        ...chunk,
        startTime: Math.max(0, adjustedStartTime),
        endTime: Math.max(adjustedStartTime + 0.1, adjustedEndTime)
      };
    });
  }, []);

  // Create text chunks with estimated timing and calibration correction
  const textChunks = useMemo(() => {
    if (!chapterText || !totalDuration) return [];
    const baseChunks = estimateWordTiming(chapterText, totalDuration);
    
    // Apply calibration corrections if we have calibration points
    if (calibrationPoints.length >= 2) {
      return applyDriftCorrection(baseChunks, calibrationPoints);
    }
    
    return baseChunks;
  }, [chapterText, totalDuration, calibrationPoints, applyDriftCorrection]);

  // Find current active chunk
  const activeChunkIndex = useMemo(() => {
    return textChunks.findIndex(chunk => 
      currentTime >= chunk.startTime && currentTime <= chunk.endTime
    );
  }, [textChunks, currentTime]);

  // Auto-scroll to active chunk with calibration mode protection
  useEffect(() => {
    // CRITICAL: Never auto-scroll during calibration mode
    if (calibrationMode) return;
    
    // Only scroll if auto-scroll is enabled and we have a valid chunk
    if (autoScroll && activeChunkRef.current && activeChunkIndex >= 0) {
      // Add small delay to ensure state has settled
      const scrollTimer = setTimeout(() => {
        if (activeChunkRef.current && !calibrationMode && autoScroll) {
          activeChunkRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 50);
      
      return () => clearTimeout(scrollTimer);
    }
  }, [activeChunkIndex, autoScroll, calibrationMode]);

  // Handle chunk click to seek or calibrate
  const handleChunkClick = useCallback((chunk: TextChunk, index: number) => {
    if (calibrationMode) {
      // Save current state to history for undo
      setCalibrationHistory(prev => [...prev, calibrationPoints]);
      
      // Add calibration point
      const newCalibration: CalibrationPoint = {
        textIndex: index,
        audioTime: currentTime
      };
      
      setCalibrationPoints(prev => {
        // Remove existing calibration for this text position
        const filtered = prev.filter(p => p.textIndex !== index);
        return [...filtered, newCalibration].sort((a, b) => a.textIndex - b.textIndex);
      });
      
      setLastSyncTime(currentTime);
    } else {
      onSeek(chunk.startTime);
    }
  }, [onSeek, calibrationMode, currentTime, calibrationPoints, autoScrollBeforeCalibration]);

  // Toggle calibration mode with proper state management
  const toggleCalibrationMode = useCallback(() => {
    setCalibrationMode(prev => {
      if (!prev) {
        // Entering calibration mode - use state updater to get current autoScroll value
        setAutoScrollBeforeCalibration(currentAutoScroll => {
          setAutoScroll(false); // Disable auto-scroll to prevent misclicks
          return currentAutoScroll; // Remember current setting
        });
        setCalibrationHistory([]); // Clear undo history when starting fresh
        return true;
      } else {
        // Exiting calibration mode
        setAutoScroll(autoScrollBeforeCalibration); // Restore previous setting
        if (calibrationPoints.length >= 2) {
          setLastSyncTime(currentTime);
        }
        return false;
      }
    });
  }, [calibrationPoints.length, currentTime, autoScrollBeforeCalibration]);

  // Undo last calibration action
  const undoCalibration = useCallback(() => {
    if (calibrationHistory.length > 0) {
      const previousState = calibrationHistory[calibrationHistory.length - 1];
      setCalibrationPoints(previousState);
      setCalibrationHistory(prev => prev.slice(0, -1));
    }
  }, [calibrationHistory]);

  // Clear all calibration points with proper state coordination
  const clearCalibration = useCallback(() => {
    // Save current state to history for undo
    setCalibrationHistory(prev => [...prev, calibrationPoints]);
    setCalibrationPoints([]);
    
    // Use coordinated state updates to prevent race conditions
    setCalibrationMode(currentMode => {
      if (currentMode) {
        // If we're in calibration mode, restore auto-scroll when clearing
        setAutoScroll(autoScrollBeforeCalibration);
      }
      return false; // Always exit calibration mode when clearing
    });
    
    // Clear from localStorage
    try {
      localStorage.removeItem(calibrationKey);
    } catch (error) {
      console.warn('Failed to clear calibration data:', error);
    }
  }, [calibrationPoints, autoScrollBeforeCalibration, calibrationKey]);

  // Detect timing drift and suggest calibration
  const timingAccuracy = useMemo(() => {
    if (calibrationPoints.length === 0) return 'unknown';
    
    const timeSinceLastSync = Math.abs(currentTime - lastSyncTime);
    if (timeSinceLastSync > 60) return 'poor'; // More than 1 minute drift
    if (timeSinceLastSync > 30) return 'fair'; // 30s-1min drift
    return 'good';
  }, [calibrationPoints.length, currentTime, lastSyncTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;
      
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  // Text size classes
  const textSizeClasses = {
    small: 'text-sm leading-relaxed',
    medium: 'text-base leading-relaxed',
    large: 'text-lg leading-relaxed'
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className="md:hidden fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`
          fixed right-0 top-0 h-full bg-neutral-900 border-l border-neutral-700 z-50
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-12' : 'w-full md:w-96 lg:w-1/3 xl:w-1/4'}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700 bg-neutral-800">
          {!isCollapsed && (
            <>
              <div className="flex items-center space-x-2">
                <Bookmark className="h-5 w-5 text-blue-400" />
                <h3 className="text-sm font-medium text-neutral-100 truncate">
                  Reading: {chapterTitle}
                </h3>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-neutral-400 hover:text-neutral-100 p-1 h-8 w-8"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsCollapsed(true)}
                  className="text-neutral-400 hover:text-neutral-100 p-1 h-8 w-8 hidden md:flex"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClose}
                  className="text-neutral-400 hover:text-neutral-100 p-1 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
          
          {isCollapsed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsCollapsed(false)}
              className="text-neutral-400 hover:text-neutral-100 p-1 h-8 w-8 mx-auto"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!isCollapsed && (
          <>
            {/* Settings Panel */}
            {showSettings && (
              <div className="p-4 border-b border-neutral-700 bg-neutral-800/50">
                <div className="space-y-3">
                  {/* Regenerate Audio Button */}
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          if (chapterId) {
                            // Notify parent that regeneration is starting
                            onRegenerateStart?.(chapterId);
                            // Call the regenerate audio API with proper chapter ID
                            await window.api.generateAudio(chapterId);
                            // Close the sidebar as it will need to reload with new audio
                            onClose();
                          } else {
                            console.warn('No chapter ID available for regeneration');
                          }
                        } catch (error) {
                          console.error('Failed to regenerate audio:', error);
                        }
                      }}
                      className="w-full bg-orange-600 border-orange-500 text-white hover:bg-orange-700"
                      title="Regenerate audio with improved text processing"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate Audio
                    </Button>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-neutral-300 mb-2 block">
                      Text Size
                    </label>
                    <div className="flex space-x-1">
                      {(['small', 'medium', 'large'] as const).map((size) => (
                        <Button
                          key={size}
                          size="sm"
                          variant={textSize === size ? "default" : "outline"}
                          onClick={() => setTextSize(size)}
                          className="text-xs capitalize"
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-neutral-300">
                      Auto-scroll
                    </label>
                    <Button
                      size="sm"
                      variant={autoScroll ? "default" : "outline"}
                      onClick={() => {
                        // Prevent auto-scroll changes during calibration
                        if (!calibrationMode) {
                          setAutoScroll(!autoScroll);
                        }
                      }}
                      className={`text-xs ${calibrationMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={calibrationMode}
                      title={calibrationMode ? "Auto-scroll is managed automatically during calibration" : "Toggle auto-scroll"}
                    >
                      {autoScroll ? 'On' : 'Off'}
                      {calibrationMode && ' (Auto)'}
                    </Button>
                  </div>

                  {/* Timing Accuracy & Calibration */}
                  <div className="border-t border-neutral-600 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-neutral-300 flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Timing Accuracy
                      </label>
                      <div className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                        timingAccuracy === 'good' ? 'bg-green-900/50 text-green-300' :
                        timingAccuracy === 'fair' ? 'bg-yellow-900/50 text-yellow-300' :
                        timingAccuracy === 'poor' ? 'bg-red-900/50 text-red-300' :
                        'bg-neutral-700 text-neutral-400'
                      }`}>
                        {timingAccuracy === 'good' && <Zap className="h-3 w-3" />}
                        {timingAccuracy === 'poor' && <AlertTriangle className="h-3 w-3" />}
                        {timingAccuracy === 'unknown' ? 'Not calibrated' : timingAccuracy}
                      </div>
                    </div>
                    
                    {timingAccuracy === 'poor' && (
                      <div className="text-xs text-yellow-300 mb-2 p-2 bg-yellow-900/20 rounded">
                        ⚠️ Text may be out of sync. Consider recalibrating.
                      </div>
                    )}
                    
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={calibrationMode ? "default" : "outline"}
                        onClick={toggleCalibrationMode}
                        className="text-xs flex-1"
                      >
                        {calibrationMode ? 'Exit Calibration' : 'Calibrate Timing'}
                      </Button>
                      
                      {/* Undo button - only show during calibration */}
                      {calibrationMode && calibrationHistory.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={undoCalibration}
                          className="text-xs text-yellow-400 hover:text-yellow-300"
                          title="Undo last calibration point"
                        >
                          <Undo2 className="h-3 w-3" />
                        </Button>
                      )}
                      
                      {/* Clear button - only show when there are points */}
                      {calibrationPoints.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={clearCalibration}
                          className="text-xs text-red-400 hover:text-red-300"
                          title="Clear all calibration points"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    
                    {calibrationMode && (
                      <div className="text-xs text-blue-300 mt-2 p-2 bg-blue-900/20 rounded space-y-1">
                        <div>🎯 Click on text that matches what you're hearing right now. Add as many points as needed for perfect sync.</div>
                        <div className="text-neutral-400 flex items-center gap-1">
                          📍 Auto-scroll disabled to prevent misclicks.
                          <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-red-900/30 text-red-300">
                            🚫 No Scroll
                          </span>
                        </div>
                        <div className="text-neutral-500">Click "Exit Calibration" when done.</div>
                      </div>
                    )}
                    
                    {calibrationPoints.length > 0 && (
                      <div className="text-xs text-neutral-400 mt-1 flex items-center justify-between">
                        <span>{calibrationPoints.length} sync point{calibrationPoints.length !== 1 ? 's' : ''}</span>
                        {!calibrationMode && calibrationHistory.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={undoCalibration}
                            className="text-xs text-yellow-400 hover:text-yellow-300 h-auto p-1"
                            title="Undo last action"
                          >
                            <Undo2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Progress indicator */}
            <div className="px-4 py-2 bg-neutral-800/30">
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                <span>Reading Progress</span>
                <span>{Math.round((currentTime / totalDuration) * 100)}%</span>
              </div>
              <div className="w-full bg-neutral-700 rounded-full h-1">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                />
              </div>
            </div>

            {/* Text Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {textChunks.length === 0 ? (
                <div className="text-center text-neutral-400 py-8">
                  <div className="text-sm">Loading chapter text...</div>
                </div>
              ) : (
                textChunks.map((chunk, index) => {
                  const isCalibrationPoint = calibrationPoints.some(p => p.textIndex === index);
                  const baseClassName = `
                    ${textSizeClasses[textSize]}
                    cursor-pointer transition-all duration-200 p-3 rounded-lg relative
                  `;
                  
                  let stateClassName = '';
                  if (calibrationMode) {
                    stateClassName = 'border-2 border-dashed border-blue-400/50 hover:border-blue-400 hover:bg-blue-900/20 text-neutral-200';
                  } else if (index === activeChunkIndex) {
                    stateClassName = 'bg-blue-500/20 border border-blue-500/30 text-neutral-100 shadow-lg';
                  } else if (index < activeChunkIndex) {
                    stateClassName = 'text-neutral-500 hover:text-neutral-400 hover:bg-neutral-800/50';
                  } else {
                    stateClassName = 'text-neutral-300 hover:text-neutral-200 hover:bg-neutral-800/50';
                  }
                  
                  return (
                    <div
                      key={index}
                      ref={index === activeChunkIndex ? activeChunkRef : null}
                      onClick={() => handleChunkClick(chunk, index)}
                      className={`${baseClassName} ${stateClassName}`}
                    >
                      {/* Calibration point indicator */}
                      {isCalibrationPoint && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-neutral-900 flex items-center justify-center">
                          <Target className="h-2 w-2 text-neutral-900" />
                        </div>
                      )}
                      
                      {calibrationMode && (
                        <div className="absolute top-1 left-1 text-blue-400">
                          <Target className="h-3 w-3" />
                        </div>
                      )}
                      
                      {chunk.text}
                      {chunk.text.endsWith('.') ? '' : '.'}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-neutral-700 bg-neutral-800">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>{textChunks.length} sections</span>
                <div className="flex items-center space-x-2">
                  {calibrationMode ? (
                    <span className="text-blue-400 flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      Click text you're hearing now
                    </span>
                  ) : (
                    <span>Click any text to jump</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};