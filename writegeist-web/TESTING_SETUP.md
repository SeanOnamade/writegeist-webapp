# Writegeist Web - Testing Setup Guide

This guide will help you set up and test the Writegeist web application.

## 🚀 Quick Start Checklist

### 1. Environment Variables Setup

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI API (for AI chat features)
OPENAI_API_KEY=your_openai_api_key

# Next.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_key
```

### 2. Supabase Setup

#### A. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key from Settings > API

#### B. Run Database Migrations
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Initialize Supabase in your project
supabase init

# Link to your Supabase project
supabase link --project-ref your_project_ref

# Run migrations to set up database schema
supabase db push
```

#### C. Set up Row Level Security (RLS)
The migrations should automatically set up RLS policies, but verify in your Supabase dashboard:
- Go to Authentication > Policies
- Ensure policies exist for all tables (users, projects, chapters, ideas, etc.)

### 3. Database Schema Verification

Check that these tables exist in your Supabase database:
- `users` - User profiles
- `projects` - Writing projects
- `chapters` - Book chapters
- `ideas` - Creative ideas
- `audio_files` - Audio recordings
- `chat_sessions` - AI chat sessions
- `chat_messages` - Chat message history
- `document_embeddings` - Search vectors
- `ingested_documents` - Uploaded documents

### 4. Storage Buckets Setup

In Supabase Dashboard > Storage, create these buckets:
- `audio` - For audio file uploads
- `documents` - For document uploads
- `avatars` - For user profile pictures

Set appropriate policies for each bucket (see `supabase/migrations/20240101000003_storage_setup.sql`).

### 5. Authentication Setup

#### A. Configure Auth Providers
In Supabase Dashboard > Authentication > Settings:
1. Enable Email authentication
2. Set Site URL to `http://localhost:3000`
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000`

#### B. Email Templates (Optional)
Customize email templates in Authentication > Email Templates if desired.

### 6. Install Dependencies & Start Development Server

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app should now be running at `http://localhost:3000`.

## 🧪 Testing Features

### Core Features to Test

#### 1. Authentication Flow
- [ ] Sign up with email/password
- [ ] Sign in with existing account
- [ ] Sign out functionality
- [ ] Protected routes redirect to login

#### 2. Project Management
- [ ] Create new project
- [ ] Edit project details
- [ ] Delete project
- [ ] View project statistics
- [ ] Search and filter projects

#### 3. Chapter Writing
- [ ] Create new chapter
- [ ] Edit chapter content
- [ ] Auto-save functionality (wait 30 seconds)
- [ ] Chapter reordering (drag & drop)
- [ ] Word count updates in real-time
- [ ] Chapter status changes

#### 4. Ideas Management
- [ ] Create new idea
- [ ] Add/remove tags
- [ ] Link idea to project
- [ ] Change idea status
- [ ] Search ideas by content/tags

#### 5. Global Search
- [ ] Press Cmd/Ctrl+K to open search
- [ ] Search across projects, chapters, ideas
- [ ] Navigate with arrow keys
- [ ] Select with Enter key

#### 6. AI Chat Assistant
- [ ] Start new chat session
- [ ] Send messages and receive responses
- [ ] Link chat to specific project
- [ ] View chat history in sidebar
- [ ] Delete chat sessions

#### 7. Document Ingestion
- [ ] Upload text files (.txt, .md)
- [ ] Upload documents (.pdf, .docx) - will show placeholder content
- [ ] Link documents to projects
- [ ] Search through document library
- [ ] Preview document content

## 🐛 Common Issues & Solutions

### Issue: "Missing script: dev"
**Solution**: The project uses `npm start` instead of `npm run dev`
```bash
npm start
```

### Issue: Supabase connection errors
**Solution**: 
1. Verify your `.env.local` file has correct Supabase credentials
2. Check that your Supabase project is active
3. Ensure database migrations have been run

### Issue: Authentication not working
**Solution**:
1. Check Supabase Auth settings
2. Verify Site URL and redirect URLs are correct
3. Ensure RLS policies are properly set up

### Issue: Build errors
**Solution**:
```bash
# Check for TypeScript errors
npm run build

# Fix any linting issues
npm run lint:fix
```

### Issue: Database queries failing
**Solution**:
1. Check RLS policies in Supabase dashboard
2. Verify user is authenticated
3. Check browser console for detailed error messages

## 📊 Test Data

### Sample Projects
Create a few test projects with different statuses:
- "My First Novel" (Active)
- "Short Story Collection" (Draft) 
- "Research Notes" (Archived)

### Sample Chapters
Add chapters to test projects:
- Different word counts
- Various statuses (draft, in progress, completed)
- Different content lengths

### Sample Ideas
Create ideas with:
- Different tags (character, plot, setting, theme)
- Various statuses (new, in progress, used, archived)
- Some linked to projects, some general

## 🔧 Development Tools

### Useful Commands
```bash
# Start development server
npm start

# Build for production
npm run build

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Browser DevTools
- Check Console for errors
- Network tab for API calls
- Application tab for localStorage/cookies
- Supabase logs in dashboard

## 📝 Testing Checklist

### Before Testing
- [ ] `.env.local` file created with all required variables
- [ ] Supabase project created and configured
- [ ] Database migrations run successfully
- [ ] Storage buckets created
- [ ] Dependencies installed
- [ ] Development server running

### During Testing
- [ ] Test all authentication flows
- [ ] Create and manage projects
- [ ] Write and edit chapters
- [ ] Use ideas management
- [ ] Try global search (Cmd/Ctrl+K)
- [ ] Test AI chat features
- [ ] Upload and manage documents
- [ ] Test on different screen sizes
- [ ] Check mobile responsiveness

### After Testing
- [ ] Check browser console for errors
- [ ] Verify data persistence after refresh
- [ ] Test logout/login cycle
- [ ] Check Supabase dashboard for data

## 🚨 Known Limitations

1. **AI Chat**: Currently uses simulated responses. To enable real AI, add OpenAI API key and implement actual API calls.

2. **Document Processing**: PDF and Word document text extraction shows placeholder content. Real implementation would need libraries like PDF.js or mammoth.js.

3. **Audio Features**: Audio upload/playback UI is placeholder. Real implementation needs audio processing libraries.

4. **Real-time Collaboration**: Not implemented yet. Would require Supabase real-time subscriptions.

5. **Export Features**: Export functionality is placeholder. Would need document generation libraries.

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Look at browser console errors
3. Check Supabase dashboard logs
4. Verify all environment variables are set correctly

Happy testing! 🎉

