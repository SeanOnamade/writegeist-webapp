import type { DbClient } from './types'
import type { Idea, IdeaInsert, IdeaUpdate } from '@/types/database'

export async function getIdeas(db: DbClient): Promise<Idea[]> {
  const { data, error } = await db
    .from('ideas')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching ideas:', error)
    return []
  }
  return data ?? []
}

export async function getIdeasByProject(db: DbClient, projectId: string): Promise<Idea[]> {
  const { data, error } = await db
    .from('ideas')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching project ideas:', error)
    return []
  }
  return data ?? []
}

export async function getIdea(db: DbClient, id: string): Promise<Idea | null> {
  const { data, error } = await db.from('ideas').select('*').eq('id', id).single()

  if (error) {
    console.error('Error fetching idea:', error)
    return null
  }
  return data
}

export async function createIdea(
  db: DbClient,
  idea: Omit<IdeaInsert, 'user_id'>
): Promise<Idea | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const { data, error } = await db
    .from('ideas')
    .insert({ ...idea, user_id: user.id })
    .select()
    .single()

  if (error) {
    console.error('Error creating idea:', error)
    return null
  }
  return data
}

export async function updateIdea(
  db: DbClient,
  id: string,
  updates: IdeaUpdate
): Promise<Idea | null> {
  const { data, error } = await db
    .from('ideas')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating idea:', error)
    return null
  }
  return data
}

export async function deleteIdea(db: DbClient, id: string): Promise<boolean> {
  const { error } = await db.from('ideas').delete().eq('id', id)

  if (error) {
    console.error('Error deleting idea:', error)
    return false
  }
  return true
}
