import type { DbClient } from './types'
import type { Project, ProjectInsert, ProjectUpdate } from '@/types/database'

export async function getProjects(db: DbClient): Promise<Project[]> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching projects:', error)
    return []
  }
  return data ?? []
}

export async function getProject(db: DbClient, id: string): Promise<Project | null> {
  const { data, error } = await db.from('projects').select('*').eq('id', id).single()

  if (error) {
    console.error('Error fetching project:', error)
    return null
  }
  return data
}

export async function createProject(
  db: DbClient,
  project: Omit<ProjectInsert, 'user_id'>
): Promise<Project | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const { data, error } = await db
    .from('projects')
    .insert({ ...project, user_id: user.id })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    return null
  }
  return data
}

export async function updateProject(
  db: DbClient,
  id: string,
  updates: ProjectUpdate
): Promise<Project | null> {
  const { data, error } = await db
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating project:', error)
    return null
  }
  return data
}

export async function deleteProject(db: DbClient, id: string): Promise<boolean> {
  const { error } = await db.from('projects').delete().eq('id', id)

  if (error) {
    console.error('Error deleting project:', error)
    return false
  }
  return true
}
