import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/data/projects'
import { getChaptersByProject } from '@/lib/data/chapters'
import { ChaptersPageClient } from '@/components/chapters/ChaptersPageClient'

export default async function ChaptersPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project: projectId } = await searchParams

  if (!projectId) {
    return (
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <EmptyState
          icon={BookOpen}
          title="Select a Project"
          description="Choose a project to view and manage its chapters"
          action={
            <Button asChild>
              <Link href="/project">View Projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const supabase = await createClient()
  const [project, chapters] = await Promise.all([
    getProject(supabase, projectId),
    getChaptersByProject(supabase, projectId),
  ])

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <EmptyState
          icon={BookOpen}
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

  return <ChaptersPageClient project={project} initialChapters={chapters} />
}
