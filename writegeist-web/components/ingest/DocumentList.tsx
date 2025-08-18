'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { IngestedDocument, Project } from '@/types/database'

interface DocumentListProps {
  documents: IngestedDocument[]
  projects: Project[]
  onDocumentUpdate: (document: IngestedDocument) => void
  onDocumentDelete: (documentId: string) => void
}

export function DocumentList({ documents, projects, onDocumentUpdate, onDocumentDelete }: DocumentListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)

  const getFilteredDocuments = () => {
    let filtered = documents

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(doc =>
        doc.file_name.toLowerCase().includes(query) ||
        (doc.content_text && doc.content_text.toLowerCase().includes(query))
      )
    }

    // Apply project filter
    if (projectFilter !== 'all') {
      if (projectFilter === 'unlinked') {
        filtered = filtered.filter(doc => !doc.project_id)
      } else {
        filtered = filtered.filter(doc => doc.project_id === projectFilter)
      }
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(doc => doc.file_type === typeFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.file_name.localeCompare(b.file_name)
        case 'size':
          return (b.file_size || 0) - (a.file_size || 0)
        case 'date':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return filtered
  }

  const handleDelete = async (document: IngestedDocument) => {
    if (!confirm(`Are you sure you want to delete "${document.file_name}"? This action cannot be undone.`)) {
      return
    }
    onDocumentDelete(document.id)
  }

  const handleProjectChange = async (document: IngestedDocument, newProjectId: string) => {
    const updatedDocument = {
      ...document,
      project_id: newProjectId || null,
      updated_at: new Date().toISOString()
    }
    onDocumentUpdate(updatedDocument)
  }

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    return project?.title || 'Unknown Project'
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf': return '📄'
      case 'docx': return '📝'
      case 'markdown': return '📋'
      case 'text': return '📄'
      case 'rtf': return '📄'
      default: return '📄'
    }
  }

  const getFileTypeColor = (fileType: string) => {
    switch (fileType) {
      case 'pdf': return 'bg-red-100 text-red-800 border-red-200'
      case 'docx': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'markdown': return 'bg-green-100 text-green-800 border-green-200'
      case 'text': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'rtf': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getAllFileTypes = () => {
    const types = [...new Set(documents.map(doc => doc.file_type))]
    return types.sort()
  }

  const filteredDocuments = getFilteredDocuments()
  const allFileTypes = getAllFileTypes()

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="all">All Projects</option>
              <option value="unlinked">Unlinked Documents</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="all">All Types</option>
              {allFileTypes.map(type => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-lg font-medium mb-2">
            {documents.length === 0 ? 'No documents yet' : 'No documents match your filters'}
          </h3>
          <p className="text-muted-foreground">
            {documents.length === 0 
              ? 'Upload documents to build your knowledge base'
              : 'Try adjusting your search or filter criteria'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocuments.map(document => (
            <div key={document.id} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="text-2xl">
                    {getFileTypeIcon(document.file_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold truncate">{document.file_name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getFileTypeColor(document.file_type)}`}>
                        {document.file_type.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                      <span>{formatFileSize(document.file_size || 0)}</span>
                      <span>•</span>
                      <span>Uploaded {formatDate(document.created_at)}</span>
                      {document.project_id && (
                        <>
                          <span>•</span>
                          <span>📚 {getProjectName(document.project_id)}</span>
                        </>
                      )}
                    </div>
                    
                    {expandedDoc === document.id && (
                      <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-medium mb-2">Content Preview</h4>
                        <div className="text-sm text-muted-foreground max-h-40 overflow-y-auto">
                          {document.content_text ? document.content_text.substring(0, 500) : 'No content available'}
                          {document.content_text && document.content_text.length > 500 && '...'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedDoc(expandedDoc === document.id ? null : document.id)}
                  >
                    {expandedDoc === document.id ? '👁️‍🗨️ Hide' : '👁️ Preview'}
                  </Button>
                  
                  <select
                    value={document.project_id || ''}
                    onChange={(e) => handleProjectChange(document, e.target.value)}
                    className="px-2 py-1 text-sm border border-input rounded-md bg-background"
                  >
                    <option value="">No Project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(document)}
                    className="text-destructive hover:text-destructive"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {documents.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{documents.length}</div>
              <div className="text-sm text-muted-foreground">Total Documents</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {formatFileSize(documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total Size</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {documents.filter(doc => doc.project_id).length}
              </div>
              <div className="text-sm text-muted-foreground">Linked to Projects</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {allFileTypes.length}
              </div>
              <div className="text-sm text-muted-foreground">File Types</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
