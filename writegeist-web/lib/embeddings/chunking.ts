/**
 * Intelligent content chunking for better embeddings
 * Splits content into semantically meaningful chunks while preserving context
 */

export interface ContentChunk {
  text: string
  index: number
  startChar: number
  endChar: number
  overlap?: string
}

export interface ChunkingOptions {
  maxChars: number
  splitOn: string[]
  preserveContext: boolean
  overlapChars: number
}

export class ContentChunker {
  private defaultOptions: ChunkingOptions = {
    maxChars: 1800,
    splitOn: ['\n\n', '. ', '! ', '? ', '\n', ';'], // Natural breaks in order of preference
    preserveContext: true,
    overlapChars: 200 // Overlap between chunks for context
  }

  /**
   * Intelligently chunk content into smaller pieces
   */
  chunk(content: string, options: Partial<ChunkingOptions> = {}): ContentChunk[] {
    const opts = { ...this.defaultOptions, ...options }
    
    if (content.length <= opts.maxChars) {
      return [{
        text: content,
        index: 0,
        startChar: 0,
        endChar: content.length
      }]
    }

    const chunks: ContentChunk[] = []
    let currentPos = 0
    let chunkIndex = 0

    while (currentPos < content.length) {
      const remainingContent = content.slice(currentPos)
      
      if (remainingContent.length <= opts.maxChars) {
        // Last chunk
        chunks.push({
          text: remainingContent,
          index: chunkIndex,
          startChar: currentPos,
          endChar: content.length
        })
        break
      }

      // Find the best split point within maxChars
      const chunkEnd = this.findBestSplitPoint(
        content, 
        currentPos, 
        currentPos + opts.maxChars, 
        opts.splitOn
      )

      let chunkText = content.slice(currentPos, chunkEnd)

      // Add overlap from previous chunk for context
      if (opts.preserveContext && chunkIndex > 0 && opts.overlapChars > 0) {
        const overlapStart = Math.max(0, currentPos - opts.overlapChars)
        const overlap = content.slice(overlapStart, currentPos)
        chunkText = `...${overlap}\n\n${chunkText}`
      }

      chunks.push({
        text: chunkText,
        index: chunkIndex,
        startChar: currentPos,
        endChar: chunkEnd,
        overlap: opts.preserveContext ? content.slice(Math.max(0, currentPos - opts.overlapChars), currentPos) : undefined
      })

      // Move to next chunk with slight overlap
      currentPos = chunkEnd - (opts.preserveContext ? Math.min(opts.overlapChars / 2, 100) : 0)
      chunkIndex++
    }

    console.log(`Chunked ${content.length} chars into ${chunks.length} chunks`)
    chunks.forEach((chunk, i) => {
      console.log(`Chunk ${i}: ${chunk.text.length} chars (${chunk.startChar}-${chunk.endChar})`)
    })

    return chunks
  }

  /**
   * Find the best place to split content based on natural breaks
   */
  private findBestSplitPoint(
    content: string, 
    start: number, 
    maxEnd: number, 
    splitOn: string[]
  ): number {
    const searchText = content.slice(start, maxEnd)
    
    // Try each split pattern in order of preference
    for (const pattern of splitOn) {
      const lastIndex = searchText.lastIndexOf(pattern)
      if (lastIndex > searchText.length * 0.5) { // Don't split too early
        return start + lastIndex + pattern.length
      }
    }

    // Fallback: split at maxEnd
    return maxEnd
  }

  /**
   * Combine chunks back into full content (for testing)
   */
  recombine(chunks: ContentChunk[]): string {
    return chunks
      .sort((a, b) => a.index - b.index)
      .map(chunk => chunk.text.replace(/^\.\.\..*?\n\n/, '')) // Remove overlap markers
      .join('')
  }
}

export const contentChunker = new ContentChunker()

