import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AudioPlayerProps {
  audioUrl: string;
  chapterTitle: string;
  duration?: number;
  onProgressChange?: (progress: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioUrl, 
  chapterTitle, 
  duration: totalDuration,
  onProgressChange 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(totalDuration || 0);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Convert Windows path to secure HTTP URL
  const normalizedAudioUrl = React.useMemo(() => {
    if (!audioUrl) return '';
    // If it's already a URL, use as-is
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      return audioUrl;
    }
    // Extract filename from path and serve via secure HTTP server
    const filename = audioUrl.split('\\').pop() || audioUrl.split('/').pop() || '';
    const httpUrl = `http://127.0.0.1:9876/${filename}`;
          // console.log('AudioPlayer - Converting path:', audioUrl, 'to secure URL:', httpUrl);  // Verbose: commented out
    return httpUrl;
  }, [audioUrl]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // console.log('Audio element initialized with URL:', normalizedAudioUrl);  // Verbose: commented out
    
    const updateTime = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
        onProgressChange?.(audio.currentTime);
      }
    };
    
    const updateDuration = () => {
      setDuration(audio.duration);
      // console.log('Audio duration loaded:', audio.duration);  // Verbose: commented out
      
      // Warn about very long audio files (>30 minutes)
      if (audio.duration > 1800) {
        console.warn('Large audio file detected:', {
          duration: audio.duration,
          minutes: Math.round(audio.duration / 60),
          fileSize: 'Unknown - consider checking file size'
        });
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const handleError = (e: Event) => {
      console.error('Audio loading error:', e);
      const audioElement = e.target as HTMLAudioElement;
      console.error('Audio error details:', {
        error: audioElement.error,
        src: audioElement.src,
        networkState: audioElement.networkState,
        readyState: audioElement.readyState
      });
      
      // Reset player state on error
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    };
    
    const handleCanPlay = () => {
      // console.log('Audio can play, ready state:', audio.readyState);  // Verbose: commented out
    };
    
    const handleLoadStart = () => {
      // console.log('Audio load started');  // Verbose: commented out
    };
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [isDragging, onProgressChange, normalizedAudioUrl]);
  
  useEffect(() => {
    // Load saved volume preference
    const savedVolume = localStorage.getItem('audioPlayerVolume');
    const initialVolume = savedVolume ? parseFloat(savedVolume) : 1;
    // console.log('Initializing volume to:', initialVolume);  // Verbose: commented out
    setVolume(initialVolume);
    if (audioRef.current) {
      audioRef.current.volume = initialVolume;
      // console.log('Initial audio element volume:', audioRef.current.volume);  // Verbose: commented out
    }
  }, []);
  
  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
      // console.log('Audio paused');  // Verbose: commented out
    } else {
      try {
        // console.log('Attempting to play audio:', normalizedAudioUrl);  // Verbose: commented out
        await audio.play();
        // console.log('Audio playing successfully');  // Verbose: commented out
      } catch (error) {
        console.error('Failed to play audio:', error);
        console.error('Audio element state:', {
          src: audio.src,
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: audio.error,
          duration: audio.duration,
          volume: audio.volume,
          muted: audio.muted
        });
      }
    }
    setIsPlaying(!isPlaying);
  };
  
  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
  };
  
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = progressBarRef.current;
    const audio = audioRef.current;
    if (!progressBar || !audio) return;
    
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  const handleProgressBarDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    handleProgressBarClick(e);
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    // console.log('Setting volume to:', newVolume);  // Verbose: commented out
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      // console.log('Audio element volume set to:', audioRef.current.volume);  // Verbose: commented out
    }
    localStorage.setItem('audioPlayerVolume', newVolume.toString());
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <audio ref={audioRef} src={normalizedAudioUrl} preload="metadata" />
      
      <div className="mb-4">
        <h3 className="text-sm font-medium text-neutral-100 truncate">{chapterTitle}</h3>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-4">
        <div 
          ref={progressBarRef}
          className="relative h-2 bg-neutral-800 rounded-full cursor-pointer group"
          onClick={handleProgressBarClick}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onMouseMove={handleProgressBarDrag}
        >
          <div 
            className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-100"
            style={{ width: `${progressPercentage}%` }}
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progressPercentage}%`, marginLeft: '-6px' }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-neutral-500">{formatTime(currentTime)}</span>
          <span className="text-xs text-neutral-500">{formatTime(duration)}</span>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => skip(-10)}
          className="text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
          title="Rewind 10 seconds"
        >
          <SkipBack className="h-4 w-4" />
          <span className="ml-1 text-xs">10s</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayPause}
          className="text-neutral-100 hover:bg-neutral-800 px-6"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => skip(10)}
          className="text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
          title="Forward 10 seconds"
        >
          <span className="mr-1 text-xs">10s</span>
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Volume Control */}
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-neutral-500" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={handleVolumeChange}
          className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-sm"
        />
        <span className="text-xs text-neutral-500 w-8">{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
};