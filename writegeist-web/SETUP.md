# Writegeist Web — Setup

Single reference for environment variables, database setup, and deployment.

## 1. Environment variables

Create `.env.local` in `writegeist-web/`:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key   # server-only, keep secret

# Encryption for user-stored OpenAI keys (required to save keys in Settings)
# Any long random string, e.g. `openssl rand -base64 32`
ENCRYPTION_KEY=your_random_secret

# OpenAI fallback key (optional — users normally add their own key in Settings)
OPENAI_API_KEY=your_openai_api_key
```

Notes:

- Only `NEXT_PUBLIC_*` variables are exposed to the browser. Everything else is server-only.
- `ENCRYPTION_KEY` is required for the Settings > OpenAI API key feature; the app refuses to store keys without it.
- Set the same variables in the Vercel project settings for production.

## 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com/dashboard) and copy the URL, anon key, and service role key from Settings > API.
2. Enable extensions (SQL Editor):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

3. Run every file in `supabase/migrations/` in order, either by pasting them into the SQL Editor or with the CLI:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

4. Authentication > Settings: set the Site URL (`http://localhost:3000` for dev, your domain for prod) and add `/auth/callback` redirect URLs.

Storage buckets (`chapter-content`, audio, avatars) are created by the migrations.

## 3. Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint       # eslint
```

## 4. Deployment (Vercel)

The Vercel project is `writegeist-web`. Deploy from the repo:

```bash
git push origin main
npx vercel --prod
```

A GitHub Action (`.github/workflows/keep-alive.yml`) pings Supabase weekly so the free-tier project is not paused. It requires the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` repository secrets.

## 5. Smoke test checklist

After setup or a deploy, verify:

- Sign up / log in / log out
- Create a project, add a chapter, write and save content (auto-save after ~30s)
- Ideas: create, filter, link to a project
- Chat: ask a question about your project (requires an OpenAI key in Settings)
- Audio: generate narration for a chapter, play and download it
- Search (Ctrl/Cmd+K), theme toggle in Settings
