# Writegeist Web - Database Setup Guide

This guide will help you set up the complete database infrastructure for the Writegeist web application using Supabase.

## Prerequisites

- Node.js 18+ installed
- Supabase account (https://supabase.com)
- Git repository access

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `writegeist-web`
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project initialization (2-3 minutes)

## Step 2: Get Project Credentials

1. In your Supabase dashboard, go to **Settings > API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **Anon/Public Key** (starts with `eyJ`)
   - **Service Role Key** (starts with `eyJ`) - Keep this secret!

## Step 3: Configure Environment Variables

Create a `.env.local` file in your `writegeist-web` directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# OpenAI Configuration (for AI features)
OPENAI_API_KEY=your_openai_api_key_here

# Backend API Configuration
BACKEND_API_URL=http://localhost:8000

# Database URL (for direct connections if needed)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

## Step 4: Run Database Migrations

### Option A: Using Supabase Dashboard (Recommended)

1. Go to **SQL Editor** in your Supabase dashboard
2. Create a new query
3. Copy and paste the contents of `supabase/migrations/20240101000001_initial_schema.sql`
4. Click "Run" to execute
5. Repeat for `20240101000002_functions_and_triggers.sql`
6. Repeat for `20240101000003_storage_setup.sql`

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI globally
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

## Step 5: Enable Required Extensions

In the Supabase SQL Editor, run:

```sql
-- Enable vector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Step 6: Configure Authentication

1. Go to **Authentication > Settings** in Supabase dashboard
2. Configure **Site URL**: `http://localhost:3000` (development)
3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://your-production-domain.com/auth/callback` (when deploying)
4. Enable **Email confirmations** if desired
5. Configure **SMTP settings** for email (optional for development)

## Step 7: Set Up Storage

The migration automatically creates these storage buckets:
- `audio-files`: For generated audio files (50MB limit)
- `documents`: For uploaded documents (10MB limit)  
- `user-avatars`: For profile pictures (2MB limit, public)

## Step 8: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000`
3. Try creating an account via `/signup`
4. Check that the user appears in **Authentication > Users**
5. Verify the user record is created in the `users` table

## Step 9: Add Sample Data (Optional)

1. Create a test user account through your app
2. Get the user ID from **Authentication > Users**
3. Edit `supabase/seed.sql` and replace the placeholder UUID
4. Run the seed file in the SQL Editor

## Database Schema Overview

### Core Tables

- **users**: User profiles (extends Supabase auth)
- **projects**: Writing projects/books
- **chapters**: Individual chapters within projects
- **ideas**: Story ideas and notes
- **audio_files**: Generated audio narrations
- **chat_sessions**: AI chat conversations
- **chat_messages**: Individual chat messages
- **document_embeddings**: AI-powered search vectors
- **ingested_documents**: Uploaded reference documents

### Key Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Automatic Timestamps**: `created_at` and `updated_at` managed automatically
- **Word Count Tracking**: Chapters automatically calculate word counts
- **Project Statistics**: Projects track total words and chapter counts
- **Vector Search**: AI-powered semantic search capabilities
- **File Storage**: Organized by user with proper permissions

## Troubleshooting

### Common Issues

1. **Migration Errors**: Ensure you run migrations in order
2. **RLS Policies**: Make sure you're authenticated when testing
3. **Storage Permissions**: Check bucket policies if file uploads fail
4. **Environment Variables**: Verify all required vars are set

### Useful Queries

```sql
-- Check user data
SELECT * FROM auth.users;
SELECT * FROM public.users;

-- Check project statistics
SELECT 
  p.title,
  p.word_count,
  p.chapter_count,
  COUNT(c.id) as actual_chapters
FROM projects p
LEFT JOIN chapters c ON p.id = c.project_id
GROUP BY p.id, p.title, p.word_count, p.chapter_count;

-- Check storage usage
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint as total_size
FROM storage.objects
GROUP BY bucket_id;
```

## Production Deployment

When deploying to production:

1. Update environment variables with production URLs
2. Configure custom domain in Supabase dashboard
3. Update CORS settings if needed
4. Set up database backups
5. Monitor usage and scaling needs

## Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Service role key kept secret
- [ ] CORS configured properly
- [ ] File upload limits set appropriately
- [ ] Email confirmation enabled (recommended)
- [ ] Strong database password used
- [ ] Regular backups configured

## Next Steps

After completing this setup:

1. Test all authentication flows
2. Create sample projects and chapters
3. Test file uploads to storage buckets
4. Verify AI features work (if OpenAI key configured)
5. Set up monitoring and alerts

Your Writegeist web application is now ready with a fully configured, production-ready database!

