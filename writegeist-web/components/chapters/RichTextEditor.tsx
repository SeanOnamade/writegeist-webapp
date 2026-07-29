'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Highlight } from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Quote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RichTextEditorProps {
  /** Markdown (may contain inline HTML like <u> from legacy content). */
  content: string
  onChange: (markdown: string) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * Tiptap-based chapter editor. Content is parsed from and serialized back to
 * markdown; marks without markdown syntax (underline, highlight) round-trip
 * as inline HTML, which the readers render via rehype-raw.
 */
export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  disabled = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight,
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: true,
        bulletListMarker: '-',
        linkify: false,
        breaks: false,
        transformPastedText: true,
      }),
    ],
    content,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'p-4 sm:p-6 min-h-[400px] focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown())
    },
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  // Sync external content changes (e.g. switching chapters) without clobbering
  // in-progress typing: only reset when the markdown actually differs.
  useEffect(() => {
    if (!editor) return
    const current = editor.storage.markdown.getMarkdown()
    if (content !== current) {
      editor.commands.setContent(content, false)
    }
  }, [editor, content])

  if (!editor) {
    return <div className="p-4 sm:p-6 min-h-[400px]" />
  }

  const menuButton = (
    label: string,
    icon: React.ReactNode,
    isActive: boolean,
    onClick: () => void
  ) => (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      className="h-8 w-8 p-0"
      title={label}
      aria-label={label}
    >
      {icon}
    </Button>
  )

  return (
    <div className="relative flex-1">
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, maxWidth: 'none' }}
        className="bg-background border border-border rounded-lg p-1 shadow-xl flex flex-wrap gap-0.5 max-w-[calc(100vw-2rem)]"
      >
        {menuButton('Bold (Ctrl+B)', <Bold className="h-4 w-4" />, editor.isActive('bold'), () =>
          editor.chain().focus().toggleBold().run()
        )}
        {menuButton(
          'Italic (Ctrl+I)',
          <Italic className="h-4 w-4" />,
          editor.isActive('italic'),
          () => editor.chain().focus().toggleItalic().run()
        )}
        {menuButton(
          'Underline (Ctrl+U)',
          <UnderlineIcon className="h-4 w-4" />,
          editor.isActive('underline'),
          () => editor.chain().focus().toggleUnderline().run()
        )}
        {menuButton(
          'Heading 1',
          <Heading1 className="h-4 w-4" />,
          editor.isActive('heading', { level: 1 }),
          () => editor.chain().focus().toggleHeading({ level: 1 }).run()
        )}
        {menuButton(
          'Heading 2',
          <Heading2 className="h-4 w-4" />,
          editor.isActive('heading', { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run()
        )}
        {menuButton(
          'Bullet list',
          <List className="h-4 w-4" />,
          editor.isActive('bulletList'),
          () => editor.chain().focus().toggleBulletList().run()
        )}
        {menuButton(
          'Numbered list',
          <ListOrdered className="h-4 w-4" />,
          editor.isActive('orderedList'),
          () => editor.chain().focus().toggleOrderedList().run()
        )}
        {menuButton(
          'Blockquote',
          <Quote className="h-4 w-4" />,
          editor.isActive('blockquote'),
          () => editor.chain().focus().toggleBlockquote().run()
        )}
      </BubbleMenu>

      <EditorContent editor={editor} />
    </div>
  )
}
