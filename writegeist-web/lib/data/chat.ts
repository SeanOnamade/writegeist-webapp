import type { DbClient } from './types'
import type {
  ChatSession,
  ChatSessionInsert,
  ChatMessage,
  ChatMessageInsert,
} from '@/types/database'

export async function getSessions(db: DbClient): Promise<ChatSession[]> {
  const { data, error } = await db
    .from('chat_sessions')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching chat sessions:', error)
    return []
  }
  return data ?? []
}

export async function createSession(
  db: DbClient,
  session: Omit<ChatSessionInsert, 'user_id'>
): Promise<ChatSession | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const { data, error } = await db
    .from('chat_sessions')
    .insert({ ...session, user_id: user.id })
    .select()
    .single()

  if (error) {
    console.error('Error creating chat session:', error)
    return null
  }
  return data
}

export async function getMessages(db: DbClient, sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching chat messages:', error)
    return []
  }
  return data ?? []
}

export async function addMessage(
  db: DbClient,
  message: Omit<ChatMessageInsert, 'user_id'>
): Promise<ChatMessage | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const { data, error } = await db
    .from('chat_messages')
    .insert({ ...message, user_id: user.id })
    .select()
    .single()

  if (error) {
    console.error('Error adding chat message:', error)
    return null
  }
  return data
}

export async function updateSession(
  db: DbClient,
  id: string,
  updates: { title?: string; project_id?: string | null }
): Promise<ChatSession | null> {
  const { data, error } = await db
    .from('chat_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating chat session:', error)
    return null
  }
  return data
}

export async function deleteSession(db: DbClient, id: string): Promise<boolean> {
  const { error: messagesError } = await db
    .from('chat_messages')
    .delete()
    .eq('session_id', id)

  if (messagesError) {
    console.error('Error deleting chat messages:', messagesError)
    return false
  }

  const { error } = await db.from('chat_sessions').delete().eq('id', id)

  if (error) {
    console.error('Error deleting chat session:', error)
    return false
  }
  return true
}

/**
 * Find untitled ("New Chat") sessions with no messages, in a single query
 * using an embedded count instead of one query per session.
 */
async function findEmptySessionIds(db: DbClient): Promise<string[]> {
  const { data, error } = await db
    .from('chat_sessions')
    .select('id, chat_messages(count)')
    .eq('title', 'New Chat')

  if (error || !data) {
    if (error) console.error('Error finding empty sessions:', error)
    return []
  }

  return (data as Array<{ id: string; chat_messages: { count: number }[] }>)
    .filter((session) => (session.chat_messages[0]?.count ?? 0) === 0)
    .map((session) => session.id)
}

export async function countEmptySessions(db: DbClient): Promise<number> {
  const ids = await findEmptySessionIds(db)
  return ids.length
}

export async function deleteEmptySessions(db: DbClient): Promise<number> {
  const ids = await findEmptySessionIds(db)
  if (ids.length === 0) return 0

  const { error } = await db.from('chat_sessions').delete().in('id', ids)

  if (error) {
    console.error('Error deleting empty sessions:', error)
    return 0
  }
  return ids.length
}
