import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

/**
 * Chapter prose renderer shared by the book reader and the read-along modal.
 * `size` controls body text size: 'lg' for immersive reading, 'base' for modals.
 */
export function ChapterMarkdown({ content, size = 'base' }: { content: string; size?: 'base' | 'lg' }) {
  const paragraphClass =
    size === 'lg'
      ? 'mb-6 leading-relaxed text-foreground text-lg md:text-xl'
      : 'mb-6 leading-relaxed text-foreground text-base md:text-lg'

  return (
    <ReactMarkdown
      rehypePlugins={[rehypeRaw]}
      components={{
        p: ({ children }) => <p className={paragraphClass}>{children}</p>,
        h1: ({ children }) => (
          <h1 className="text-2xl md:text-3xl font-bold mb-6 mt-8 text-foreground border-b border-border pb-2">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl md:text-2xl font-semibold mb-4 mt-6 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg md:text-xl font-semibold mb-3 mt-5 text-foreground">{children}</h3>
        ),
        em: ({ children }) => <em className="italic text-primary font-medium">{children}</em>,
        strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
        u: ({ children }) => <u className="underline text-foreground">{children}</u>,
        del: ({ children }) => <del className="line-through text-muted-foreground">{children}</del>,
        s: ({ children }) => <s className="line-through text-muted-foreground">{children}</s>,
        mark: ({ children }) => (
          <mark className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">{children}</mark>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-6 my-6 italic text-muted-foreground bg-muted/30 py-4 rounded-r-lg">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className="mb-6 pl-6 list-disc text-foreground space-y-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-6 pl-6 list-decimal text-foreground space-y-2">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
