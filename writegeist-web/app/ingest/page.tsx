'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FileUploader } from '@/components/ingest/FileUploader'
import { DocumentList } from '@/components/ingest/DocumentList'
import type { IngestedDocument, Project } from '@/types/database'
import { projectsAPI } from '@/lib/api/projects'

export default function IngestPage() {
  const [documents, setDocuments] = useState<IngestedDocument[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'upload' | 'documents'>('upload')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load projects
      const projectList = await projectsAPI.getAll()
      setProjects(projectList)

      // In a real implementation, you'd load documents from the API
      // For now, we'll start with an empty array
      setDocuments([])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileProcessed = (document: IngestedDocument) => {
    setDocuments(prev => [document, ...prev])
    setActiveTab('documents')
  }

  const handleDocumentUpdate = (updatedDocument: IngestedDocument) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === updatedDocument.id ? updatedDocument : doc
    ))
  }

  const handleDocumentDelete = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId))
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="h-4 bg-muted rounded w-64 mb-8"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Document Ingestion</h1>
          <p className="text-muted-foreground">
            Import and process documents to build your knowledge base
          </p>
        </div>
        
        {projects.length > 0 && (
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Default Project:</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="">No Project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{documents.length}</div>
          <div className="text-sm text-muted-foreground">Total Documents</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">
            {documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0) > 0 
              ? `${Math.round(documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0) / 1024 / 1024 * 100) / 100} MB`
              : '0 MB'
            }
          </div>
          <div className="text-sm text-muted-foreground">Total Size</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">
            {documents.filter(doc => doc.project_id).length}
          </div>
          <div className="text-sm text-muted-foreground">Linked to Projects</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">
            {[...new Set(documents.map(doc => doc.file_type))].length}
          </div>
          <div className="text-sm text-muted-foreground">File Types</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        <Button
          variant={activeTab === 'upload' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('upload')}
          className="rounded-b-none"
        >
          📤 Upload Documents
        </Button>
        <Button
          variant={activeTab === 'documents' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('documents')}
          className="rounded-b-none"
        >
          📄 Document Library ({documents.length})
        </Button>
      </div>

      {/* Tab Content */}
      <div className="bg-card border rounded-lg rounded-tl-none p-6">
        {activeTab === 'upload' ? (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Upload Documents</h2>
              <p className="text-muted-foreground">
                Upload documents to extract text and add to your knowledge base. 
                Supported formats include PDF, Word documents, text files, and more.
              </p>
            </div>
            
            <FileUploader
              onFileProcessed={handleFileProcessed}
              projects={projects}
              selectedProjectId={selectedProjectId}
            />
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Document Library</h2>
              <p className="text-muted-foreground">
                Manage your uploaded documents, link them to projects, and search through your knowledge base.
              </p>
            </div>
            
            <DocumentList
              documents={documents}
              projects={projects}
              onDocumentUpdate={handleDocumentUpdate}
              onDocumentDelete={handleDocumentDelete}
            />
          </div>
        )}
      </div>

      {/* Getting Started */}
      {documents.length === 0 && activeTab === 'documents' && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-lg font-medium mb-2">Build Your Knowledge Base</h3>
          <p className="text-muted-foreground mb-6">
            Upload documents to create a searchable knowledge base for your writing projects
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl mb-2">📤</div>
              <h4 className="font-medium mb-2">Upload Documents</h4>
              <p className="text-sm text-muted-foreground">
                Drag and drop or click to upload PDFs, Word docs, text files, and more
              </p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl mb-2">🔗</div>
              <h4 className="font-medium mb-2">Link to Projects</h4>
              <p className="text-sm text-muted-foreground">
                Organize documents by linking them to specific writing projects
              </p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl mb-2">🔍</div>
              <h4 className="font-medium mb-2">Search & Reference</h4>
              <p className="text-sm text-muted-foreground">
                Find information quickly and reference it in your writing
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setActiveTab('upload')} 
            className="mt-6"
          >
            Start Uploading Documents
          </Button>
        </div>
      )}
    </div>
  )
}