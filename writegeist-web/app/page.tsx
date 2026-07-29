import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen,
  Bot,
  Search,
  Volume2,
  Cloud,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketingHeader } from '@/components/layout/MarketingHeader'
import { createClient } from '@/lib/supabase/server'

const FEATURES: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: BookOpen,
    title: 'Project Management',
    description:
      'Organize your books, novels, and writing projects with chapter management and progress tracking.',
  },
  {
    icon: Bot,
    title: 'AI Writing Assistant',
    description:
      'Ask questions about your characters, plot, and events — answered from your actual chapters.',
  },
  {
    icon: Search,
    title: 'Smart Search',
    description:
      'Vector-powered search through your manuscript, idea management, and story analysis.',
  },
  {
    icon: Volume2,
    title: 'Audio Narration',
    description:
      'Generate high-quality audio narration of your chapters with text-to-speech.',
  },
  {
    icon: Cloud,
    title: 'Cloud Sync',
    description: 'Access your work from anywhere — everything is saved to the cloud as you write.',
  },
  {
    icon: BarChart3,
    title: 'Writing Analytics',
    description: 'Track word counts and progress across projects to stay motivated.',
  },
]

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/project')
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            AI-powered writing studio
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Write your book.
            <br />
            <span className="text-primary">Writegeist handles the rest.</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
            Manage your books, chapters, and creative projects — with an AI assistant that answers
            questions from your own manuscript.
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-4">
            <Button asChild size="lg">
              <Link href="/signup">Start writing free</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>

          <div className="mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mb-8">
              Everything your manuscript needs
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="bg-card border rounded-lg p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/40"
                >
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
