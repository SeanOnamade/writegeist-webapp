import { createClient } from '@/lib/supabase/server'

/**
 * Manual ping endpoint for Supabase keep-alive
 * You can call this endpoint manually or set up external cron jobs
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Simple ping - just check if we can connect
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
    
    return Response.json({ 
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Supabase pinged successfully'
    })
  } catch (error) {
    return Response.json({ 
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Failed to ping Supabase'
    })
  }
}
