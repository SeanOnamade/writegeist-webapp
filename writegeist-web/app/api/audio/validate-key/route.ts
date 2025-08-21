import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment or request
    let apiKey = process.env.OPENAI_API_KEY

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
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Invalid API key format. OpenAI keys should start with "sk-".' 
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
