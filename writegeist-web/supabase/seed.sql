-- Writegeist Web Migration - Sample Data
-- This file contains sample data for testing the application
-- Note: This will only work after you have created a test user through Supabase Auth

-- Sample user data (you'll need to replace the UUID with your actual user ID)
-- INSERT INTO public.users (id, email, full_name) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com', 'Test User');

-- Sample project
-- INSERT INTO public.projects (id, user_id, title, description, status) 
-- VALUES (
--     '11111111-1111-1111-1111-111111111111',
--     '00000000-0000-0000-0000-000000000000',
--     'My First Novel',
--     'A thrilling adventure story about a young writer discovering the power of AI.',
--     'active'
-- );

-- Sample chapters
-- INSERT INTO public.chapters (project_id, user_id, title, content, order_index, status) VALUES
-- ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'Chapter 1: The Beginning', 'It was a dark and stormy night when Sarah first discovered the mysterious AI writing assistant...', 1, 'draft'),
-- ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'Chapter 2: The Discovery', 'The next morning, Sarah opened her laptop to find that the AI had written three more chapters overnight...', 2, 'draft'),
-- ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'Chapter 3: The Revelation', 'As Sarah read through the AI-generated content, she realized something extraordinary was happening...', 3, 'draft');

-- Sample ideas
-- INSERT INTO public.ideas (user_id, project_id, title, content, status, tags) VALUES
-- ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Character Development', 'Sarah should have a background in computer science to make her discovery more believable.', 'new', ARRAY['character', 'backstory']),
-- ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Plot Twist', 'What if the AI is actually sentient and has been waiting for someone like Sarah?', 'new', ARRAY['plot', 'twist', 'ai']),
-- ('00000000-0000-0000-0000-000000000000', NULL, 'New Story Concept', 'A story about time-traveling librarians who preserve knowledge across different eras.', 'new', ARRAY['concept', 'time-travel', 'library']);

-- Sample chat session
-- INSERT INTO public.chat_sessions (user_id, project_id, title) VALUES
-- ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Brainstorming Session 1');

-- Instructions for using this seed data:
-- 1. Create a user account through your Supabase Auth UI
-- 2. Get the user ID from the auth.users table
-- 3. Replace '00000000-0000-0000-0000-000000000000' with your actual user ID
-- 4. Uncomment the INSERT statements above
-- 5. Run this file in your Supabase SQL editor

-- You can also use this query to get your user ID after signing up:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

