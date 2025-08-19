'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Idea } from '@/types/database'
import { ideasAPI } from '@/lib/api/ideas'

interface IdeasSearchModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export function IdeasSearchModal({ isOpen, onClose, projectId }: IdeasSearchModalProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [filteredIdeas, setFilteredIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(false)
  const [scopeFilter, setScopeFilter] = useState<'project' | 'all'>('project')
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated')
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'used' | 'archived'>('all')

  // Load ideas when modal opens
  useEffect(() => {
    if (isOpen) {
      loadIdeas()
      setSearchQuery('')
      setSelectedIdeaId(null)
    }
  }, [isOpen, scopeFilter])

  // Filter and sort ideas when any parameter changes
  useEffect(() => {
    filterIdeas()
  }, [ideas, searchQuery, sortBy, statusFilter])

  // Force immediate re-filtering when sort or status filter changes
  const handleSortChange = (newSortBy: typeof sortBy) => {
    setSortBy(newSortBy)
    // Force immediate filtering with new sort value
    performFilteringWithParams(searchQuery, statusFilter, newSortBy)
  }

  const handleStatusFilterChange = (newStatusFilter: typeof statusFilter) => {
    setStatusFilter(newStatusFilter)
    // Force immediate filtering with new status filter
    performFilteringWithParams(searchQuery, newStatusFilter, sortBy)
  }

  const performFilteringWithParams = (query: string, status: typeof statusFilter, sort: typeof sortBy) => {
    let filtered = ideas

    // Apply search filter
    if (query.trim()) {
      const queryLower = query.toLowerCase()
      filtered = filtered.filter(idea =>
        idea.title.toLowerCase().includes(queryLower) ||
        idea.content.toLowerCase().includes(queryLower) ||
        idea.tags.some(tag => tag.toLowerCase().includes(queryLower))
      )
    }

    // Apply status filter
    if (status !== 'all') {
      filtered = filtered.filter(idea => idea.status === status)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sort) {
        case 'title':
          const titleA = a.title.toLowerCase().trim()
          const titleB = b.title.toLowerCase().trim()
          return titleA.localeCompare(titleB)
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })

    setFilteredIdeas(filtered)
  }

  const loadIdeas = async () => {
    setLoading(true)
    try {
      const ideaList = scopeFilter === 'project' 
        ? await ideasAPI.getByProject(projectId)
        : await ideasAPI.getAll()
      setIdeas(ideaList)
    } catch (error) {
      console.error('Error loading ideas:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterIdeas = () => {
    performFilteringWithParams(searchQuery, statusFilter, sortBy)
  }

  const handleStatusUpdate = async (ideaId: string, newStatus: 'new' | 'in_progress' | 'used' | 'archived') => {
    try {
      const updatedIdea = await ideasAPI.updateStatus(ideaId, newStatus)
      if (updatedIdea) {
        setIdeas(prev => prev.map(idea => 
          idea.id === ideaId ? updatedIdea : idea
        ))
      }
    } catch (error) {
      console.error('Error updating idea status:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'used': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const selectedIdea = filteredIdeas.find(idea => idea.id === selectedIdeaId)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="flex-1 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="w-full max-w-4xl bg-background border-l shadow-xl flex flex-col max-h-full md:w-3/4 lg:w-2/3 xl:max-w-4xl">
        {/* Header */}
        <div className="border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-lg font-semibold">Browse Ideas</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Scope:</span>
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value as 'project' | 'all')}
                  className="px-2 py-1 text-sm border border-input rounded bg-background cursor-pointer"
                >
                  <option value="project">This Project</option>
                  <option value="all">All Ideas</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/ideas')}
                className="hidden sm:inline-flex"
              >
                Manage All Ideas
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/ideas')}
                className="sm:hidden"
              >
                Manage
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="border-b">
          <div className="flex flex-col sm:flex-row gap-3 p-4">
            <Input
              placeholder="Search ideas by title, content, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value as typeof statusFilter)}
                className="px-3 py-2 text-sm border border-input rounded bg-background cursor-pointer flex-1 sm:flex-initial"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="used">Used</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as typeof sortBy)}
                className="px-3 py-2 text-sm border border-input rounded bg-background cursor-pointer flex-1 sm:flex-initial"
              >
                <option value="updated">Recently Updated</option>
                <option value="created">Recently Created</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Ideas List */}
          <div className="w-full md:w-1/2 md:border-r">
            <div className="p-3 md:p-4">
              <div className="text-sm text-muted-foreground mb-3">
                {loading ? 'Loading...' : `${filteredIdeas.length} ideas found`}
              </div>
              
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : filteredIdeas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="text-4xl mb-2">💡</div>
                  <p className="text-sm">{searchQuery ? 'No ideas match your search' : 'No ideas found'}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] md:max-h-[500px] overflow-y-auto">
                  {filteredIdeas.map(idea => (
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
                        <h3 className="font-medium text-sm truncate flex-1">
                          {idea.title}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getStatusColor(idea.status)}`}
                        >
                          {idea.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      {idea.content && idea.content !== '--' && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {idea.content}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex gap-1">
                          {idea.tags.slice(0, 2).map(tag => (
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

          {/* Idea Detail */}
          <div className="w-full md:w-1/2 flex flex-col border-t md:border-t-0">
            {selectedIdea ? (
              <div className="p-3 md:p-4 flex flex-col h-full">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base md:text-lg mb-2 break-words">{selectedIdea.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant="outline" className={getStatusColor(selectedIdea.status)}>
                        {selectedIdea.status.replace('_', ' ')}
                      </Badge>
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
                      {selectedIdea.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
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
                  <div className="text-4xl mb-2">💡</div>
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
