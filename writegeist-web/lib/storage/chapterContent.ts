import { createClient } from '@/lib/supabase/client'

export class ChapterContentStorage {
  private supabase = createClient()

  /**
   * Save chapter content to storage and update database
   */
  async saveChapterContent(
    chapterId: string, 
    content: string, 
    metadata: {
      title?: string
      status?: string
      wordCount?: number
      orderIndex?: number
      projectId?: string
    } = {}
  ) {
    try {
      console.log('Saving chapter content via storage...')
      console.log('Chapter ID:', chapterId)
      console.log('Content length:', content.length)

      // Get current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('User not authenticated')
      }

      // Create file path: userId/chapterId.txt
      const filePath = `${user.id}/${chapterId}.txt`
      console.log('File path:', filePath)

      // Upload content to storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('chapter-content')
        .upload(filePath, new Blob([content], { type: 'text/plain' }), {
          upsert: true // Overwrite if exists
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        console.error('Upload error details:', JSON.stringify(uploadError, null, 2))
        
        // Try to continue with database-only storage if Supabase storage fails
        console.log('Storage upload failed, falling back to database-only storage')
        
        // Update chapter with content directly in database as fallback
        const { data: chapterData, error: updateError } = await this.supabase
          .from('chapters')
          .update({
            content: content,
            title: metadata.title,
            status: metadata.status as any,
            word_count: metadata.wordCount,
            order_index: metadata.orderIndex,
            updated_at: new Date().toISOString()
          })
          .eq('id', chapterId)
          .select()

        if (updateError) {
          throw new Error(`Failed to save content: ${updateError.message}`)
        }

        // Still try to generate embeddings even if storage fails
        try {
          console.log('Triggering chunked embedding generation (fallback mode)...')
          const embeddingResponse = await fetch('/api/embeddings/generate-chunked', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chapterId: chapterId,
              content: content,
              projectId: metadata.projectId || 'ededb541-8ea5-4304-b830-ca628e30b47e'
            })
          })
          
          if (embeddingResponse.ok) {
            const embeddingResult = await embeddingResponse.json()
            console.log(`Chunked embeddings generated successfully (fallback): ${embeddingResult.successfulEmbeddings}/${embeddingResult.totalChunks} chunks`)
          }
        } catch (embeddingError) {
          console.log('Embedding generation also failed:', embeddingError)
        }

        return {
          success: true,
          data: chapterData?.[0],
          storage_method: 'database_fallback'
        }
      }

      console.log('Content uploaded to storage:', uploadData.path)
      
      // Generate chunked embeddings immediately after successful upload
      try {
        console.log('Triggering chunked embedding generation...')
        const embeddingResponse = await fetch('/api/embeddings/generate-chunked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId: chapterId,
            content: content,
            projectId: metadata.projectId || 'ededb541-8ea5-4304-b830-ca628e30b47e' // Default to Limbo project
          })
        })
        
        if (embeddingResponse.ok) {
          const embeddingResult = await embeddingResponse.json()
          console.log(`Chunked embeddings generated successfully: ${embeddingResult.successfulEmbeddings}/${embeddingResult.totalChunks} chunks`)
          console.log('Skipping old single embedding generation - using chunked embeddings only')
        } else {
          console.log('Chunked embedding generation failed, but content saved')
        }
      } catch (embeddingError) {
        console.log('Chunked embedding generation error:', embeddingError)
        // Don't fail the save if embeddings fail
      }

      // Update chapter metadata and file path
      console.log('Updating chapter with word count:', metadata.wordCount)
      const { data: chapterData, error: updateError } = await this.supabase
        .from('chapters')
        .update({
          title: metadata.title,
          status: metadata.status as any,
          word_count: metadata.wordCount,
          order_index: metadata.orderIndex,
          content_file_path: uploadData.path,
          updated_at: new Date().toISOString()
        })
        .eq('id', chapterId)
        .select()

      if (updateError) {
        console.error('Chapter update error:', updateError)
        throw new Error(`Failed to update chapter: ${updateError.message}`)
      }

      console.log('Chapter updated successfully')
      console.log('Returned chapter data:', chapterData?.[0])
      
      // Fix: The database returns truncated content, but we need to return the full content
      // since it's now stored in storage
      const updatedChapter = chapterData?.[0]
      if (updatedChapter) {
        updatedChapter.content = content // Use the full content we just saved
        console.log('Fixed content length in returned data:', content.length)
      }
      
      return updatedChapter || null

    } catch (error) {
      console.error('Error saving chapter content:', error)
      throw error
    }
  }

  /**
   * Load chapter content from storage
   */
  async loadChapterContent(chapterId: string): Promise<string | null> {
    try {
      // Get current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('User not authenticated')
      }

      // Get chapter to find file path
      const { data: chapter, error: chapterError } = await this.supabase
        .from('chapters')
        .select('content_file_path, content')
        .eq('id', chapterId)
        .single()

      if (chapterError) {
        console.error('Error fetching chapter:', chapterError)
        return null
      }

      // If no file path, return regular content
      if (!chapter.content_file_path) {
        return chapter.content || null
      }

      // Download content from storage
      const { data: fileData, error: downloadError } = await this.supabase.storage
        .from('chapter-content')
        .download(chapter.content_file_path)

      if (downloadError) {
        console.error('Storage download error:', downloadError)
        // Fallback to regular content
        return chapter.content || null
      }

      // Convert blob to text
      const content = await fileData.text()
      return content

    } catch (error) {
      console.error('Error loading chapter content:', error)
      return null
    }
  }

  /**
   * Delete chapter content from storage
   */
  async deleteChapterContent(chapterId: string): Promise<void> {
    try {
      // Get current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('User not authenticated')
      }

      const filePath = `${user.id}/${chapterId}.txt`

      // Delete from storage
      const { error: deleteError } = await this.supabase.storage
        .from('chapter-content')
        .remove([filePath])

      if (deleteError) {
        console.error('Storage delete error:', deleteError)
        // Don't throw - file might not exist
      }

      // Clear file path from database
      await this.supabase
        .from('chapters')
        .update({ content_file_path: null })
        .eq('id', chapterId)

    } catch (error) {
      console.error('Error deleting chapter content:', error)
    }
  }
}

export const chapterContentStorage = new ChapterContentStorage()
