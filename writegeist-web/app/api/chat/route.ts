import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { messages, temperature = 0.7, max_tokens = 500, projectId, userId } = await request.json()
    
    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Get project context if available
    let projectContext = ""
    if (projectId) {
      try {
        const contextResponse = await fetch(`${request.nextUrl.origin}/api/chat/context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: messages[messages.length - 1]?.content || "",
            projectId,
            userId 
          })
        })
        const contextData = await contextResponse.json()
        projectContext = contextData.context || ""
      } catch (error) {
        console.error('Error fetching project context:', error)
      }
    }

    // Enhance system message with project context if available
    const enhancedMessages = [...messages]
    if (projectContext && enhancedMessages.length > 0 && enhancedMessages[0].role === 'system') {
      enhancedMessages[0] = {
        ...enhancedMessages[0],
        content: `${enhancedMessages[0].content}

PROJECT CONTEXT:
${projectContext}

Use this context to provide specific, relevant advice about the user's current project. Reference characters, plot points, and story elements when relevant.`
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: enhancedMessages,
        temperature,
        max_tokens,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      return NextResponse.json(
        { error: 'Failed to get AI response' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content || 'No response generated'

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
