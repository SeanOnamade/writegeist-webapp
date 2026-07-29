'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Menu, ArrowLeft, Clock, FileText, Edit } from 'lucide-react'
import { ChapterMarkdown } from '@/components/markdown/ChapterMarkdown'
import { ReaderTOC } from '@/components/reader/ReaderTOC'
import { useScrollProgress } from '@/hooks/useScrollProgress'
import type { Project, Chapter } from '@/types/database'

interface BookReaderProps {
  project: Project
  chapters: Chapter[]
  initialChapterIndex: number
  initialChapterContent: string
}

function estimateReadingTime(content: string) {
  if (!content || content.trim().length === 0) return 1
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 250))
}

export function BookReader({
  project,
  chapters,
  initialChapterIndex,
  initialChapterContent,
}: BookReaderProps) {
  const [currentIndex, setCurrentIndex] = useState(initialChapterIndex)
  const [content, setContent] = useState(initialChapterContent)
  const [contentLoading, setContentLoading] = useState(false)
  const [showTOC, setShowTOC] = useState(false)
  const contentCache = useRef(new Map([[chapters[initialChapterIndex]?.id, initialChapterContent]]))

  const { ref: contentRef, progress: scrollProgress } = useScrollProgress<HTMLDivElement>(content)

  const currentChapter = chapters[currentIndex]

  const goToChapter = useCallback(
    async (index: number) => {
      if (index < 0 || index >= chapters.length) return
      const chapter = chapters[index]
      setCurrentIndex(index)
      setShowTOC(false)

      const cached = contentCache.current.get(chapter.id)
      if (cached !== undefined) {
        setContent(cached)
      } else {
        setContentLoading(true)
        try {
          const response = await fetch(`/api/chapters/${chapter.id}`)
          const data = response.ok ? await response.json() : null
          const text = data?.content || chapter.content || ''
          contentCache.current.set(chapter.id, text)
          setContent(text)
        } catch (error) {
          console.error('Error loading chapter content:', error)
          setContent(chapter.content || '')
        } finally {
          setContentLoading(false)
        }
      }

      contentRef.current?.scrollTo({ top: 0 })
      window.scrollTo(0, 0)
    },
    [chapters, contentRef]
  )

  return (
    <div className="flex flex-col h-svh bg-background">
      {/* Reader header */}
      <div className="border-b border-border bg-background pt-safe">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/project/${project.id}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
              <div className="hidden sm:block min-w-0">
                <h1 className="font-semibold text-lg truncate">{project.title}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    Chapter {currentIndex + 1} of {chapters.length}
                  </span>
                  {currentChapter && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{(currentChapter.word_count || 0).toLocaleString()} words</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{estimateReadingTime(content)} min read</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentChapter && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/chapters/${currentChapter.id}`} className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Link>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToChapter(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <Button variant="outline" size="sm" onClick={() => setShowTOC(true)}>
                <Menu className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Chapters</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToChapter(currentIndex + 1)}
                disabled={currentIndex === chapters.length - 1}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="sm:hidden mt-3 pt-3 border-t border-border">
            <h1 className="font-semibold truncate">{project.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>
                Chapter {currentIndex + 1} of {chapters.length}
              </span>
              {currentChapter && (
                <>
                  <span>•</span>
                  <span>{estimateReadingTime(content)} min</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex relative min-h-0">
        {/* Vertical progress bar */}
        <div className="absolute left-0 top-0 w-1 h-full bg-muted/50 z-30">
          <div
            className="bg-primary transition-all duration-150 ease-out w-full"
            style={{ height: `${scrollProgress}%` }}
          />
        </div>

        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-16 py-8 pl-6 md:pl-12 lg:pl-20"
        >
          <div className="max-w-4xl mx-auto">
            {contentLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading chapter...</p>
                </div>
              </div>
            ) : currentChapter ? (
              <>
                <div className="mb-8 pb-6 border-b border-border">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
                    {currentChapter.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0 text-sm text-muted-foreground">
                    <span>Chapter {currentChapter.order_index}</span>
                    <span>•</span>
                    <span>{(currentChapter.word_count || 0).toLocaleString()} words</span>
                    <span>•</span>
                    <span>{estimateReadingTime(content)} minute read</span>
                  </div>
                </div>

                <div className="max-w-none">
                  <ChapterMarkdown content={content} size="lg" />
                </div>

                <div className="mt-12 pt-8 border-t border-border flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => goToChapter(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {chapters[currentIndex - 1]?.title || 'Previous'}
                    </span>
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} of {chapters.length}
                  </span>

                  <Button
                    variant="outline"
                    onClick={() => goToChapter(currentIndex + 1)}
                    disabled={currentIndex === chapters.length - 1}
                    className="flex items-center gap-2"
                  >
                    <span className="hidden sm:inline">
                      {chapters[currentIndex + 1]?.title || 'Next'}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <ReaderTOC
        open={showTOC}
        onOpenChange={setShowTOC}
        projectTitle={project.title}
        chapters={chapters}
        currentIndex={currentIndex}
        onSelect={goToChapter}
      />
    </div>
  )
}
