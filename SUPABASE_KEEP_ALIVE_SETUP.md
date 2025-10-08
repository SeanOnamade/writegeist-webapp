# Supabase Keep-Alive Setup

This setup prevents your Supabase project from being paused due to inactivity (7+ days without activity).

## What Was Created

1. **GitHub Actions Workflow** (`.github/workflows/keep-alive.yml`)
   - Runs every 6 days (well under the 7-day limit)
   - Makes a simple, read-only ping to your Supabase project
   - Completely safe - cannot affect your data

2. **Health Check API Route** (`writegeist-web/app/api/health/route.ts`)
   - Backup option for external cron services
   - Minimal database connection test
   - Safe fallback if GitHub Actions isn't preferred

## Setup Instructions

### Option 1: GitHub Actions (Recommended - Free & Automatic)

1. **Add GitHub Secrets:**
   - Go to your GitHub repository
   - Navigate to Settings → Secrets and variables → Actions
   - Add these repository secrets:
     - `SUPABASE_URL`: Your Supabase project URL (e.g., `https://your-project.supabase.co`)
     - `SUPABASE_ANON_KEY`: Your Supabase anon/public key

2. **Test the Workflow:**
   - Go to Actions tab in your GitHub repository
   - Find "Keep Supabase Alive" workflow
   - Click "Run workflow" to test it manually

### Option 2: External Cron Service (Alternative)

If you prefer not to use GitHub Actions, you can use external services like:
- [cron-job.org](https://cron-job.org) (free)
- [UptimeRobot](https://uptimerobot.com) (free)

**Setup:**
1. Create a cron job that runs every 6 days
2. Set the URL to: `https://your-domain.com/api/health`
3. That's it!

## How It Works

- **Ultra-Safe**: Only performs read-only operations that cannot affect your data
- **Minimal**: Just pings the Supabase REST API to show activity
- **Reliable**: Runs every 6 days to stay well under the 7-day inactivity limit
- **Unintrusive**: No impact on your application performance or data

## Verification

After setup, you can verify it's working by:
1. Checking the GitHub Actions logs (if using Option 1)
2. Monitoring your Supabase dashboard for activity
3. The workflow will show as "successful" when it runs

## Troubleshooting

- **Workflow fails**: Check that your GitHub secrets are set correctly
- **API route fails**: Ensure your Supabase environment variables are configured
- **Still getting paused**: Contact Supabase support - this should prevent pausing

This setup is designed to be as simple and safe as possible while effectively preventing your Supabase project from being paused due to inactivity.
