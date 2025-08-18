-- Migration: Storage-based content system for large chapters
-- This allows chapters of any size by storing content in Supabase Storage

-- Create storage bucket for chapter content
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chapter-content',
  'chapter-content', 
  false,
  10485760, -- 10MB limit
  ARRAY['text/plain', 'text/markdown']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for chapter content
CREATE POLICY "Authenticated users can upload chapter content"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chapter-content');

CREATE POLICY "Users can read their own chapter content"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chapter-content' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own chapter content"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chapter-content' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own chapter content"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chapter-content' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add content_file_path column to chapters table
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS content_file_path TEXT;

-- Create function to load content from storage file
CREATE OR REPLACE FUNCTION get_chapter_content_from_storage(file_path TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  content_text TEXT;
BEGIN
  -- This would normally read from storage, but for now we'll use a placeholder
  -- In practice, this would be handled by the application layer
  RETURN NULL;
END;
$$;

-- Create function to save large chapter content via storage
CREATE OR REPLACE FUNCTION save_chapter_with_storage(
  chapter_id UUID,
  new_title TEXT DEFAULT NULL,
  new_status TEXT DEFAULT NULL,
  new_word_count INTEGER DEFAULT NULL,
  new_order_index INTEGER DEFAULT NULL,
  file_path TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  status TEXT,
  order_index INTEGER,
  word_count INTEGER,
  project_id UUID,
  user_id UUID,
  content_file_path TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update chapter metadata and file path
  UPDATE chapters 
  SET 
    title = COALESCE(new_title, chapters.title),
    status = COALESCE(new_status, chapters.status)::chapter_status,
    word_count = COALESCE(new_word_count, chapters.word_count),
    order_index = COALESCE(new_order_index, chapters.order_index),
    content_file_path = COALESCE(file_path, chapters.content_file_path),
    updated_at = NOW()
  WHERE chapters.id = chapter_id
    AND chapters.user_id = auth.uid();
  
  -- Return updated chapter (content will be loaded separately)
  RETURN QUERY
  SELECT 
    chapters.id,
    chapters.title,
    chapters.content, -- This might be NULL if using storage
    chapters.status::TEXT,
    chapters.order_index,
    chapters.word_count,
    chapters.project_id,
    chapters.user_id,
    chapters.content_file_path,
    chapters.metadata,
    chapters.created_at,
    chapters.updated_at
  FROM chapters 
  WHERE chapters.id = chapter_id
    AND chapters.user_id = auth.uid();
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_chapter_content_from_storage TO authenticated;
GRANT EXECUTE ON FUNCTION save_chapter_with_storage TO authenticated;

-- Create trigger to generate embeddings when content file is updated
CREATE OR REPLACE FUNCTION trigger_embedding_for_storage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only trigger if content_file_path changed and is not null
  IF NEW.content_file_path IS NOT NULL AND 
     (OLD.content_file_path IS NULL OR OLD.content_file_path != NEW.content_file_path) THEN
    
    -- Notify application to generate embeddings for the file
    PERFORM pg_notify('generate_embedding_from_storage', json_build_object(
      'chapter_id', NEW.id,
      'project_id', NEW.project_id,
      'file_path', NEW.content_file_path,
      'user_id', NEW.user_id
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for storage-based embedding generation
DROP TRIGGER IF EXISTS chapter_storage_embedding_trigger ON chapters;
CREATE TRIGGER chapter_storage_embedding_trigger
  AFTER UPDATE OF content_file_path ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION trigger_embedding_for_storage();

