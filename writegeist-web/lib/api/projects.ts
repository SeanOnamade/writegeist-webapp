// Browser-side adapter over lib/data/projects (uses the singleton client).
// Server components should import lib/data/projects directly with a server client.

import { supabase } from '@/lib/supabase/client'
import * as data from '@/lib/data/projects'
import type { Project, ProjectInsert } from '@/types/database'

export const projectsAPI = {
  getAll(): Promise<Project[]> {
    return data.getProjects(supabase)
  },

  getById(id: string): Promise<Project | null> {
    return data.getProject(supabase, id)
  },

  create(title: string, description?: string): Promise<Project | null> {
    return data.createProject(supabase, {
      title,
      description: description || null,
      status: 'draft',
      metadata: {},
      settings: {},
    })
  },

  save(project: Partial<Project>): Promise<Project | null> {
    if (project.id) {
      return data.updateProject(supabase, project.id, project)
    }
    return data.createProject(supabase, project as Omit<ProjectInsert, 'user_id'>)
  },

  delete(id: string): Promise<boolean> {
    return data.deleteProject(supabase, id)
  },
}
