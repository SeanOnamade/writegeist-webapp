import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Writegeist
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            AI-powered writing assistant for managing your books, chapters, and creative projects.
            Now available as a cloud-native web application with real-time collaboration.
          </p>
          
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild size="lg">
              <Link href="/project">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/chapters">View Chapters</Link>
            </Button>
          </div>
          
          <div className="mt-16">
            <h2 className="text-2xl font-semibold mb-8">Migration Progress</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-green-600">✅ Completed</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Next.js project setup</li>
                  <li>• Development environment</li>
                  <li>• UI component migration</li>
                  <li>• API client stubs</li>
                  <li>• App Router structure</li>
                </ul>
              </div>
              
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-blue-600">🚧 In Progress</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Environment configuration</li>
                  <li>• Supabase setup</li>
                  <li>• Authentication scaffolding</li>
                </ul>
              </div>
              
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-gray-600">⏳ Planned</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Database schema</li>
                  <li>• Chapter management</li>
                  <li>• AI integration</li>
                  <li>• Real-time features</li>
                  <li>• PWA support</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">
              This is the web version of Writegeist, migrated from the Electron desktop app.
              <br />
              All your favorite features will be available with enhanced cloud capabilities.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}