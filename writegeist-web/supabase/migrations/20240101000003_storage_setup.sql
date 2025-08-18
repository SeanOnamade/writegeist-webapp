-- Writegeist Web Migration - Storage Setup
-- This migration creates storage buckets and policies for file management

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('audio-files', 'audio-files', false, 52428800, ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg']), -- 50MB limit
    ('documents', 'documents', false, 10485760, ARRAY['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']), -- 10MB limit
    ('user-avatars', 'user-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']); -- 2MB limit

-- Create storage policies for audio files
CREATE POLICY "Users can view own audio files" ON storage.objects FOR SELECT 
    USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own audio files" ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own audio files" ON storage.objects FOR UPDATE 
    USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own audio files" ON storage.objects FOR DELETE 
    USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for documents
CREATE POLICY "Users can view own documents" ON storage.objects FOR SELECT 
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own documents" ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own documents" ON storage.objects FOR UPDATE 
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE 
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for user avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT 
    USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE 
    USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE 
    USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

