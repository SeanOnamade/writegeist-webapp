'use client'

import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { StatsGrid } from '@/components/ui/stats'
import { EmptyState } from '@/components/ui/empty-state'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog'
import type { Project } from '@/types/database'

type StatusFilter = 'all' | 'draft' | 'active' | 'archived'
type SortBy = 'updated' | 'created' | 'title' | 'words'

export function ProjectsPageClient({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const filteredProjects = useMemo(() => {
    let filtered = projects

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (project) =>
          project.title.toLowerCase().includes(query) ||
          (project.description && project.description.toLowerCase().includes(query))
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((project) => project.status === statusFilter)
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'words':
          return b.word_count - a.word_count
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })
  }, [projects, searchQuery, statusFilter, sortBy])

  const totalWords = projects.reduce((sum, p) => sum + p.word_count, 0)
  const activeProjects = projects.filter((p) => p.status === 'active').length

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <PageHeader
        title="Projects"
        description="Manage your writing projects and track your progress"
        actions={<Button onClick={() => setShowCreateDialog(true)}>Create Project</Button>}
      />

      <StatsGrid
        className="grid-cols-1 md:grid-cols-3 mb-6"
        stats={[
          { label: 'Total Projects', value: projects.length },
          { label: 'Total Words', value: totalWords.toLocaleString() },
          { label: 'Active Projects', value: activeProjects },
        ]}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 w-auto"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-9 w-auto"
          >
            <option value="updated">Last Updated</option>
            <option value="created">Date Created</option>
            <option value="title">Title</option>
            <option value="words">Word Count</option>
          </Select>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
          description={
            projects.length === 0
              ? 'Create your first writing project to get started'
              : 'Try adjusting your search or filter criteria'
          }
          action={
            projects.length === 0 ? (
              <Button onClick={() => setShowCreateDialog(true)}>Create Your First Project</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onUpdate={(updated) =>
                setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
              }
              onDelete={(projectId) =>
                setProjects((prev) => prev.filter((p) => p.id !== projectId))
              }
            />
          ))}
        </div>
      )}

      <CreateProjectDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onProjectCreated={(project) => setProjects((prev) => [project, ...prev])}
      />
    </div>
  )
}
