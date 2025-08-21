'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Menu, X, ArrowLeft, Clock, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import type { Project, Chapter } from '@/types/database'
import { projectsAPI } from '@/lib/api/projects'
import { chaptersAPI } from '@/lib/api/chapters'

export default function BookReaderPage() {
  const params = useParams()
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id || ''

  const [project, setProject] = useState<Project | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [currentChapterContent, setCurrentChapterContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const [showTOC, setShowTOC] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (projectId && projectId.trim()) {
      loadProjectAndChapters()
    }
  }, [projectId])

  useEffect(() => {
    if (chapters.length > 0) {
      loadChapterContent(currentChapterIndex)
    }
  }, [currentChapterIndex, chapters])

  useEffect(() => {
    // Handle scroll progress
    const handleScroll = () => {
      if (contentRef.current) {
        const element = contentRef.current
        const scrollTop = element.scrollTop
        const scrollHeight = element.scrollHeight - element.clientHeight
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0
        // console.log('Scroll progress:', { scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, progress }) // Debug
        setScrollProgress(Math.min(progress, 100))
      }
    }

    const element = contentRef.current
    if (element) {
      element.addEventListener('scroll', handleScroll)
      
      // Wait for content to render and then calculate
      const timer = setTimeout(() => {
        handleScroll()
      }, 100)
      
      return () => {
        element.removeEventListener('scroll', handleScroll)
        clearTimeout(timer)
      }
    }
  }, [currentChapterContent])

  const loadProjectAndChapters = async () => {
    try {
      setLoading(true)
      const [projectData, chapterList] = await Promise.all([
        projectsAPI.getById(projectId),
        chaptersAPI.getAll(projectId)
      ])

      if (projectData) {
        setProject(projectData)
      } else {
        console.error('Project not found:', projectId)
        return
      }

      // Sort chapters by order_index and filter out any invalid chapters
      const sortedChapters = chapterList
        .filter(chapter => chapter && chapter.id && typeof chapter.order_index === 'number')
        .sort((a, b) => a.order_index - b.order_index)
      
      setChapters(sortedChapters)
      
      // Reset chapter index if it's out of bounds
      if (sortedChapters.length > 0 && currentChapterIndex >= sortedChapters.length) {
        setCurrentChapterIndex(0)
      }
    } catch (error) {
      console.error('Error loading project and chapters:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadChapterContent = async (chapterIndex: number) => {
    if (chapterIndex < 0 || chapterIndex >= chapters.length) {
      console.warn('Invalid chapter index:', chapterIndex)
      return
    }

    try {
      setContentLoading(true)
      const chapter = chapters[chapterIndex]
      
      if (!chapter?.id) {
        console.error('Chapter missing ID:', chapter)
        setCurrentChapterContent('')
        return
      }
      
      // Fetch full chapter content
      const response = await fetch(`/api/chapters/${chapter.id}`)
      if (response.ok) {
        const chapterData = await response.json()
        setCurrentChapterContent(chapterData.content || chapter.content || '')
      } else {
        console.warn('API failed, using fallback content')
        setCurrentChapterContent(chapter.content || '')
      }
      
      // Reset scroll position to top
      if (contentRef.current) {
        contentRef.current.scrollTop = 0
      }
      
      // Also scroll the main window to top for mobile
      window.scrollTo(0, 0)
    } catch (error) {
      console.error('Error loading chapter content:', error)
      setCurrentChapterContent(chapters[chapterIndex]?.content || '')
    } finally {
      setContentLoading(false)
    }
  }

  const goToChapter = (index: number) => {
    if (index >= 0 && index < chapters.length) {
      setCurrentChapterIndex(index)
      setShowTOC(false)
    }
  }

  const estimateReadingTime = (content: string) => {
    if (!content || content.trim().length === 0) return 1 // Minimum 1 minute for empty content
    const words = content.trim().split(/\s+/).filter(word => word.length > 0).length
    const readingSpeed = 250 // words per minute (average)
    const minutes = Math.max(1, Math.ceil(words / readingSpeed)) // Minimum 1 minute
    return minutes
  }

  const currentChapter = chapters[currentChapterIndex]

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your book...</p>
        </div>
      </div>
    )
  }

  if (!project || chapters.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-2xl font-bold mb-4">
            {!project ? 'Book not found' : 'No chapters to read'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {!project 
              ? "The book you're looking for doesn't exist or you don't have access to it."
              : "This project doesn't have any chapters yet. Add some chapters to start reading!"
            }
          </p>
          <Link href="/project">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background sticky top-14 z-10 before:content-[''] before:absolute before:top-[-3.5rem] before:left-0 before:right-0 before:h-14 before:bg-background before:block">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back button and book info */}
            <div className="flex items-center gap-4">
              <Link href={`/project/${projectId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="hidden sm:block">
                <h1 className="font-semibold text-lg">{project.title}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Chapter {currentChapterIndex + 1} of {chapters.length}</span>
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
                        <span>{estimateReadingTime(currentChapterContent)} min read</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Navigation and TOC */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToChapter(currentChapterIndex - 1)}
                disabled={currentChapterIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTOC(true)}
                className="hidden sm:flex"
              >
                <Menu className="h-4 w-4 mr-2" />
                Chapters
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTOC(true)}
                className="sm:hidden"
              >
                <Menu className="h-4 w-4" />
              </Button>

              <Button
                variant="outline" 
                size="sm"
                onClick={() => goToChapter(currentChapterIndex + 1)}
                disabled={currentChapterIndex === chapters.length - 1}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile project info */}
          <div className="sm:hidden mt-3 pt-3 border-t border-border bg-background">
            <h1 className="font-semibold">{project.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>Chapter {currentChapterIndex + 1} of {chapters.length}</span>
              {currentChapter && (
                <>
                  <span>•</span>
                  <span>{estimateReadingTime(currentChapterContent)} min</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex relative min-h-0">
        {/* Vertical Progress Bar */}
        <div className="absolute left-0 top-0 w-1 h-full bg-muted/50 z-30">
          <div 
            className="bg-blue-500 transition-all duration-150 ease-out w-full"
            style={{ height: `${scrollProgress}%` }}
          />
        </div>

        {/* Chapter Content */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-16 py-8 pl-6 md:pl-12 lg:pl-20"
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          <div className="max-w-4xl mx-auto">
            {contentLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading chapter...</p>
                </div>
              </div>
            ) : currentChapter ? (
              <>
                {/* Chapter Header */}
                <div className="mb-8 pb-6 border-b border-border">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
                    {currentChapter.title}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Chapter {currentChapter.order_index}</span>
                    <span>•</span>
                    <span>{(currentChapter.word_count || 0).toLocaleString()} words</span>
                    <span>•</span>
                    <span>{estimateReadingTime(currentChapterContent)} minute read</span>
                  </div>
                </div>

                {/* Chapter Content */}
                <div className="max-w-none">
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      // Enhance paragraph spacing for reading
                      p: ({ children }) => (
                        <p className="mb-6 leading-relaxed text-foreground text-lg md:text-xl">{children}</p>
                      ),
                      // Style headings
                      h1: ({ children }) => (
                        <h1 className="text-2xl md:text-3xl font-bold mb-6 mt-8 text-foreground border-b border-border pb-2">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl md:text-2xl font-semibold mb-4 mt-6 text-foreground">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg md:text-xl font-semibold mb-3 mt-5 text-foreground">{children}</h3>
                      ),
                      // Style emphasis
                      em: ({ children }) => (
                        <em className="italic text-primary font-medium">{children}</em>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-bold text-foreground">{children}</strong>
                      ),
                      // Style underline
                      u: ({ children }) => (
                        <u className="underline text-foreground">{children}</u>
                      ),
                      // Style strikethrough  
                      del: ({ children }) => (
                        <del className="line-through text-muted-foreground">{children}</del>
                      ),
                      s: ({ children }) => (
                        <s className="line-through text-muted-foreground">{children}</s>
                      ),
                      // Style highlight
                      mark: ({ children }) => (
                        <mark className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">{children}</mark>
                      ),
                      // Style blockquotes
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary pl-6 my-6 italic text-muted-foreground bg-muted/30 py-4 rounded-r-lg">
                          {children}
                        </blockquote>
                      ),
                      // Style lists with better spacing
                      ul: ({ children }) => (
                        <ul className="mb-6 pl-6 list-disc text-foreground space-y-2">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-6 pl-6 list-decimal text-foreground space-y-2">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-relaxed">{children}</li>
                      ),
                    }}
                  >
                    {currentChapterContent}
                  </ReactMarkdown>
                </div>

                {/* Chapter Navigation */}
                <div className="mt-12 pt-8 border-t border-border flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => goToChapter(currentChapterIndex - 1)}
                    disabled={currentChapterIndex === 0}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {currentChapterIndex > 0 && chapters[currentChapterIndex - 1] ? (
                      <span className="hidden sm:inline">
                        {chapters[currentChapterIndex - 1].title}
                      </span>
                    ) : (
                      <span className="hidden sm:inline">Previous</span>
                    )}
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    {currentChapterIndex + 1} of {chapters.length}
                  </span>

                  <Button
                    variant="outline"
                    onClick={() => goToChapter(currentChapterIndex + 1)}
                    disabled={currentChapterIndex === chapters.length - 1}
                    className="flex items-center gap-2"
                  >
                    {currentChapterIndex < chapters.length - 1 && chapters[currentChapterIndex + 1] ? (
                      <span className="hidden sm:inline">
                        {chapters[currentChapterIndex + 1].title}
                      </span>
                    ) : (
                      <span className="hidden sm:inline">Next</span>
                    )}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">📖</div>
                <h2 className="text-xl font-semibold mb-2">Chapter not found</h2>
                <p className="text-muted-foreground">Unable to load this chapter.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table of Contents Modal */}
      {showTOC && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            onClick={() => setShowTOC(false)}
          />
          
          {/* TOC Modal */}
          <div className="fixed inset-4 md:inset-20 lg:inset-32 bg-background border border-border rounded-lg z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-semibold">Table of Contents</h2>
                <p className="text-sm text-muted-foreground mt-1">{project.title}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowTOC(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Chapter List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {chapters.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    onClick={() => goToChapter(index)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      index === currentChapterIndex
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium mb-1">{chapter.title}</div>
                        <div className="text-sm text-muted-foreground">
                          Chapter {chapter.order_index} • {(chapter.word_count || 0).toLocaleString()} words
                          {(chapter.word_count || 0) > 0 && (
                            <span> • {Math.max(1, Math.ceil((chapter.word_count || 0) / 250))} min read</span>
                          )}
                        </div>
                      </div>
                      {index === currentChapterIndex && (
                        <div className="text-primary text-sm font-medium ml-2">
                          Current
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
