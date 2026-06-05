-- Vector similarity search RPC used by the embeddings search API.
-- Modeled on search_documents with a project_filter arg.
-- Must drop first: CREATE OR REPLACE cannot change an existing function's return type.

DROP FUNCTION IF EXISTS public.search_embeddings(vector, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION public.search_embeddings(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    project_filter uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content_text text,
    content_type text,
    similarity float,
    metadata jsonb,
    chapter_id uuid,
    project_id uuid
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        document_embeddings.id,
        document_embeddings.content_text,
        document_embeddings.content_type,
        1 - (document_embeddings.embedding <=> query_embedding) AS similarity,
        document_embeddings.metadata,
        document_embeddings.chapter_id,
        document_embeddings.project_id
    FROM document_embeddings
    WHERE
        (project_filter IS NULL OR document_embeddings.project_id = project_filter)
        AND 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
    ORDER BY document_embeddings.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_embeddings(vector, float, int, uuid) TO authenticated;
