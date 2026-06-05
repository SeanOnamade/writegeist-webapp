-- Audio system for Writegeist Web App
-- Handles TTS generation, storage, and playback

-- Audio files table
CREATE TABLE IF NOT EXISTS chapter_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  
  -- Audio file information
  audio_url TEXT, -- Supabase Storage public URL
  file_path TEXT, -- Internal storage path
  duration INTEGER DEFAULT 0, -- Duration in seconds
  file_size BIGINT DEFAULT 0, -- File size in bytes
  
  -- TTS settings used
  voice_model TEXT DEFAULT 'alloy' CHECK (voice_model IN ('alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer')),
  tts_model TEXT DEFAULT 'tts-1-hd' CHECK (tts_model IN ('tts-1', 'tts-1-hd')),
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error', 'outdated')),
  error_message TEXT,
  
  -- Content hash to detect when chapter content changes
  content_hash TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one audio per chapter per user
  UNIQUE(user_id, chapter_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chapter_audio_user_id ON chapter_audio(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_audio_chapter_id ON chapter_audio(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_audio_status ON chapter_audio(status);
CREATE INDEX IF NOT EXISTS idx_chapter_audio_project_id ON chapter_audio(project_id);

-- Enable RLS
ALTER TABLE chapter_audio ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only access their own audio" ON chapter_audio
  FOR ALL USING (auth.uid() = user_id);

-- Audio generation queue for background processing
CREATE TABLE IF NOT EXISTS audio_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
  audio_id UUID REFERENCES chapter_audio(id) ON DELETE CASCADE NOT NULL,
  
  -- Queue management
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Status and error tracking
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure one queue item per audio
  UNIQUE(audio_id)
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON audio_generation_queue(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_queue_user_id ON audio_generation_queue(user_id);

-- Enable RLS
ALTER TABLE audio_generation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies  
CREATE POLICY "Users can only access their own queue items" ON audio_generation_queue
  FOR ALL USING (auth.uid() = user_id);

-- Function to automatically mark audio as outdated when chapter content changes
CREATE OR REPLACE FUNCTION mark_audio_outdated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If chapter content changed, mark associated audio as outdated
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    UPDATE chapter_audio 
    SET 
      status = 'outdated',
      updated_at = NOW()
    WHERE chapter_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to mark audio as outdated when chapter content changes
DROP TRIGGER IF EXISTS chapter_content_changed_audio_trigger ON chapters;
CREATE TRIGGER chapter_content_changed_audio_trigger
  AFTER UPDATE ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION mark_audio_outdated();

-- Function to clean up old queue items
CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete completed/failed queue items older than 7 days
  DELETE FROM audio_generation_queue 
  WHERE status IN ('completed', 'failed') 
    AND created_at < NOW() - INTERVAL '7 days';
    
  -- Reset stuck processing items older than 1 hour
  UPDATE audio_generation_queue 
  SET 
    status = 'queued',
    started_at = NULL,
    retry_count = retry_count + 1
  WHERE status = 'processing' 
    AND started_at < NOW() - INTERVAL '1 hour'
    AND retry_count < max_retries;
    
  -- Mark failed items that exceeded max retries
  UPDATE audio_generation_queue 
  SET status = 'failed'
  WHERE status = 'processing' 
    AND started_at < NOW() - INTERVAL '1 hour'
    AND retry_count >= max_retries;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION mark_audio_outdated() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_queue_items() TO authenticated;
