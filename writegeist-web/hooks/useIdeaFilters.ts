'use client'

import { useMemo, useState } from 'react'
import type { Idea } from '@/types/database'

export type IdeaStatusFilter = 'all' | 'new' | 'in_progress' | 'used' | 'archived'
export type IdeaSortBy = 'updated' | 'created' | 'title'

interface FilterParams {
  query: string
  status: IdeaStatusFilter
  /** 'all', 'unlinked', or a project id. */
  projectFilter: string
  /** 'all' or a tag. */
  tagFilter: string
  sortBy: IdeaSortBy
}

/**
 * Pure filtering + sorting over an ideas list. Shared by the Ideas page and
 * the project IdeasSearchModal (previously duplicated in both).
 */
export function filterAndSortIdeas(ideas: Idea[], params: FilterParams): Idea[] {
  const { query, status, projectFilter, tagFilter, sortBy } = params
  let filtered = ideas

  if (query.trim()) {
    const queryLower = query.toLowerCase()
    filtered = filtered.filter(
      (idea) =>
        idea.title.toLowerCase().includes(queryLower) ||
        idea.content.toLowerCase().includes(queryLower) ||
        idea.tags.some((tag) => tag.toLowerCase().includes(queryLower))
    )
  }

  if (status !== 'all') {
    filtered = filtered.filter((idea) => idea.status === status)
  }

  if (projectFilter !== 'all') {
    filtered =
      projectFilter === 'unlinked'
        ? filtered.filter((idea) => !idea.project_id)
        : filtered.filter((idea) => idea.project_id === projectFilter)
  }

  if (tagFilter !== 'all') {
    filtered = filtered.filter((idea) => idea.tags.includes(tagFilter))
  }

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.toLowerCase().trim().localeCompare(b.title.toLowerCase().trim())
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'updated':
      default:
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    }
  })
}

/**
 * Filter state + derived filtered list. Because the result is derived with
 * useMemo there is no "stale filter" problem and no need for the manual
 * re-filter handlers the old implementations carried around.
 */
export function useIdeaFilters(ideas: Idea[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<IdeaStatusFilter>('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [sortBy, setSortBy] = useState<IdeaSortBy>('updated')

  const filteredIdeas = useMemo(
    () =>
      filterAndSortIdeas(ideas, {
        query: searchQuery,
        status: statusFilter,
        projectFilter,
        tagFilter,
        sortBy,
      }),
    [ideas, searchQuery, statusFilter, projectFilter, tagFilter, sortBy]
  )

  const allTags = useMemo(
    () => [...new Set(ideas.flatMap((idea) => idea.tags))].sort(),
    [ideas]
  )

  return {
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
  }
}
