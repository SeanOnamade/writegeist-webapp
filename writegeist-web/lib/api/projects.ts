import type { Project } from '@/types/database'
import { api } from './client'

export const projectsAPI = {
  async getAll(): Promise<Project[]> {
    const result = await api.getAllProjects()
    return result.data || []
  },

  async getById(id: string): Promise<Project | null> {
    const result = await api.getProject(id)
    return result.data || null
  },

  async create(title: string, description?: string): Promise<Project | null> {
    const result = await api.createProject({
      title,
      description: description || null,
      status: 'draft',
      metadata: {},
      settings: {}
    })
    return result.data || null
  },

  async save(project: Partial<Project>): Promise<Project | null> {
    if (project.id) {
      const result = await api.updateProject(project.id, project)
      return result.data || null
    } else {
      const result = await api.createProject(project as any)
      return result.data || null
    }
  },

  async delete(id: string): Promise<boolean> {
    const result = await api.deleteProject(id)
    return result.success
  },

  // Project document operations (stored in project metadata)
  async getDocument(projectId: string): Promise<string> {
    const result = await api.getProject(projectId)
    if (result.data?.metadata && typeof result.data.metadata === 'object') {
      const metadata = result.data.metadata as Record<string, unknown>
      return (metadata.document as string) || '# New Project\n\n## Ideas/Notes\n\n## Setting\n\n## Characters\n\n## Full Outline\n'
    }
    return '# New Project\n\n## Ideas/Notes\n\n## Setting\n\n## Characters\n\n## Full Outline\n'
  },

  async saveDocument(projectId: string, markdown: string): Promise<boolean> {
    const project = await api.getProject(projectId)
    if (!project.data) return false

    const metadata = (project.data.metadata as Record<string, unknown>) || {}
    metadata.document = markdown

    const result = await api.updateProject(projectId, { metadata: metadata as any })
    return result.success
  },

  // Character and location sync helpers
  async appendToSection(projectId: string, sectionName: string, items: string[]): Promise<{ success: boolean; added?: string[] }> {
    try {
      const document = await this.getDocument(projectId)
      
      // Simple markdown parsing to find and update sections
      const sectionRegex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i')
      const match = document.match(sectionRegex)
      
      if (match) {
        const existingContent = match[1].trim()
        const newItems = items.filter(item => !existingContent.includes(item))
        
        if (newItems.length > 0) {
          const updatedContent = existingContent + '\n' + newItems.map(item => `- ${item}`).join('\n')
          const updatedDocument = document.replace(sectionRegex, `## ${sectionName}\n\n${updatedContent}\n`)
          
          const success = await this.saveDocument(projectId, updatedDocument)
          return { success, added: newItems }
        }
      }
      
      return { success: true, added: [] }
    } catch (error) {
      console.error('Error appending to section:', error)
      return { success: false }
    }
  },

  async appendCharacters(projectId: string, characters: string[]): Promise<{ success: boolean; added?: string[] }> {
    return this.appendToSection(projectId, 'Characters', characters)
  },

  async appendLocations(projectId: string, locations: string[]): Promise<{ success: boolean; added?: string[] }> {
    return this.appendToSection(projectId, 'Setting', locations)
  }
}