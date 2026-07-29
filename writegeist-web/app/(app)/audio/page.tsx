import { createClient } from '@/lib/supabase/server'
import { getAudioLibrary, type AudioLibraryData } from '@/lib/data/audioLibrary'
import { getProjects } from '@/lib/data/projects'
import { AudioLibrary } from '@/components/audio/AudioLibrary'

const EMPTY_LIBRARY: AudioLibraryData = {
  chapters: [],
  stats: {
    total_chapters: 0,
    audio_generated: 0,
    audio_processing: 0,
    audio_pending: 0,
    audio_errors: 0,
    total_duration: 0,
    total_file_size: 0,
  },
}

export default async function AudioPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project: projectParam } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <AudioLibrary
        initialChapters={[]}
        initialStats={EMPTY_LIBRARY.stats}
        projects={[]}
        selectedProjectId={null}
      />
    )
  }

  const projects = await getProjects(supabase)
  const selectedProjectId =
    projectParam && projects.some((p) => p.id === projectParam)
      ? projectParam
      : (projects[0]?.id ?? null)

  const library = selectedProjectId
    ? await getAudioLibrary(supabase, user.id, selectedProjectId)
    : EMPTY_LIBRARY

  return (
    <AudioLibrary
      initialChapters={library.chapters}
      initialStats={library.stats}
      projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      selectedProjectId={selectedProjectId}
    />
  )
}
