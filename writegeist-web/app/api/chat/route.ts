import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIApiKey } from '@/lib/api/openai-key'
import { buildProjectContext } from '@/lib/chat/buildProjectContext'
import { buildManuscriptSystemPrompt, buildContextInjection } from '@/lib/chat/prompts'

export async function POST(request: NextRequest) {
  try {
    const { messages, temperature = 0.3, max_tokens = 1000, projectId, userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const { apiKey } = await getOpenAIApiKey(userId)

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add it in Settings.' },
        { status: 500 }
      )
    }

    const userQuery = messages[messages.length - 1]?.content || ''
    let projectContext = ''
    let citations: Array<{ chapterId: string | null; chapterTitle: string; similarity: number; excerpt: string }> = []
    let indexed = false
    let hasContent = false
    let projectTitle = 'your project'

    if (projectId) {
      const contextResult = await buildProjectContext(userQuery, projectId, userId)
      projectContext = contextResult.context
      citations = contextResult.citations
      indexed = contextResult.indexed
      hasContent = contextResult.hasContent
      projectTitle = contextResult.projectTitle
    }

    const systemContent = projectContext
      ? `${buildManuscriptSystemPrompt(projectTitle)}

PROJECT CONTEXT:
${buildContextInjection(projectContext)}`
      : buildManuscriptSystemPrompt(projectTitle)

    const enhancedMessages = [...messages]
    if (enhancedMessages.length > 0 && enhancedMessages[0].role === 'system') {
      enhancedMessages[0] = { ...enhancedMessages[0], content: systemContent }
    } else {
      enhancedMessages.unshift({ role: 'system', content: systemContent })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: enhancedMessages,
        temperature,
        max_tokens,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      return NextResponse.json({ error: 'Failed to get AI response' }, { status: response.status })
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content || 'No response generated'

    return NextResponse.json({
      message,
      citations,
      indexed,
      hasContent,
      projectTitle,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
