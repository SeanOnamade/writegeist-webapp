import { createClient } from '@/lib/supabase/server'
import { getIdeas } from '@/lib/data/ideas'
import { getProjects } from '@/lib/data/projects'
import { IdeasPageClient } from '@/components/ideas/IdeasPageClient'

export default async function IdeasPage() {
  const supabase = await createClient()
  const [ideas, projects] = await Promise.all([getIdeas(supabase), getProjects(supabase)])

  return <IdeasPageClient initialIdeas={ideas} projects={projects} />
}
