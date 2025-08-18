'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import type { Project, Chapter, Idea } from '@/types/database'
import { projectsAPI } from '@/lib/api/projects'
import { ideasAPI } from '@/lib/api/ideas'

interface SearchDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface SearchResults {
  projects: Project[]
  chapters: Chapter[]
  ideas: Idea[]
}

export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ projects: [], chapters: [], ideas: [] })
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setResults({ projects: [], chapters: [], ideas: [] })
      setSelectedIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    if (query.trim().length >= 2) {
      performSearch()
    } else {
      setResults({ projects: [], chapters: [], ideas: [] })
    }
  }, [query])

  const performSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    try {
      // Perform parallel searches across all content types
      const [projects, chapters, ideas] = await Promise.all([
        searchProjects(query),
        searchChapters(query),
        searchIdeas(query)
      ])

      setResults({ projects, chapters, ideas })
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchProjects = async (searchQuery: string): Promise<Project[]> => {
    try {
      const allProjects = await projectsAPI.getAll()
      const queryLower = searchQuery.toLowerCase()
      
      return allProjects.filter(project =>
        project.title.toLowerCase().includes(queryLower) ||
        (project.description && project.description.toLowerCase().includes(queryLower))
      ).slice(0, 5)
    } catch (error) {
      console.error('Error searching projects:', error)
      return []
    }
  }

  const searchChapters = async (_searchQuery: string): Promise<Chapter[]> => {
    try {
      // This is a simplified search - in a real app, you'd search across all projects
      // For now, we'll return empty array as we need project context
      return []
    } catch (error) {
      console.error('Error searching chapters:', error)
      return []
    }
  }

  const searchIdeas = async (searchQuery: string): Promise<Idea[]> => {
    try {
      const allIdeas = await ideasAPI.getAll()
      const queryLower = searchQuery.toLowerCase()
      
      return allIdeas.filter(idea =>
        idea.title.toLowerCase().includes(queryLower) ||
        idea.content.toLowerCase().includes(queryLower) ||
        idea.tags.some(tag => tag.toLowerCase().includes(queryLower))
      ).slice(0, 5)
    } catch (error) {
      console.error('Error searching ideas:', error)
      return []
    }
  }

  const getAllResults = () => {
    const allResults = [
      ...results.projects.map(p => ({ type: 'project' as const, item: p })),
      ...results.chapters.map(c => ({ type: 'chapter' as const, item: c })),
      ...results.ideas.map(i => ({ type: 'idea' as const, item: i }))
    ]
    return allResults
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const allResults = getAllResults()
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = allResults[selectedIndex]
      if (selected) {
        handleResultClick(selected.type, selected.item)
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleResultClick = (type: string, item: unknown) => {
    onClose()
    // Navigate to the appropriate page based on type
    const typedItem = item as { id: string }
    if (type === 'project') {
      window.location.href = `/project/${typedItem.id}`
    } else if (type === 'chapter') {
      window.location.href = `/chapters/${typedItem.id}`
    } else if (type === 'idea') {
      // Ideas don't have individual pages, so go to ideas page with a filter
      window.location.href = `/ideas`
    }
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  if (!isOpen) return null

  const allResults = getAllResults()
  const hasResults = allResults.length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[10vh] z-50">
      <div className="bg-background border rounded-lg w-full max-w-2xl mx-4 max-h-[70vh] overflow-hidden shadow-2xl">
        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects, chapters, and ideas..."
              className="pl-10"
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              🔍
            </div>
            {loading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="text-4xl mb-4">🔍</div>
              <p>Type at least 2 characters to search</p>
              <div className="mt-4 text-sm">
                <p>Search across:</p>
                <div className="flex justify-center space-x-4 mt-2">
                  <span>📚 Projects</span>
                  <span>📝 Chapters</span>
                  <span>💡 Ideas</span>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Searching...</p>
            </div>
          ) : !hasResults ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="text-4xl mb-4">🤷‍♂️</div>
              <p>No results found for &quot;{query}&quot;</p>
              <p className="text-sm mt-2">Try different keywords or check your spelling</p>
            </div>
          ) : (
            <div className="py-2">
              {/* Projects */}
              {results.projects.length > 0 && (
                <div className="mb-4">
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted/50">
                    📚 Projects ({results.projects.length})
                  </div>
                  {results.projects.map((project, index) => {
                    const globalIndex = index
                    return (
                      <div
                        key={project.id}
                        className={`px-4 py-3 hover:bg-muted cursor-pointer ${
                          selectedIndex === globalIndex ? 'bg-muted' : ''
                        }`}
                        onClick={() => handleResultClick('project', project)}
                      >
                        <div className="font-medium">
                          {highlightMatch(project.title, query)}
                        </div>
                        {project.description && (
                          <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {highlightMatch(project.description, query)}
                          </div>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                          <span>{project.chapter_count} chapters</span>
                          <span>{(project.word_count || 0).toLocaleString()} words</span>
                          <span>Updated {formatDate(project.updated_at)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Chapters */}
              {results.chapters.length > 0 && (
                <div className="mb-4">
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted/50">
                    📝 Chapters ({results.chapters.length})
                  </div>
                  {results.chapters.map((chapter, index) => {
                    const globalIndex = results.projects.length + index
                    return (
                      <div
                        key={chapter.id}
                        className={`px-4 py-3 hover:bg-muted cursor-pointer ${
                          selectedIndex === globalIndex ? 'bg-muted' : ''
                        }`}
                        onClick={() => handleResultClick('chapter', chapter)}
                      >
                        <div className="font-medium">
                          {highlightMatch(chapter.title, query)}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                          <span>Chapter {chapter.order_index}</span>
                          <span>{(chapter.word_count || 0).toLocaleString()} words</span>
                          <span>Updated {formatDate(chapter.updated_at)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Ideas */}
              {results.ideas.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted/50">
                    💡 Ideas ({results.ideas.length})
                  </div>
                  {results.ideas.map((idea, index) => {
                    const globalIndex = results.projects.length + results.chapters.length + index
                    return (
                      <div
                        key={idea.id}
                        className={`px-4 py-3 hover:bg-muted cursor-pointer ${
                          selectedIndex === globalIndex ? 'bg-muted' : ''
                        }`}
                        onClick={() => handleResultClick('idea', idea)}
                      >
                        <div className="font-medium">
                          {highlightMatch(idea.title, query)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {highlightMatch(idea.content, query)}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                          <span className={`px-2 py-1 rounded-full ${
                            idea.status === 'new' ? 'bg-blue-100 text-blue-800' :
                            idea.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            idea.status === 'used' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {idea.status}
                          </span>
                          {idea.tags.length > 0 && (
                            <span>{idea.tags.slice(0, 2).join(', ')}</span>
                          )}
                          <span>Created {formatDate(idea.created_at)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>Esc Close</span>
            </div>
            {hasResults && (
              <span>{allResults.length} result{allResults.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
