import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/data/projects'
import { ProjectsPageClient } from '@/components/projects/ProjectsPageClient'

export default async function ProjectPage() {
  const supabase = await createClient()
  const projects = await getProjects(supabase)

  return <ProjectsPageClient initialProjects={projects} />
}
