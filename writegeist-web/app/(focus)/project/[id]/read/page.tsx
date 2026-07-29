import Link from 'next/link'
import { BookOpen, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/data/projects'
import { getChaptersByProject, getChapter } from '@/lib/data/chapters'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { BookReader } from '@/components/reader/BookReader'

export default async function BookReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ chapter?: string }>
}) {
  const { id } = await params
  const { chapter: targetChapterId } = await searchParams

  const supabase = await createClient()
  const [project, chapters] = await Promise.all([
    getProject(supabase, id),
    getChaptersByProject(supabase, id),
  ])

  if (!project || chapters.length === 0) {
    return (
      <div className="min-h-svh flex items-center justify-center p-8">
        <EmptyState
          icon={BookOpen}
          title={!project ? 'Book not found' : 'No chapters to read'}
          description={
            !project
              ? "The book you're looking for doesn't exist or you don't have access to it."
              : "This project doesn't have any chapters yet. Add some chapters to start reading!"
          }
          action={
            <Button asChild>
              <Link href="/project">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  const initialIndex = Math.max(
    0,
    chapters.findIndex((c) => c.id === targetChapterId)
  )
  const initialChapter = await getChapter(supabase, chapters[initialIndex].id)

  return (
    <BookReader
      project={project}
      chapters={chapters}
      initialChapterIndex={initialIndex}
      initialChapterContent={initialChapter?.content || ''}
    />
  )
}
