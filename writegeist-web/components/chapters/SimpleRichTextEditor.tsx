'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bold, Italic, List, Underline } from 'lucide-react'

interface SimpleRichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  disabled?: boolean
}

export function SimpleRichTextEditor({ 
  content, 
  onChange, 
  placeholder = "Start writing...",
  disabled = false 
}: SimpleRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 })
  const isUpdatingRef = useRef(false)

  // Convert storage format to HTML for display (with backward compatibility)
  const storageToHtml = (storageContent: string): string => {
    if (!storageContent) return ''
    
    // Debug: console.log('🔄 Storage to HTML input:', storageContent.substring(0, 100) + '...')
    
    // BACKWARD COMPATIBILITY: Detect if this is old markdown content
    const hasMarkdownFormatting = storageContent.includes('**') || 
                                  (storageContent.includes('*') && storageContent.match(/\*[^*]+\*/))
    const hasHtmlFormatting = storageContent.includes('<strong>') || 
                             storageContent.includes('<em>') || 
                             storageContent.includes('<u>')
    
    let html = storageContent
    
    // If it's old markdown content, convert it (but only if it doesn't already have HTML)
    if (hasMarkdownFormatting && !hasHtmlFormatting) {
      console.log('🔄 Converting legacy markdown content...')
      html = html
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // **bold** → <strong>bold</strong>
        .replace(/\*([^*]+)\*/g, '<em>$1</em>') // *italic* → <em>italic</em>
    }
    
    // Handle lists - convert hyphen lists to HTML
    html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    
    // Handle headers and rules
    html = html
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^---+$/gm, '<hr>')
    
    // Handle existing HTML formatting properly  
    html = html
      .split(/\n\s*\n/) // Split on paragraph breaks
      .map(block => {
        block = block.trim()
        if (!block) return ''
        
        // If block contains HTML formatting tags, wrap in paragraph but keep the tags
        if (block.includes('<strong>') || block.includes('<em>') || block.includes('<u>')) {
          return `<p>${block}</p>`
        }
        // If it's structural HTML, don't wrap
        if (block.match(/^<(h[1-6]|ul|ol|li|hr|div)/)) {
          return block
        }
        // Regular text gets wrapped in paragraph
        return `<p>${block}</p>`
      })
      .filter(Boolean)
      .join('')
    
    // Debug: console.log('✅ Storage to HTML output:', html.substring(0, 100) + '...')
    return html
  }

  // Convert HTML back to storage format - KEEP ALL HTML TAGS for formatting!
  const htmlToStorage = (html: string): string => {
    if (!html) return ''
    
    // Debug: console.log('🔄 HTML to storage input:', html.substring(0, 100) + '...')
    
    // Process the HTML but KEEP all formatting tags
    let result = html
    
    // Handle lists - convert to simple hyphen format for storage
    result = result.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gi) || []
      return items.map(item => {
        const text = item.replace(/<li[^>]*>(.*?)<\/li>/i, '$1').trim()
        return `- ${text}` // Convert to hyphen lists
      }).join('\n') + '\n\n'
    })
    
    // Handle structural elements (convert to markdown)
    result = result
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<hr[^>]*>/gi, '---\n\n')
      
    // CRITICAL: Keep ALL formatting tags (<strong>, <em>, <u>) as HTML!
    // Don't convert them to markdown - this preserves formatting perfectly
    result = result
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n') // Remove paragraph tags but keep content
      .replace(/<br\s*\/?>/gi, '\n') // Convert breaks to newlines
      .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n') // Remove div tags
      
    // Clean up HTML entities but PRESERVE formatting tags
    result = result
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n') // Clean up excessive newlines
      .trim()
    
    // Debug: console.log('✅ HTML to storage output (preserving HTML tags):', result.substring(0, 100) + '...')
    return result
  }

  // Clean up content - but DON'T touch asterisks since they're literal now!
  const cleanupContent = (storageContent: string): string => {
    // Only clean up truly broken content, not asterisks
    return storageContent
      // Don't touch asterisks at all - they're literal characters!
      // Only fix truly broken HTML if any
      .replace(/<\/strong><strong>/g, '') // Remove empty strong tags
      .replace(/<\/em><em>/g, '') // Remove empty em tags
      // Don't modify spacing or asterisks at all!
  }

  // Update editor content when prop changes
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      // Clean up any corrupted content first
      const cleanedContent = cleanupContent(content)
      const html = storageToHtml(cleanedContent)
      
      if (editorRef.current.innerHTML !== html) {
        isUpdatingRef.current = true
        // Debug: Setting editor HTML with formatting
        editorRef.current.innerHTML = html
        
        // If we cleaned up content, save the cleaned version
        if (cleanedContent !== content) {
          console.log('🧹 Cleaned up content formatting')
          onChange(cleanedContent)
        }
        
        setTimeout(() => {
          isUpdatingRef.current = false
        }, 0)
      }
    }
  }, [content, onChange])

  // Handle content changes
  const handleInput = () => {
    if (editorRef.current && !isUpdatingRef.current) {
      isUpdatingRef.current = true
      const html = editorRef.current.innerHTML
      const storageFormat = htmlToStorage(html)
      onChange(storageFormat)
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
    }
  }

  // Handle paste events to preserve formatting and spacing
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    
    // Try to get rich text first, then fall back to plain text
    const richText = e.clipboardData.getData('text/html')
    const plainText = e.clipboardData.getData('text/plain')
    
    if (richText) {
      // Use rich text if available (preserves formatting)
      document.execCommand('insertHTML', false, richText)
    } else if (plainText) {
      // Process plain text - DON'T convert asterisks to formatting!
      let content = plainText
        // Handle line breaks properly but keep asterisks as literal text
        .replace(/\n\s*\n/g, '</p><p>') // Double newlines = new paragraphs
        .replace(/\n/g, '<br>') // Single newlines = line breaks
      
      document.execCommand('insertHTML', false, `<p>${content}</p>`)
    }
    
    handleInput()
  }

  // Handle text selection for toolbar
  const handleSelectionChange = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setToolbarPosition({
        top: rect.top - 50,
        left: rect.left + (rect.width / 2) - 100
      })
      setShowToolbar(true)
    } else {
      setShowToolbar(false)
    }
  }

  // Formatting functions
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    handleInput()
    
    // Restore selection
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus()
      }
    }, 0)
  }

  const toggleBold = () => formatText('bold')
  const toggleItalic = () => formatText('italic')
  const toggleUnderline = () => formatText('underline')
  const insertList = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const selectedText = range.toString()
      
      if (selectedText) {
        // Convert selected text to list
        const listItems = selectedText.split('\n').map(line => line.trim()).filter(line => line)
        const listHtml = '<ul>' + listItems.map(item => `<li>${item}</li>`).join('') + '</ul>'
        
        range.deleteContents()
        const listElement = document.createElement('div')
        listElement.innerHTML = listHtml
        range.insertNode(listElement.firstChild!)
      } else {
        // Insert new list
        document.execCommand('insertHTML', false, '<ul><li></li></ul>')
      }
      
      handleInput()
    }
  }

  // Keyboard shortcuts and auto-list creation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          toggleBold()
          break
        case 'i':
          e.preventDefault()
          toggleItalic()
          break
        case 'u':
          e.preventDefault()
          toggleUnderline()
          break
      }
    }
    
    // Auto-create lists when typing "- " ONLY (not asterisks!)
    if (e.key === ' ' && editorRef.current) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const textNode = range.startContainer
        const text = textNode.textContent || ''
        const cursorPos = range.startOffset
        
        // Check if we just typed "- " at the start of a line (NOT asterisks!)
        const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1
        const beforeCursor = text.substring(lineStart, cursorPos)
        
        if (beforeCursor === '-') { // ONLY hyphens
          e.preventDefault()
          
          // Replace the "- " with a proper list item
          range.setStart(textNode, lineStart)
          range.setEnd(textNode, cursorPos)
          range.deleteContents()
          
          document.execCommand('insertHTML', false, '<ul><li></li></ul>')
          handleInput()
        }
      }
    }
  }

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle if the editor is focused
      if (document.activeElement === editorRef.current) {
        handleKeyDown(e)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('keydown', handleGlobalKeyDown)
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [])

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      {showToolbar && (
        <div 
          className="fixed z-50 bg-background border border-border rounded-lg p-1 shadow-xl flex gap-0.5"
          style={{ 
            top: toolbarPosition.top, 
            left: toolbarPosition.left,
            backgroundColor: 'var(--color-background)',
            borderColor: 'var(--color-border)'
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleBold}
            className="h-8 w-8 p-0"
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleItalic}
            className="h-8 w-8 p-0"
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleUnderline}
            className="h-8 w-8 p-0"
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={insertList}
            className="h-8 w-8 p-0"
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onPaste={handlePaste}
        className="p-4 sm:p-6 min-h-[400px] focus:outline-none text-foreground"
        style={{
          fontSize: '16px',
          lineHeight: '1.6',
          fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
          color: 'var(--color-foreground)'
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Placeholder styling */}
      <style jsx>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
          pointer-events: none;
          position: absolute;
        }
      `}</style>
    </div>
  )
}
