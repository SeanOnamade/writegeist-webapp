# Environment Configuration

This document describes the environment variables needed for the Writegeist web application.

## Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### OpenAI Configuration
```
OPENAI_API_KEY=your_openai_api_key
```

### Backend API Configuration
```
BACKEND_API_URL=your_railway_fastapi_url
```

### Database Configuration (if direct PostgreSQL access needed)
```
DATABASE_URL=your_postgresql_connection_string
```

### Next.js Configuration
```
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

### Development
```
NODE_ENV=development
```

## Setup Instructions

1. Copy the variables above into a new file called `.env.local`
2. Replace the placeholder values with your actual credentials
3. Ensure `.env.local` is in your `.gitignore` file (it should be by default)
4. Restart your development server after making changes

## Security Notes

- Never commit `.env.local` or any file containing real credentials to version control
- Use `NEXT_PUBLIC_` prefix only for variables that should be exposed to the browser
- Server-side only variables (like `SUPABASE_SERVICE_ROLE_KEY`) should not have the `NEXT_PUBLIC_` prefix

