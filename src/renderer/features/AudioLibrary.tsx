import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Headphones, Plus, Loader2, AlertCircle, CheckCircle, Clock, RefreshCw, BookOpen, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AudioPlayer } from '../components/AudioPlayer';
import { ReadAlongSidebar } from '../components/ReadAlongSidebar';
import type { Chapter } from '@/types';

interface AudioInfo {
  id: string;
  chapter_id?: string;
  chapterId?: string;
  audio_url?: string | null;
  audioUrl?: string | null;
  duration: number | null;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'outdated';
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

interface ChapterWithAudio extends Chapter {
  audio?: AudioInfo;
}

export const AudioLibrary: React.FC = () => {
  const [chapters, setChapters] = useState<ChapterWithAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingAudio, setGeneratingAudio] = useState<Set<string>>(new Set());
  const [backgroundGenerating, setBackgroundGenerating] = useState<Set<string>>(new Set());
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [currentPlayingChapter, setCurrentPlayingChapter] = useState<ChapterWithAudio | null>(null);
  const { toast } = useToast();
  
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  // Set up event listeners for background audio generation
  useEffect(() => {
    const unsubscribeStarted = window.api.onBackgroundAudioGenerationStarted(({ chapterId, chapterTitle }) => {
      toast({
        title: "Audio Generation Started",
        description: `Generating audio for "${chapterTitle}" in the background...`,
        duration: 4000,
      });
      
      // Add to background generating set for visual feedback
      setBackgroundGenerating(prev => new Set(prev).add(chapterId));
      setGeneratingAudio(prev => new Set(prev).add(chapterId));
      
      // Refresh the chapters list to show processing status
      setTimeout(() => {
        loadChaptersWithAudio();
      }, 1000);
    });

    const unsubscribeFailed = window.api.onBackgroundAudioGenerationFailed(({ chapterId, chapterTitle, error }) => {
      toast({
        title: "Audio Generation Failed",
        description: `Failed to generate audio for "${chapterTitle}". Please try again.`,
        variant: "destructive",
        duration: 6000,
      });
      
      // Remove from both generating sets
      setGeneratingAudio(prev => {
        const newSet = new Set(prev);
        newSet.delete(chapterId);
        return newSet;
      });
      setBackgroundGenerating(prev => {
        const newSet = new Set(prev);
        newSet.delete(chapterId);
        return newSet;
      });
    });

    return () => {
      unsubscribeStarted();
      unsubscribeFailed();
    };
  }, [toast]);

