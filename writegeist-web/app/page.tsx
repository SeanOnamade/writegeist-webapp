'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'

function AuthenticatedHome() {
  // Redirect authenticated users to projects
  useEffect(() => {
    window.location.href = '/project'
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to your projects...</p>
      </div>
    </div>
  )
}

function UnauthenticatedHome() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Writegeist
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            AI-powered writing assistant for managing your books, chapters, and creative projects.
            Cloud-native web application with real-time collaboration and intelligent writing tools.
          </p>
          
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild size="lg">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/signup">Create Account</Link>
            </Button>
          </div>
          
          <div className="mt-16">
            <h2 className="text-2xl font-semibold mb-8">Features</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="border rounded-lg p-6">
                <div className="text-3xl mb-4">📚</div>
                <h3 className="font-semibold mb-2">Project Management</h3>
                <p className="text-sm text-muted-foreground">
                  Organize your books, novels, and writing projects with intelligent chapter management and progress tracking.
                </p>
              </div>
              
              <div className="border rounded-lg p-6">
                <div className="text-3xl mb-4">🤖</div>
                <h3 className="font-semibold mb-2">AI Writing Assistant</h3>
                <p className="text-sm text-muted-foreground">
                  Get contextual help with character development, plot consistency, and writing suggestions powered by AI.
                </p>
              </div>
              
              <div className="border rounded-lg p-6">
                <div className="text-3xl mb-4">🎯</div>
                <h3 className="font-semibold mb-2">Smart Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Vector-powered search through your content, idea management, and intelligent story analysis.
                </p>
              </div>
              
              <div className="border rounded-lg p-6">
                <div className="text-3xl mb-4">🔊</div>
                <h3 className="font-semibold mb-2">Audio Narration</h3>
                <p className="text-sm text-muted-foreground">
                  Generate high-quality audio narration of your chapters with text-to-speech technology.
                </p>
              </div>
              
              <div className="border rounded-lg p-6">
                <div className="text-3xl mb-4">☁️</div>
                <h3 className="font-semibold mb-2">Cloud Sync</h3>
                <p className="text-sm text-muted-foreground">
                  Access your work from anywhere with real-time synchronization and collaborative features.
                </p>
              </div>
              
              <div className="border rounded-lg p-6">
                <div className="text-3xl mb-4">📊</div>
                <h3 className="font-semibold mb-2">Writing Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Track your writing progress, word counts, and productivity metrics to stay motivated.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">
              Start your writing journey today. Create an account to access all features.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Home() {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return user ? <AuthenticatedHome /> : <UnauthenticatedHome />
}