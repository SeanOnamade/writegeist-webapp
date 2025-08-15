import { useState, useEffect, useRef, useCallback } from 'react';

export interface WritingStats {
  wordCount: number;
  sessionStartTime: Date;
  sessionDuration: number; // in seconds
  wordsPerMinute: number;
  charactersTyped: number;
  sessionWordCount: number; // words added this session
}

export function useWritingStats(initialContent: string = '') {
  const [stats, setStats] = useState<WritingStats>({
    wordCount: countWords(initialContent),
    sessionStartTime: new Date(),
    sessionDuration: 0,
    wordsPerMinute: 0,
    charactersTyped: 0,
    sessionWordCount: 0,
  });

  const initialWordCount = useRef(countWords(initialContent));
  const lastUpdateTime = useRef(Date.now());
  const keystrokeCount = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef(initialContent);

  // Update initial word count when content changes significantly (like loading a new chapter)
  useEffect(() => {
    const currentWordCount = countWords(initialContent);
    const lastWordCount = countWords(lastContentRef.current);
    
    // If the word count changes significantly, reset the initial count (new chapter loaded)
    if (Math.abs(currentWordCount - lastWordCount) > 10) {
      initialWordCount.current = currentWordCount;
      keystrokeCount.current = 0;
      
      setStats(prev => ({
        ...prev,
        wordCount: currentWordCount,
        sessionStartTime: new Date(),
        sessionDuration: 0,
        sessionWordCount: 0,
        wordsPerMinute: 0,
        charactersTyped: 0,
      }));
    }
    
    lastContentRef.current = initialContent;
  }, [initialContent]);

  // Count words in text
  function countWords(text: string): number {
    if (!text) return 0;
    // Remove markdown formatting and count words
    const plainText = text
      .replace(/[#*>\-\[\]]/g, '') // Remove markdown symbols
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();
    if (!plainText) return 0;
    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  }

  // Update stats when content changes
  const updateStats = useCallback((content: string) => {
    const now = Date.now();
    const currentWordCount = countWords(content);
    const sessionDuration = Math.floor((now - stats.sessionStartTime.getTime()) / 1000);
    
    // Calculate session word count (only words added this session)
    const sessionWordCount = Math.max(0, currentWordCount - initialWordCount.current);
    
    // Calculate WPM based on session words and session duration
    const wordsPerMinute = sessionDuration > 30 // Only calculate after 30 seconds to avoid huge spikes
      ? Math.round((sessionWordCount / sessionDuration) * 60)
      : 0;

    setStats(prev => ({
      ...prev,
      wordCount: currentWordCount,
      sessionDuration,
      sessionWordCount,
      wordsPerMinute: Math.max(0, wordsPerMinute),
    }));
  }, [stats.sessionStartTime]);

  // Track keystroke for typing activity
  const trackKeystroke = useCallback(() => {
    keystrokeCount.current++;
    setStats(prev => ({
      ...prev,
      charactersTyped: keystrokeCount.current,
    }));
  }, []);

  // Reset session stats
  const resetSession = useCallback(() => {
    const now = new Date();
    initialWordCount.current = stats.wordCount;
    keystrokeCount.current = 0;
    
    setStats(prev => ({
      ...prev,
      sessionStartTime: now,
      sessionDuration: 0,
      sessionWordCount: 0,
      wordsPerMinute: 0,
      charactersTyped: 0,
    }));
  }, [stats.wordCount]);

  // Update session duration every 5 seconds (less aggressive)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const sessionDuration = Math.floor((now - stats.sessionStartTime.getTime()) / 1000);
      
      setStats(prev => ({
        ...prev,
        sessionDuration,
        // Recalculate WPM
        wordsPerMinute: sessionDuration > 0 
          ? Math.round((prev.sessionWordCount / sessionDuration) * 60)
          : 0,
      }));
    }, 5000); // Changed from 1000ms to 5000ms

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [stats.sessionStartTime]);

  // Format session duration for display
  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }, []);

  return {
    stats,
    updateStats,
    trackKeystroke,
    resetSession,
    formatDuration,
  };
} 