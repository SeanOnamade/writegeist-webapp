'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IdeaCard } from '@/components/ideas/IdeaCard'
import { CreateIdeaDialog } from '@/components/ideas/CreateIdeaDialog'
import type { Idea, Project } from '@/types/database'
import { ideasAPI } from '@/lib/api/ideas'
import { projectsAPI } from '@/lib/api/projects'

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredIdeas, setFilteredIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'used' | 'archived'>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterAndSortIdeas()
  }, [ideas, searchQuery, statusFilter, projectFilter, tagFilter, sortBy])

  const loadData = async () => {
    try {
      const [ideaList, projectList] = await Promise.all([
        ideasAPI.getAll(),
        projectsAPI.getAll()
      ])
      setIdeas(ideaList)
      setProjects(projectList)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortIdeas = () => {
    let filtered = ideas

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(idea =>
        idea.title.toLowerCase().includes(query) ||
        idea.content.toLowerCase().includes(query) ||
        idea.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(idea => idea.status === statusFilter)
    }

    // Apply project filter
    if (projectFilter !== 'all') {
      if (projectFilter === 'unlinked') {
        filtered = filtered.filter(idea => !idea.project_id)
      } else {
        filtered = filtered.filter(idea => idea.project_id === projectFilter)
      }
    }

    // Apply tag filter
    if (tagFilter !== 'all') {
      filtered = filtered.filter(idea => idea.tags.includes(tagFilter))
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })

    setFilteredIdeas(filtered)
  }

  const handleIdeaCreated = (idea: Idea) => {
    setIdeas(prev => [idea, ...prev])
  }

  const handleIdeaUpdated = (updatedIdea: Idea) => {
    setIdeas(prev => prev.map(i => i.id === updatedIdea.id ? updatedIdea : i))
  }

  const handleIdeaDeleted = (ideaId: string) => {
    setIdeas(prev => prev.filter(i => i.id !== ideaId))
  }

  const getAllTags = () => {
    const allTags = ideas.flatMap(idea => idea.tags)
    return [...new Set(allTags)].sort()
  }

  const getIdeaStats = () => {
    const statusCounts = {
      new: ideas.filter(i => i.status === 'new').length,
      in_progress: ideas.filter(i => i.status === 'in_progress').length,
      used: ideas.filter(i => i.status === 'used').length,
      archived: ideas.filter(i => i.status === 'archived').length
    }
    const linkedIdeas = ideas.filter(i => i.project_id).length
    const totalTags = getAllTags().length

    return { statusCounts, linkedIdeas, totalTags }
  }

  const stats = getIdeaStats()
  const allTags = getAllTags()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-8 bg-muted animate-pulse rounded w-32 mb-2"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-64"></div>
          </div>
          <div className="h-10 bg-muted animate-pulse rounded w-32"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-card border rounded-lg p-4">
              <div className="h-6 bg-muted animate-pulse rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-full mb-2"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Ideas</h1>
          <p className="text-muted-foreground">
            Capture and organize your creative inspiration
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          💡 New Idea
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{ideas.length}</div>
          <div className="text-sm text-muted-foreground">Total Ideas</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.statusCounts.new}</div>
          <div className="text-sm text-muted-foreground">New</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.statusCounts.in_progress}</div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{stats.statusCounts.used}</div>
          <div className="text-sm text-muted-foreground">Used</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{stats.linkedIdeas}</div>
          <div className="text-sm text-muted-foreground">Linked to Projects</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Input
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full h-9 px-3 py-1 text-sm border border-input rounded-md bg-background cursor-pointer hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="used">Used</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full h-9 px-3 py-1 text-sm border border-input rounded-md bg-background cursor-pointer hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
            >
              <option value="all">All Projects</option>
              <option value="unlinked">Unlinked Ideas</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="w-full h-9 px-3 py-1 text-sm border border-input rounded-md bg-background cursor-pointer hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
            >
              <option value="all">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full h-9 px-3 py-1 text-sm border border-input rounded-md bg-background cursor-pointer hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Date Created</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ideas Grid */}
      {filteredIdeas.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">💡</div>
          <h3 className="text-lg font-medium mb-2">
            {ideas.length === 0 ? 'No ideas yet' : 'No ideas match your filters'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {ideas.length === 0 
              ? 'Start capturing your creative ideas and inspiration'
              : 'Try adjusting your search or filter criteria'
            }
          </p>
          {ideas.length === 0 && (
            <Button onClick={() => setShowCreateDialog(true)}>
              💡 Create Your First Idea
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIdeas.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onUpdate={handleIdeaUpdated}
              onDelete={handleIdeaDeleted}
            />
          ))}
        </div>
      )}

      {/* Create Idea Dialog */}
      <CreateIdeaDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onIdeaCreated={handleIdeaCreated}
        projects={projects}
      />
    </div>
  )
}