interface ChatMessage {
  role: string
  content: string
}

const PRONOUN_PATTERN = /\b(he|she|they|their|them|it|that|those|these|him|her)\b/i

function extractCapitalizedNames(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || []
  const skip = new Set(['The', 'In', 'Chapter', 'From', 'What', 'Who', 'How', 'When', 'Where', 'Why'])
  return matches.filter((name) => !skip.has(name.split(' ')[0]))
}

export function buildSearchQuery(messages: ChatMessage[]): string {
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => m.content.trim())
    .filter(Boolean)

  if (userMessages.length === 0) return ''

  const latest = userMessages[userMessages.length - 1]
  const wordCount = latest.split(/\s+/).length
  const needsContext =
    wordCount < 8 || PRONOUN_PATTERN.test(latest) || latest.endsWith('?') && wordCount < 12

  let query = latest

  if (needsContext && userMessages.length > 1) {
    const previous = userMessages[userMessages.length - 2]
    if (!latest.toLowerCase().includes(previous.toLowerCase().slice(0, 20))) {
      query = `${previous} ${latest}`
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  if (lastAssistant?.content) {
    const names = extractCapitalizedNames(lastAssistant.content)
    const queryLower = query.toLowerCase()
    const extraNames = names.filter((name) => !queryLower.includes(name.toLowerCase()))
    if (extraNames.length > 0) {
      query = `${query} ${extraNames.slice(0, 3).join(' ')}`
    }
  }

  return query.trim()
}
