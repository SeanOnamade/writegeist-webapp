-- Writegeist Web Migration - Functions and Triggers
-- This migration creates database functions and triggers for automation

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update word count for chapters
CREATE OR REPLACE FUNCTION update_chapter_word_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.word_count = array_length(string_to_array(trim(NEW.content), ' '), 1);
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update project statistics
CREATE OR REPLACE FUNCTION update_project_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update word count and chapter count for the project
    UPDATE public.projects 
    SET 
        word_count = (
            SELECT COALESCE(SUM(word_count), 0) 
            FROM public.chapters 
            WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
        ),
        chapter_count = (
            SELECT COUNT(*) 
            FROM public.chapters 
            WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to reorder chapters after deletion
CREATE OR REPLACE FUNCTION reorder_chapters_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Reorder remaining chapters to fill the gap
    UPDATE public.chapters 
    SET order_index = order_index - 1
    WHERE project_id = OLD.project_id 
    AND order_index > OLD.order_index;
    
    RETURN OLD;
END;
$$ language 'plpgsql';

-- Function for semantic search using embeddings
CREATE OR REPLACE FUNCTION search_documents(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_user_id uuid DEFAULT NULL,
    filter_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content_text text,
    content_type text,
    similarity float,
    metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        document_embeddings.id,
        document_embeddings.content_text,
        document_embeddings.content_type,
        1 - (document_embeddings.embedding <=> query_embedding) as similarity,
        document_embeddings.metadata
    FROM document_embeddings
    WHERE 
        (filter_user_id IS NULL OR document_embeddings.user_id = filter_user_id)
        AND (filter_project_id IS NULL OR document_embeddings.project_id = filter_project_id)
        AND 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
    ORDER BY document_embeddings.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON public.chapters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ideas_updated_at BEFORE UPDATE ON public.ideas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_files_updated_at BEFORE UPDATE ON public.audio_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_embeddings_updated_at BEFORE UPDATE ON public.document_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingested_documents_updated_at BEFORE UPDATE ON public.ingested_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for chapter word count
CREATE TRIGGER update_chapter_word_count_trigger BEFORE INSERT OR UPDATE ON public.chapters
    FOR EACH ROW EXECUTE FUNCTION update_chapter_word_count();

-- Create triggers for project statistics
CREATE TRIGGER update_project_stats_on_chapter_change 
    AFTER INSERT OR UPDATE OR DELETE ON public.chapters
    FOR EACH ROW EXECUTE FUNCTION update_project_stats();

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create trigger for chapter reordering
CREATE TRIGGER reorder_chapters_after_delete_trigger
    AFTER DELETE ON public.chapters
    FOR EACH ROW EXECUTE FUNCTION reorder_chapters_after_delete();

