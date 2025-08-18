import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not set. Using placeholder values for build.')
    return createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-anon-key'
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Create a singleton client for use in client components
export const supabase = createClient()
