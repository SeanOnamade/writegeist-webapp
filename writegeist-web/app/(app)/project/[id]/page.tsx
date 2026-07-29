import Link from 'next/link'
import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/data/projects'
import { getChaptersByProject } from '@/lib/data/chapters'
import { ProjectDetailClient } from '@/components/projects/ProjectDetailClient'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [project, chapters] = await Promise.all([
    getProject(supabase, id),
    getChaptersByProject(supabase, id),
  ])

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <EmptyState
          icon={FolderOpen}
          title="Project not found"
          description="The project you're looking for doesn't exist or you don't have access to it."
          action={
            <Button asChild>
              <Link href="/project">Back to Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return <ProjectDetailClient initialProject={project} chapters={chapters} />
}
