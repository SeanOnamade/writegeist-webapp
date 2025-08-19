-- Fix for production deployment - ensure search_embeddings function exists
-- Run this in your Supabase SQL Editor

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION search_embeddings TO anon;
