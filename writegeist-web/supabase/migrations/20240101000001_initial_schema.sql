-- Writegeist Web Migration - Initial Database Schema
-- This migration creates all tables and relationships for the Writegeist application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create custom types
CREATE TYPE project_status AS ENUM ('active', 'archived', 'draft');
CREATE TYPE chapter_status AS ENUM ('draft', 'in_progress', 'completed', 'published');
CREATE TYPE audio_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE idea_status AS ENUM ('new', 'in_progress', 'used', 'archived');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status project_status DEFAULT 'draft',
    metadata JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    word_count INTEGER DEFAULT 0,
    chapter_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chapters table
CREATE TABLE public.chapters (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    status chapter_status DEFAULT 'draft',
    order_index INTEGER NOT NULL,
    word_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, order_index)
);

-- Ideas table
CREATE TABLE public.ideas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status idea_status DEFAULT 'new',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audio files table
CREATE TABLE public.audio_files (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    duration INTEGER, -- in seconds
    status audio_status DEFAULT 'pending',
    generation_settings JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE public.chat_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document embeddings table (for AI search and analysis)
CREATE TABLE public.document_embeddings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'chapter', 'idea', 'note'
    content_hash TEXT NOT NULL,
    content_text TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingested documents table
CREATE TABLE public.ingested_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    content_text TEXT,
    processing_status TEXT DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_chapters_project_id ON public.chapters(project_id);
CREATE INDEX idx_chapters_user_id ON public.chapters(user_id);
CREATE INDEX idx_chapters_order ON public.chapters(project_id, order_index);
CREATE INDEX idx_ideas_user_id ON public.ideas(user_id);
CREATE INDEX idx_ideas_project_id ON public.ideas(project_id);
CREATE INDEX idx_ideas_status ON public.ideas(status);
CREATE INDEX idx_audio_files_chapter_id ON public.audio_files(chapter_id);
CREATE INDEX idx_audio_files_user_id ON public.audio_files(user_id);
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_document_embeddings_user_id ON public.document_embeddings(user_id);
CREATE INDEX idx_document_embeddings_project_id ON public.document_embeddings(project_id);
CREATE INDEX idx_ingested_documents_user_id ON public.ingested_documents(user_id);

-- Create vector similarity search index
CREATE INDEX ON public.document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingested_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see and modify their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chapters" ON public.chapters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chapters" ON public.chapters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chapters" ON public.chapters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chapters" ON public.chapters FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own ideas" ON public.ideas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ideas" ON public.ideas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ideas" ON public.ideas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ideas" ON public.ideas FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own audio files" ON public.audio_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audio files" ON public.audio_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own audio files" ON public.audio_files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own audio files" ON public.audio_files FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat sessions" ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat sessions" ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat sessions" ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own embeddings" ON public.document_embeddings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own embeddings" ON public.document_embeddings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own embeddings" ON public.document_embeddings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own embeddings" ON public.document_embeddings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own documents" ON public.ingested_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.ingested_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.ingested_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.ingested_documents FOR DELETE USING (auth.uid() = user_id);

