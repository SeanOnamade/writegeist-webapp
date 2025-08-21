import { createClient } from '@/lib/supabase/server'
import { getApiKey } from '@/lib/crypto'

interface ApiKeyResult {
  apiKey: string | null
  source: 'user_settings' | 'environment' | 'none'
}

/**
 * Get OpenAI API key with consistent priority:
 * 1. User Settings (from database)
 * 2. Environment Variable
 * 3. None available
 */
export async function getOpenAIApiKey(): Promise<ApiKeyResult> {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (!userError && user) {
      // Try to get API key from user settings first
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', user.id)
          .single()
        
        if (userData?.preferences?.openaiApiKey) {
          console.log('✅ Using OpenAI API key from user settings')
          return {
            apiKey: getApiKey(userData.preferences.openaiApiKey),
            source: 'user_settings'
          }
        }
      } catch (error) {
        console.log('Could not load user settings, checking environment')
      }
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
