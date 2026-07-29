'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { StatsGrid } from '@/components/ui/stats'
import { EmptyState } from '@/components/ui/empty-state'
import { IdeaCard } from '@/components/ideas/IdeaCard'
import { CreateIdeaDialog } from '@/components/ideas/CreateIdeaDialog'
import { IdeaDetailModal } from '@/components/ideas/IdeaDetailModal'
import { useIdeaFilters, type IdeaSortBy, type IdeaStatusFilter } from '@/hooks/useIdeaFilters'
import type { Idea, Project } from '@/types/database'

export function IdeasPageClient({
  initialIdeas,
  projects,
}: {
  initialIdeas: Idea[]
  projects: Project[]
}) {
  const router = useRouter()
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Re-sync whenever the server page refetches.
  useEffect(() => {
    setIdeas(initialIdeas)
  }, [initialIdeas])

  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    projectFilter,
    setProjectFilter,
    tagFilter,
    setTagFilter,
    sortBy,
    setSortBy,
    filteredIdeas,
    allTags,
  } = useIdeaFilters(ideas)

  const statusCounts = {
    new: ideas.filter((i) => i.status === 'new').length,
    in_progress: ideas.filter((i) => i.status === 'in_progress').length,
    used: ideas.filter((i) => i.status === 'used').length,
  }
  const linkedIdeas = ideas.filter((i) => i.project_id).length

  const handleIdeaCreated = (idea: Idea) => {
    setIdeas((prev) => [idea, ...prev])
    router.refresh()
  }

  const handleIdeaUpdated = (updatedIdea: Idea) => {
    setIdeas((prev) => prev.map((i) => (i.id === updatedIdea.id ? updatedIdea : i)))
    if (selectedIdea?.id === updatedIdea.id) {
      setSelectedIdea(updatedIdea)
    }
    router.refresh()
  }

  const handleIdeaDeleted = (ideaId: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId))
    if (selectedIdea?.id === ideaId) {
      setSelectedIdea(null)
      setShowDetailModal(false)
    }
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <PageHeader
        title="Ideas"
        description="Capture and organize your creative inspiration"
        actions={
          <Button onClick={() => setShowCreateDialog(true)}>
            <Lightbulb className="h-4 w-4 mr-2" />
            New Idea
          </Button>
        }
      />

      <StatsGrid
        className="grid-cols-2 md:grid-cols-5 mb-6"
        stats={[
          { label: 'Total Ideas', value: ideas.length },
          { label: 'New', value: statusCounts.new },
          { label: 'In Progress', value: statusCounts.in_progress },
          { label: 'Used', value: statusCounts.used },
          { label: 'Linked to Projects', value: linkedIdeas },
        ]}
      />

      <div className="bg-card border rounded-lg p-3 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <Input
            placeholder="Search ideas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IdeaStatusFilter)}
            className="h-9"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="used">Used</option>
            <option value="archived">Archived</option>
          </Select>
          <Select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9"
          >
            <option value="all">All Projects</option>
            <option value="unlinked">Unlinked Ideas</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </Select>
          <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="h-9">
            <option value="all">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </Select>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as IdeaSortBy)}
            className="h-9"
          >
            <option value="updated">Last Updated</option>
            <option value="created">Date Created</option>
            <option value="title">Title</option>
          </Select>
        </div>
      </div>

      {filteredIdeas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={ideas.length === 0 ? 'No ideas yet' : 'No ideas match your filters'}
          description={
            ideas.length === 0
              ? 'Start capturing your creative ideas and inspiration'
              : 'Try adjusting your search or filter criteria'
          }
          action={
            ideas.length === 0 ? (
              <Button onClick={() => setShowCreateDialog(true)}>Create Your First Idea</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onUpdate={handleIdeaUpdated}
              onDelete={handleIdeaDeleted}
              onView={(idea) => {
                setSelectedIdea(idea)
                setShowDetailModal(true)
              }}
            />
          ))}
        </div>
      )}

      <CreateIdeaDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onIdeaCreated={handleIdeaCreated}
        projects={projects}
      />

      <IdeaDetailModal
        idea={selectedIdea}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedIdea(null)
        }}
        onUpdate={handleIdeaUpdated}
      />
    </div>
  )
}
