'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Lightbulb, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Idea } from '@/types/database'
import { ideasAPI } from '@/lib/api/ideas'
import { useIdeaFilters, type IdeaSortBy, type IdeaStatusFilter } from '@/hooks/useIdeaFilters'

interface IdeasSearchModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export function IdeasSearchModal({ isOpen, onClose, projectId }: IdeasSearchModalProps) {
  const router = useRouter()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(false)
  const [scopeFilter, setScopeFilter] = useState<'project' | 'all'>('project')
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)

  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    filteredIdeas,
  } = useIdeaFilters(ideas)

  const loadIdeas = useCallback(async () => {
    setLoading(true)
    try {
      const ideaList =
        scopeFilter === 'project' ? await ideasAPI.getByProject(projectId) : await ideasAPI.getAll()
      setIdeas(ideaList)
    } catch (error) {
      console.error('Error loading ideas:', error)
    } finally {
      setLoading(false)
    }
  }, [scopeFilter, projectId])

  useEffect(() => {
    if (isOpen) {
      loadIdeas()
      setSearchQuery('')
      setSelectedIdeaId(null)
    }
  }, [isOpen, loadIdeas, setSearchQuery])

  const handleStatusUpdate = async (
    ideaId: string,
    newStatus: 'new' | 'in_progress' | 'used' | 'archived'
  ) => {
    try {
      const updatedIdea = await ideasAPI.updateStatus(ideaId, newStatus)
      if (updatedIdea) {
        setIdeas((prev) => prev.map((idea) => (idea.id === ideaId ? updatedIdea : idea)))
      }
    } catch (error) {
      console.error('Error updating idea status:', error)
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const selectedIdea = filteredIdeas.find((idea) => idea.id === selectedIdeaId)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Side drawer */}
      <div className="w-full max-w-4xl bg-background border-l shadow-xl flex flex-col max-h-full md:w-3/4 lg:w-2/3 xl:max-w-4xl">
        <div className="border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-lg font-semibold">Browse Ideas</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Scope:</span>
                <Select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value as 'project' | 'all')}
                  className="h-8 w-auto text-sm"
                >
                  <option value="project">This Project</option>
                  <option value="all">All Ideas</option>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push('/ideas')}>
                <span className="hidden sm:inline">Manage All Ideas</span>
                <span className="sm:hidden">Manage</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="h-9 w-9 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="border-b">
          <div className="flex flex-col sm:flex-row gap-3 p-4">
            <Input
              placeholder="Search ideas by title, content, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as IdeaStatusFilter)}
                className="w-auto flex-1 sm:flex-initial"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="used">Used</option>
                <option value="archived">Archived</option>
              </Select>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as IdeaSortBy)}
                className="w-auto flex-1 sm:flex-initial"
              >
                <option value="updated">Recently Updated</option>
                <option value="created">Recently Created</option>
                <option value="title">Title A-Z</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Ideas list */}
          <div className="flex-1 min-h-0 w-full md:w-1/2 md:border-r flex flex-col">
            <div className="p-3 md:p-4 flex-1 min-h-0 flex flex-col">
              <div className="text-sm text-muted-foreground mb-3">
                {loading ? 'Loading...' : `${filteredIdeas.length} ideas found`}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filteredIdeas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchQuery ? 'No ideas match your search' : 'No ideas found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
                  {filteredIdeas.map((idea) => (
                    <div
                      key={idea.id}
                      onClick={() => setSelectedIdeaId(idea.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedIdeaId === idea.id
                          ? 'bg-primary/10 border-primary/20'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-medium text-sm truncate flex-1">{idea.title}</h3>
                        <StatusBadge status={idea.status} />
                      </div>

                      {idea.content && idea.content !== '--' && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {idea.content}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex gap-1">
                          {idea.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="bg-muted px-1 rounded">
                              {tag}
                            </span>
                          ))}
                          {idea.tags.length > 2 && (
                            <span className="text-muted-foreground">+{idea.tags.length - 2}</span>
                          )}
                        </div>
                        <span>{formatDate(idea.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Idea detail */}
          <div className="flex-1 min-h-0 w-full md:w-1/2 flex flex-col border-t md:border-t-0">
            {selectedIdea ? (
              <div className="p-3 md:p-4 flex flex-col h-full">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base md:text-lg mb-2 break-words">
                      {selectedIdea.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <StatusBadge status={selectedIdea.status} />
                      <span className="text-xs md:text-sm text-muted-foreground">
                        Updated {formatDate(selectedIdea.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 min-h-[100px]">
                  {selectedIdea.content && selectedIdea.content !== '--' ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
                      {selectedIdea.content}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      No description provided
                    </div>
                  )}
                </div>

                {selectedIdea.tags.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-medium mb-2">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedIdea.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="text-sm font-medium mb-2">Quick Actions</div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate(selectedIdea.id, 'used')}
                      disabled={selectedIdea.status === 'used'}
                      className="w-full sm:w-auto"
                    >
                      Mark as Used
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate(selectedIdea.id, 'archived')}
                      disabled={selectedIdea.status === 'archived'}
                      className="w-full sm:w-auto"
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
                <div className="text-center">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select an idea to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
