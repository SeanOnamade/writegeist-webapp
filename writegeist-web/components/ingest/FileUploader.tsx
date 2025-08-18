'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { IngestedDocument, Project } from '@/types/database'

interface FileUploaderProps {
  onFileProcessed: (document: IngestedDocument) => void
  projects: Project[]
  selectedProjectId?: string
}

interface UploadProgress {
  fileName: string
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
}

export function FileUploader({ onFileProcessed, projects: _projects, selectedProjectId }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supportedFormats = [
    { ext: '.txt', type: 'text/plain', name: 'Text Files' },
    { ext: '.md', type: 'text/markdown', name: 'Markdown Files' },
    { ext: '.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'Word Documents' },
    { ext: '.pdf', type: 'application/pdf', name: 'PDF Documents' },
    { ext: '.rtf', type: 'application/rtf', name: 'Rich Text Format' }
  ]

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files))
    }
  }

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      if (!isFileSupported(file)) {
        alert(`File type not supported: ${file.name}`)
        continue
      }

      const uploadId = `${file.name}-${Date.now()}`
      const uploadProgress: UploadProgress = {
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      }

      setUploads(prev => [...prev, uploadProgress])

      try {
        await processFile(file, uploadId)
      } catch (error) {
        setUploads(prev => prev.map(u => 
          u.fileName === file.name ? { 
            ...u, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          } : u
        ))
      }
    }
  }

  const isFileSupported = (file: File): boolean => {
    return supportedFormats.some(format => 
      file.type === format.type || file.name.toLowerCase().endsWith(format.ext)
    )
  }

  const processFile = async (file: File, _uploadId: string) => {
    // Update progress to processing
    setUploads(prev => prev.map(u => 
      u.fileName === file.name ? { ...u, status: 'processing', progress: 50 } : u
    ))

    // Simulate file processing (in real implementation, this would call an API)
    const content = await extractTextFromFile(file)
    
    // Create document record
    const document: IngestedDocument = {
      id: `doc-${Date.now()}`,
      file_name: file.name,
      file_path: `/uploads/${file.name}`, // Placeholder path
      content_text: content,
      file_type: getFileType(file),
      file_size: file.size,
      project_id: selectedProjectId || null,
      processing_status: 'processed',
      user_id: 'temp-user', // This would be the actual user ID in a real app
      metadata: {
        originalFileName: file.name,
        uploadedAt: new Date().toISOString(),
        fileSize: file.size,
        mimeType: file.type
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Update progress to completed
    setUploads(prev => prev.map(u => 
      u.fileName === file.name ? { ...u, status: 'completed', progress: 100 } : u
    ))

    // Notify parent component
    onFileProcessed(document)

    // Remove from uploads after a delay
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.fileName !== file.name))
    }, 3000)
  }

  const extractTextFromFile = async (file: File): Promise<string> => {
    const fileType = getFileType(file)
    
    switch (fileType) {
      case 'text':
      case 'markdown':
        return await file.text()
      
      case 'pdf':
        // In a real implementation, you'd use a PDF parsing library
        return `[PDF Content] - ${file.name}\n\nThis is a placeholder for PDF content extraction. In a real implementation, this would use a library like PDF.js to extract text from the PDF file.`
      
      case 'docx':
        // In a real implementation, you'd use a DOCX parsing library
        return `[Word Document Content] - ${file.name}\n\nThis is a placeholder for Word document content extraction. In a real implementation, this would use a library like mammoth.js to extract text from the DOCX file.`
      
      case 'rtf':
        // In a real implementation, you'd use an RTF parsing library
        return `[RTF Content] - ${file.name}\n\nThis is a placeholder for RTF content extraction. In a real implementation, this would parse the RTF format to extract plain text.`
      
      default:
        return await file.text()
    }
  }

  const getFileType = (file: File): string => {
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) return 'text'
    if (file.type === 'text/markdown' || file.name.endsWith('.md')) return 'markdown'
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return 'pdf'
    if (file.type.includes('wordprocessingml') || file.name.endsWith('.docx')) return 'docx'
    if (file.type === 'application/rtf' || file.name.endsWith('.rtf')) return 'rtf'
    return 'unknown'
  }



  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={supportedFormats.map(f => f.ext).join(',')}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="space-y-4">
          <div className="text-6xl">📄</div>
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Drop files here or click to upload
            </h3>
            <p className="text-muted-foreground mb-4">
              Upload documents to extract text and add to your knowledge base
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              Choose Files
            </Button>
          </div>
        </div>
      </div>

      {/* Supported Formats */}
      <div className="bg-muted/30 rounded-lg p-4">
        <h4 className="font-medium mb-3">Supported Formats</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {supportedFormats.map(format => (
            <div key={format.ext} className="flex items-center space-x-2 text-sm">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                {format.ext}
              </span>
              <span className="text-muted-foreground">{format.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Processing Files</h4>
          {uploads.map((upload, index) => (
            <div key={index} className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm truncate">{upload.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {upload.status === 'uploading' && '📤 Uploading...'}
                  {upload.status === 'processing' && '⚙️ Processing...'}
                  {upload.status === 'completed' && '✅ Completed'}
                  {upload.status === 'error' && '❌ Error'}
                </span>
              </div>
              
              {upload.status !== 'error' && (
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${upload.progress}%` }}
                  ></div>
                </div>
              )}
              
              {upload.error && (
                <p className="text-sm text-destructive mt-2">{upload.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
