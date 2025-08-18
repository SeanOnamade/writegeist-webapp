-- Drop the existing function first if it exists
DROP FUNCTION IF EXISTS search_embeddings(vector, float, int, uuid);

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  project_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content_text text,
  similarity float,
  chapter_id uuid,
  project_id uuid,
  content_type text,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content_text,
    (document_embeddings.embedding <=> query_embedding) * -1 + 1 AS similarity,
    document_embeddings.chapter_id,
    document_embeddings.project_id,
    document_embeddings.content_type,
    document_embeddings.metadata
  FROM document_embeddings
  WHERE 
    (project_filter IS NULL OR document_embeddings.project_id = project_filter)
    AND (document_embeddings.embedding <=> query_embedding) < (1 - match_threshold)
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function to automatically generate embeddings when chapters are updated
CREATE OR REPLACE FUNCTION trigger_embedding_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only trigger for chapters with substantial content
  IF NEW.content IS NOT NULL AND length(NEW.content) > 50 THEN
    -- Note: In a real implementation, you'd want to call the embedding API
    -- This is a placeholder that would be triggered by the application
    PERFORM pg_notify('generate_embedding', json_build_object(
      'chapter_id', NEW.id,
      'project_id', NEW.project_id,
      'content', NEW.content
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate embeddings when chapters are created/updated
DROP TRIGGER IF EXISTS chapter_embedding_trigger ON chapters;
CREATE TRIGGER chapter_embedding_trigger
  AFTER INSERT OR UPDATE OF content ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION trigger_embedding_generation();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_embedding_generation TO authenticated;
