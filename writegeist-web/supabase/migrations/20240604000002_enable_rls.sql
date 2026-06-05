-- Ensure RLS is enabled on tables exposed via PostgREST.
-- Idempotent: safe to run even if already enabled in production.

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
