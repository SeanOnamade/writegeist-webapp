import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getApiKey } from '@/lib/crypto'

interface ApiKeyResult {
  apiKey: string | null
  source: 'user_settings' | 'environment' | 'none'
}

/**
 * Get OpenAI API key with consistent priority:
 * 1. User Settings (from database) - using provided userId or authenticated user
 * 2. Environment Variable
 * 3. None available
 */
export async function getOpenAIApiKey(userId?: string): Promise<ApiKeyResult> {
  try {
    // Use service role client if userId is provided (for internal API calls)
    // Use regular client if no userId (for authenticated requests)
    const supabase = userId ? await createServiceRoleClient() : await createClient()
    
    // Use provided userId or get the current authenticated user
    let targetUserId: string | null = null
    
    if (userId) {
      // Use the provided userId
      targetUserId = userId
      console.log('🔍 Using provided userId for API key lookup:', userId)
    } else {
      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!userError && user) {
        targetUserId = user.id
        console.log('🔍 Using authenticated user for API key lookup:', user.id)
      }
    }
    
    if (targetUserId) {
      // Try to get API key from user settings first
      try {
        console.log('🔍 Looking up user data for ID:', targetUserId)
        
        // First, let's check if the user exists at all
        const { data: allUsers, error: allUsersError } = await supabase
          .from('users')
          .select('id, preferences')
          .limit(10)
        
        console.log('🔍 All users in table:', allUsers?.map(u => ({ id: u.id, hasPrefs: !!u.preferences })))
        console.log('🔍 All users error:', allUsersError)
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', targetUserId)
          .single()
        
        console.log('🔍 User lookup result:', { userData, userError })
        
        if (userError) {
          console.log('❌ User lookup error:', userError)
        }
        
        if (userData?.preferences) {
          const preferences = userData.preferences as any
          if (preferences.openaiApiKey) {
            console.log('✅ Using OpenAI API key from user settings')
            return {
              apiKey: getApiKey(preferences.openaiApiKey),
              source: 'user_settings'
            }
          } else {
            console.log('❌ No openaiApiKey found in user preferences for user:', targetUserId)
            console.log('❌ User data structure:', JSON.stringify(userData, null, 2))
          }
        } else {
          console.log('❌ No preferences found for user:', targetUserId)
          console.log('❌ User data structure:', JSON.stringify(userData, null, 2))
        }
      } catch (error) {
        console.log('Could not load user settings for user:', targetUserId, error)
      }
    } else {
      console.log('❌ No user ID available for API key lookup')
    }
    
    // Fallback to environment variable
    const envApiKey = process.env.OPENAI_API_KEY
    if (envApiKey) {
      console.log('Using OpenAI API key from environment variables')
      return {
        apiKey: envApiKey,
        source: 'environment'
      }
    }
    
    console.log('No OpenAI API key found in user settings or environment')
    return {
      apiKey: null,
      source: 'none'
    }
    
  } catch (error) {
    console.error('Error getting OpenAI API key:', error)
    
    // Fallback to environment only
    const envApiKey = process.env.OPENAI_API_KEY
    if (envApiKey) {
      console.log('Error occurred, falling back to environment API key')
      return {
        apiKey: envApiKey,
        source: 'environment'
      }
    }
    
    return {
      apiKey: null,
      source: 'none'
    }
  }
}
