import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiKey } from '@/lib/crypto'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    let apiKey = body.apiKey // Test specific key if provided
    
    // If no specific key provided, get from user settings or environment
    if (!apiKey) {
      apiKey = process.env.OPENAI_API_KEY
      
      // Try to get user-specific API key from settings
      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Get user preferences where settings are actually stored
          const { data: userData } = await supabase
            .from('users')
            .select('preferences')
            .eq('id', user.id)
            .single()
          
          if (userData?.preferences?.openaiApiKey) {
            // Decrypt the stored API key
            apiKey = getApiKey(userData.preferences.openaiApiKey)
            console.log('✅ Using OpenAI API key from user settings (decrypted)')
          } else {
            console.log('No user API key found, using environment API key')
          }
        }
      } catch (userSettingsError) {
        console.log('Error loading user settings, using environment API key:', userSettingsError)
      }
    } else {
      console.log('Testing provided API key directly')
    }

    if (!apiKey || apiKey.trim().length === 0) {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'No OpenAI API key configured. Please add your API key in Settings.' 
        },
        { status: 400 }
      )
    }

    // Basic format validation first (quick)
    // console.log('API key format check:', {
    //   startsWithSk: apiKey.startsWith('sk-'),
    //   length: apiKey.length,
    //   firstChars: apiKey.substring(0, 8),
    //   lastChars: apiKey.substring(apiKey.length - 4)
    // })
    
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      return NextResponse.json(
        { 
          valid: false, 
          error: `Invalid API key format. Expected format: sk-*** (got length: ${apiKey.length})` 
        },
        { status: 400 }
      )
    }

    // Test the API key with a lightweight request
    try {
      const openai = new OpenAI({ apiKey })
      
      // Make a simple models request to test the key
      const models = await openai.models.list()
      
      // Check if we have TTS models available
      const hasTTSModels = models.data.some(model => 
        model.id.includes('tts-1') || model.id.includes('text-to-speech')
      )

      return NextResponse.json({
        valid: true,
        hasTTSModels,
        message: hasTTSModels 
          ? 'API key is valid and TTS models are available'
          : 'API key is valid but TTS models may not be accessible'
      })

    } catch (openaiError: any) {
      console.error('OpenAI API validation error:', openaiError)
      
      let errorMessage = 'Unknown API validation error'
      
      if (openaiError.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI API key.'
      } else if (openaiError.status === 403) {
        errorMessage = 'API key lacks necessary permissions for TTS.'
      } else if (openaiError.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.'
      } else if (openaiError.message) {
        errorMessage = openaiError.message
      }

      return NextResponse.json(
        { 
          valid: false, 
          error: errorMessage 
        },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('API key validation error:', error)
    return NextResponse.json(
      { 
        valid: false, 
        error: 'Failed to validate API key. Please try again.' 
      },
      { status: 500 }
    )
  }
}
