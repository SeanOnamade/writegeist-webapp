import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * A typed Supabase client — either the browser singleton
 * (lib/supabase/client) or a per-request server client (lib/supabase/server).
 * All lib/data functions accept this so they work in both environments.
 */
export type DbClient = SupabaseClient<Database>
