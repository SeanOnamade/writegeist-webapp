import type { DbClient } from './types'
import type { User, UserUpdate } from '@/types/database'

export async function getCurrentUserProfile(db: DbClient): Promise<User | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const { data, error } = await db.from('users').select('*').eq('id', user.id).single()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
  return data
}

export async function updateUserProfile(db: DbClient, updates: UserUpdate): Promise<User | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const { data, error } = await db
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating user profile:', error)
    return null
  }
  return data
}
