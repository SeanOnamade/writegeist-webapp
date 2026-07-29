# Writegeist Web

AI-powered writing platform for authors: organize book projects and chapters, capture ideas, chat with an assistant that knows your manuscript, and generate audio narration.

## Features

- **Projects and chapters** — full writing workflow with auto-save, word counts, and statuses
- **Ideas board** — capture, tag, and link story ideas to projects
- **Manuscript-aware chat** — AI assistant grounded in your chapters via vector search (pgvector)
- **Audio narration** — OpenAI text-to-speech with chunking for long chapters, streaming progress, and a built-in player
- **Reader mode** — distraction-free reading with a table of contents and progress tracking

## Stack

Next.js (App Router) · React · Tailwind CSS · Supabase (Postgres, Auth, Storage, pgvector) · OpenAI

## Getting started

See [SETUP.md](./SETUP.md) for environment variables, Supabase setup, and deployment.

```bash
npm install
npm run dev
```