  const loadChaptersWithAudio = useCallback(async () => {
    try {
      // Load chapters
      const chaptersData = await window.api.getChapters();
      
      // Load audio info for each chapter
      const chaptersWithAudio: ChapterWithAudio[] = await Promise.all(
        chaptersData.map(async (chapter: Chapter) => {
          try {
            const audioStatus = await window.api.getAudioStatus(chapter.id);
            // Only log if there's audio or an error
            if (audioStatus.success && audioStatus.audio) {
              // console.log(`Audio found for chapter ${chapter.id}`);  // Verbose: commented out
              return { ...chapter, audio: audioStatus.audio };
            }
          } catch (error) {
            // Silently handle connection errors - API might not be ready yet
            if (!error.message?.includes('ECONNREFUSED')) {
              console.error(`Failed to load audio for chapter ${chapter.id}:`, error);
            }
          }
          return chapter;
        })
      );
      
      setChapters(chaptersWithAudio);
      
      // Clean up generating states for completed or errored audio
      const completedChapterIds = chaptersWithAudio
        .filter(ch => ch.audio?.status === 'completed' || ch.audio?.status === 'error')
        .map(ch => ch.id);
      
      if (completedChapterIds.length > 0) {
        setGeneratingAudio(prev => {
          const newSet = new Set(prev);
          completedChapterIds.forEach(id => newSet.delete(id));
          return newSet;
        });
        setBackgroundGenerating(prev => {
          const newSet = new Set(prev);
          completedChapterIds.forEach(id => newSet.delete(id));
          return newSet;
        });
      }
    } catch (error) {
      console.error('Failed to load chapters:', error);
      toast({
        title: "Error",
        description: "Failed to load audio library. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadChaptersWithAudio();
  }, [loadChaptersWithAudio]);
  
  // Separate effect for polling - only for processing chapters
  useEffect(() => {
    // Don't poll if there are no processing chapters
    const hasProcessing = chapters.some(ch => 
      ch.audio?.status === 'processing' || ch.audio?.status === 'pending'
    );
    
    if (!hasProcessing) {
      return; // No need to poll
    }
    
    const interval = setInterval(() => {
      // console.log('Checking for processing audio updates...');  // Verbose: commented out
      loadChaptersWithAudio().catch(error => {
        console.warn('Failed to poll audio updates:', error);
      });
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [chapters.length, loadChaptersWithAudio]); // Only re-run when number of chapters changes

  const generateAudio = async (chapterId: string) => {
    try {
      setGeneratingAudio(prev => new Set(prev).add(chapterId));
      // Clear background generating state since this is now manual
      setBackgroundGenerating(prev => {
        const newSet = new Set(prev);
        newSet.delete(chapterId);
        return newSet;
      });
      
      const result = await window.api.generateAudio(chapterId);
      
      if (result.success) {
        toast({
          title: "Audio Generation Started",
          description: "Your audio is being generated. This may take a few minutes.",
        });
        
        // Reload to show pending status
        await loadChaptersWithAudio();
      } else {
        throw new Error(result.error || 'Failed to start audio generation');
      }
    } catch (error) {
      console.error('Failed to generate audio:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate audio. Please check your API configuration.",
        variant: "destructive",
      });
    } finally {
      setGeneratingAudio(prev => {
        const newSet = new Set(prev);
        newSet.delete(chapterId);
        return newSet;
      });
    }
  };

  // Audio player callbacks
  const handleAudioProgress = useCallback((time: number) => {
    setCurrentAudioTime(time);
  }, []);

  const handleAudioSeek = useCallback((time: number) => {
    setCurrentAudioTime(time);
    // Find the audio element and seek to the specified time
    const audioElement = audioPlayerRef.current || document.querySelector('audio') as HTMLAudioElement;
    if (audioElement && isFinite(time) && time >= 0) {
      try {
        audioElement.currentTime = time;
      } catch (error) {
        console.warn('Failed to seek audio:', error);
      }
    }
  }, []);

  const handlePlayAudio = useCallback((chapter: ChapterWithAudio) => {
    try {
      // Pause any currently playing audio
      const audioElement = audioPlayerRef.current || document.querySelector('audio') as HTMLAudioElement;
      if (audioElement && !audioElement.paused) {
        audioElement.pause();
      }

      setCurrentPlayingChapter(chapter);
      setCurrentAudioTime(0);
      setSidebarVisible(true);
    } catch (error) {
      console.error('Failed to start audio playback:', error);
      toast({
        title: "Playback Error",
        description: "Failed to start audio playback. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleCloseSidebar = useCallback(() => {
    setSidebarVisible(false);
    setCurrentPlayingChapter(null);
    setCurrentAudioTime(0);
  }, []);

  const handleDownloadAudio = useCallback(async (chapter: ChapterWithAudio) => {
    if (!chapter.audio?.audio_url && !chapter.audio?.audioUrl) {
      toast({
        title: "Download Failed",
        description: "No audio file found for this chapter.",
        variant: "destructive",
      });
      return;
    }

    try {
      const audioUrl = chapter.audio?.audio_url || chapter.audio?.audioUrl;
      
      // Convert Windows path to secure HTTP URL if needed
      let downloadUrl = audioUrl;
      if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
        const filename = audioUrl.split('\\').pop() || audioUrl.split('/').pop() || 'audio.mp3';
        downloadUrl = `http://127.0.0.1:9876/${encodeURIComponent(filename)}`;
      }

      // Fetch the audio file
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }

      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename - ensure it's safe and not empty
      const sanitizedTitle = chapter.title
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '_')
        .toLowerCase()
        .substring(0, 50) || 'chapter'; // Limit length and provide fallback
      link.download = `${sanitizedTitle}_audio.mp3`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000); // Small delay to ensure download starts
      
      toast({
        title: "Download Started",
        description: `Downloading audio for "${chapter.title}"...`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download audio file. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const getStatusIcon = (status?: string, chapterId?: string) => {
    // Show loading if actively generating, regardless of DB status
    if (chapterId && generatingAudio.has(chapterId)) {
      return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    }
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'outdated':
        return <AlertCircle className="h-4 w-4 text-orange-400" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (status?: string, chapterId?: string) => {
    // Show regenerating if actively generating, regardless of DB status
    if (chapterId && generatingAudio.has(chapterId)) {
      return backgroundGenerating.has(chapterId) ? 'Auto-Regenerating...' : 'Regenerating...';
    }
    
    switch (status) {
      case 'completed':
        return 'Available';
      case 'outdated':
        return 'Outdated';
      case 'processing':
        return 'Generating...';
      case 'error':
        return 'Failed';
      case 'pending':
        return 'Queued';
      default:
        return 'Not generated';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-neutral-400 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Headphones className="h-6 w-6 text-neutral-400" />
            <div>
              <h1 className="text-2xl font-bold text-neutral-100">Audio Library</h1>
              <p className="text-neutral-400">Listen to your chapters as audio</p>
            </div>
          </div>
          
          <div className="bg-neutral-900/50 rounded-lg p-8 text-center">
            <Headphones className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-400 mb-4">No chapters found. Create some chapters first!</p>
            <Button
              onClick={() => window.location.hash = '#/chapters'}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Go to Chapters
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 p-8 transition-all duration-300 ${sidebarVisible ? 'pr-8 md:pr-96 lg:pr-1/3 xl:pr-1/4' : ''}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Headphones className="h-6 w-6 text-neutral-400" />
            <div>
              <h1 className="text-2xl font-bold text-neutral-100">Audio Library</h1>
              <p className="text-neutral-400">Listen to your chapters as audio</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadChaptersWithAudio()}
            className="text-neutral-400 hover:text-neutral-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 hover:bg-neutral-750 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-neutral-100 mb-2">
                    {chapter.title}
                  </h3>
                  <p className="text-neutral-400 text-sm line-clamp-2 mb-3">
                    {chapter.text.substring(0, 150)}...
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-neutral-500">
                      Created: {new Date(chapter.createdAt).toLocaleDateString()}
                    </span>
                    {chapter.audio && (
                      <div className="flex items-center gap-2">
                        {getStatusIcon(chapter.audio.status, chapter.id)}
                        <span className="text-neutral-400">
                          {getStatusText(chapter.audio.status, chapter.id)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {!chapter.audio || (chapter.audio.status !== 'completed' && chapter.audio.status !== 'outdated') ? (
                  <Button
                    onClick={() => generateAudio(chapter.id)}
                    disabled={generatingAudio.has(chapter.id) || chapter.audio?.status === 'processing'}
                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-neutral-700 disabled:text-neutral-400"
                  >
                    {generatingAudio.has(chapter.id) || chapter.audio?.status === 'processing' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {backgroundGenerating.has(chapter.id) ? 'Auto-Generating...' : 'Generating...'}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Audio
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        // console.log('Play Audio button clicked');  // Verbose: commented out
                        // console.log('Chapter ID:', chapter.id);  // Verbose: commented out
                        // console.log('Current expandedChapter:', expandedChapter);  // Verbose: commented out
                        // console.log('Chapter audio:', chapter.audio);  // Verbose: commented out
                        
                        // Pause any currently playing audio before switching
                        try {
                          const currentAudio = audioPlayerRef.current || document.querySelector('audio') as HTMLAudioElement;
                          if (currentAudio && !currentAudio.paused) {
                            currentAudio.pause();
                          }
                        } catch (error) {
                          console.warn('Failed to pause current audio:', error);
                        }
                        
                        const newExpanded = expandedChapter === chapter.id ? null : chapter.id;
                        // console.log('Setting expandedChapter to:', newExpanded);  // Verbose: commented out
                        setExpandedChapter(newExpanded);
                      }}
                      variant="outline"
                      disabled={generatingAudio.has(chapter.id)}
                      className="bg-neutral-700 border-neutral-600 text-neutral-100 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-500"
                      title={generatingAudio.has(chapter.id) ? "Audio is being regenerated" : undefined}
                    >
                      <Headphones className="h-4 w-4 mr-2" />
                      {expandedChapter === chapter.id ? 'Hide Player' : 'Play Audio'}
                    </Button>
                    
                    <Button
                      onClick={() => handlePlayAudio(chapter)}
                      variant="outline"
                      disabled={generatingAudio.has(chapter.id)}
                      className="bg-blue-600 border-blue-500 text-white hover:bg-blue-700 disabled:bg-neutral-800 disabled:text-neutral-500"
                      title={generatingAudio.has(chapter.id) ? "Audio is being regenerated" : undefined}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Read Along
                    </Button>
                    
                    <Button
                      onClick={() => handleDownloadAudio(chapter)}
                      variant="outline"
                      disabled={generatingAudio.has(chapter.id)}
                      className="bg-green-600 border-green-500 text-white hover:bg-green-700 disabled:bg-neutral-800 disabled:text-neutral-500"
                      title={generatingAudio.has(chapter.id) ? "Audio is being regenerated" : "Download audio file"}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    
                    {chapter.audio?.status === 'outdated' && (
                      <Button
                        onClick={() => generateAudio(chapter.id)}
                        variant="outline"
                        disabled={generatingAudio.has(chapter.id)}
                        className="bg-orange-600 border-orange-500 text-white hover:bg-orange-700 disabled:bg-neutral-700 disabled:text-neutral-400"
                        title="Regenerate audio for updated chapter"
                      >
                        {generatingAudio.has(chapter.id) ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Regenerate
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {(() => {
                const audioUrl = chapter.audio?.audio_url || chapter.audio?.audioUrl;
                const shouldShowPlayer = expandedChapter === chapter.id && audioUrl;
                // console.log(`Should show player for ${chapter.id}:`, shouldShowPlayer, {
                //   expandedChapter,
                //   chapterId: chapter.id,
                //   hasAudioUrl: !!audioUrl,
                //   audioUrl: audioUrl,
                //   audioData: chapter.audio
                // });  // Verbose: commented out
                return shouldShowPlayer && (
                  <div className="mt-4 pt-4 border-t border-neutral-700">
                    <AudioPlayer
                      audioUrl={audioUrl}
                      chapterTitle={chapter.title}
                      duration={chapter.audio.duration || undefined}
                      onProgressChange={handleAudioProgress}
                    />
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
      
      {/* Read Along Sidebar */}
      {currentPlayingChapter && (
        <ReadAlongSidebar
          isVisible={sidebarVisible}
          chapterTitle={currentPlayingChapter.title}
          chapterText={currentPlayingChapter.text}
          currentTime={currentAudioTime}
          totalDuration={currentPlayingChapter.audio?.duration || 0}
          onSeek={handleAudioSeek}
          onClose={handleCloseSidebar}
          chapterId={currentPlayingChapter.id}
          onRegenerateStart={(chapterId) => {
            setGeneratingAudio(prev => new Set(prev).add(chapterId));
          }}
        />
      )}
    </div>
  );
};