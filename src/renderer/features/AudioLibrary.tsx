import React, { useState, useEffect, useCallback } from 'react';
import { Headphones, Plus, Loader2, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AudioPlayer } from '../components/AudioPlayer';
import type { Chapter } from '@/types';

interface AudioInfo {
  id: string;
  chapter_id?: string;
  chapterId?: string;
  audio_url?: string | null;
  audioUrl?: string | null;
  duration: number | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
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
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const { toast } = useToast();

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
      loadChaptersWithAudio();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [chapters.length, loadChaptersWithAudio]); // Only re-run when number of chapters changes

  const generateAudio = async (chapterId: string) => {
    try {
      setGeneratingAudio(prev => new Set(prev).add(chapterId));
      
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

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
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

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'Available';
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
    <div className="flex-1 p-8">
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
                        {getStatusIcon(chapter.audio.status)}
                        <span className="text-neutral-400">
                          {getStatusText(chapter.audio.status)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {!chapter.audio || chapter.audio.status !== 'completed' ? (
                  <Button
                    onClick={() => generateAudio(chapter.id)}
                    disabled={generatingAudio.has(chapter.id) || chapter.audio?.status === 'processing'}
                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-neutral-700 disabled:text-neutral-400"
                  >
                    {generatingAudio.has(chapter.id) || chapter.audio?.status === 'processing' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Audio
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      // console.log('Play Audio button clicked');  // Verbose: commented out
                      // console.log('Chapter ID:', chapter.id);  // Verbose: commented out
                      // console.log('Current expandedChapter:', expandedChapter);  // Verbose: commented out
                      // console.log('Chapter audio:', chapter.audio);  // Verbose: commented out
                      
                      // Pause any currently playing audio before switching
                      const currentAudio = document.querySelector('audio');
                      if (currentAudio && !currentAudio.paused) {
                        currentAudio.pause();
                      }
                      
                      const newExpanded = expandedChapter === chapter.id ? null : chapter.id;
                      // console.log('Setting expandedChapter to:', newExpanded);  // Verbose: commented out
                      setExpandedChapter(newExpanded);
                    }}
                    variant="outline"
                    className="bg-neutral-700 border-neutral-600 text-neutral-100 hover:bg-neutral-600"
                  >
                    <Headphones className="h-4 w-4 mr-2" />
                    {expandedChapter === chapter.id ? 'Hide Player' : 'Play Audio'}
                  </Button>
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
                    />
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};