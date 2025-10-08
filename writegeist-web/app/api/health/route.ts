import { createClient } from '@/lib/supabase/server'

/**
 * Minimal health check endpoint for Supabase keep-alive
 * This endpoint performs the most basic possible database operation
 * that cannot possibly affect your data or application state.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Ultra-safe query: just check if we can connect to the database
    // This uses the most basic possible operation that can't affect data
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single()
    
    // We don't even care about the result - just that the connection works
    // This is completely read-only and safe
    
    return Response.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      supabase_connected: !error
    })
  } catch (error) {
    // Even if this fails, it's not critical - just log it
    console.log('Health check pinged Supabase:', new Date().toISOString())
    
    return Response.json({ 
      status: 'pinged',
      timestamp: new Date().toISOString(),
      note: 'Connection attempted - sufficient to keep project alive'
    })
  }
}
