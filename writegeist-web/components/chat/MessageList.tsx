'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronDown, ChevronRight, Feather } from 'lucide-react'
import type { ChatMessage } from '@/types/database'
import { groupCitations, type ContextCitation } from '@/lib/chat/groupCitations'

const SUGGESTED_PROMPTS = ['Who is Kane?', 'Summarize the opening', 'What happens in chapter 2?']

function getCitations(message: ChatMessage): ContextCitation[] {
  const meta = message.metadata as { citations?: ContextCitation[] } | null
  return meta?.citations || []
}

function getMessageConfidence(message: ChatMessage): 'high' | 'low' | null {
  const meta = message.metadata as { confidence?: 'high' | 'low' } | null
  return meta?.confidence ?? null
}

const isRefusalMessage = (content: string): boolean =>
  /don't see that in your manuscript/i.test(content)

function shouldShowCitations(message: ChatMessage, citations: ContextCitation[]): boolean {
  if (citations.length === 0) return false
  if (message.role !== 'assistant' || !isRefusalMessage(message.content)) return true
  const maxSimilarity = Math.max(...citations.map((c) => c.similarity))
  return maxSimilarity >= 0.4
}

const formatTime = (dateString: string) =>
  new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

function AssistantAvatar() {
  return (
    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
      <Feather className="h-4 w-4 text-primary" />
    </div>
  )
}

function SourcesBlock({
  message,
  citations,
  projectIdForLinks,
}: {
  message: ChatMessage
  citations: ContextCitation[]
  projectIdForLinks: string
}) {
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set())
  const groupedCitations = groupCitations(citations)

  if (!shouldShowCitations(message, citations) || groupedCitations.length === 0) return null

  const toggleExpand = (key: string) => {
    setExpandedCitations((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="rounded-xl border bg-muted/40 px-3 py-2.5 text-xs">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <BookOpen className="h-3 w-3" />
        Sources
      </div>
      <div className="space-y-1">
        {groupedCitations.map((group) => {
          const key = group.chapterId || group.chapterTitle
          const isExpanded = expandedCitations.has(key)
          const excerptCount = group.excerpts.length
          return (
            <div key={key}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {excerptCount > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(key)}
                    className="-ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={isExpanded ? 'Collapse excerpts' : 'Expand excerpts'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                )}
                {group.chapterId && projectIdForLinks ? (
                  <Link
                    href={`/project/${projectIdForLinks}/read?chapter=${group.chapterId}`}
                    className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                  >
                    {group.chapterTitle}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{group.chapterTitle}</span>
                )}
                <span className="text-muted-foreground">
                  {Math.round(group.bestSimilarity * 100)}% match
                </span>
                {excerptCount > 1 && (
                  <span className="text-muted-foreground">· {excerptCount} excerpts</span>
                )}
                {group.chapterId && (
                  <Link
                    href={`/chapters/${group.chapterId}`}
                    className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                  >
                    edit
                  </Link>
                )}
              </div>
              {isExpanded && excerptCount > 1 && (
                <ul className="ml-4 mt-1 space-y-0.5 text-muted-foreground">
                  {group.excerpts.map((excerpt, i) => (
                    <li key={i} className="truncate">
                      &ldquo;{excerpt}&rdquo;
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  projectIdForLinks,
}: {
  message: ChatMessage
  projectIdForLinks: string
}) {
  const citations = getCitations(message)
  const confidence = getMessageConfidence(message)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
            {message.content}
          </div>
          <div className="mt-1 text-right text-[11px] text-muted-foreground/70">
            {formatTime(message.created_at)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
          {message.content}
        </div>
        {confidence === 'low' && (
          <p className="text-xs italic text-muted-foreground">
            Low manuscript match — answer may be incomplete.
          </p>
        )}
        <SourcesBlock
          message={message}
          citations={citations}
          projectIdForLinks={projectIdForLinks}
        />
        <div className="text-[11px] text-muted-foreground/70">
          {formatTime(message.created_at)}
        </div>
      </div>
    </div>
  )
}

interface MessageListProps {
  messages: ChatMessage[]
  thinking: boolean
  streamingText: string
  projectIdForLinks: string
  onSuggestedPrompt: (prompt: string) => void
}

export function MessageList({
  messages,
  thinking,
  streamingText,
  projectIdForLinks,
  onSuggestedPrompt,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, streamingText])

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.length === 0 ? (
        <div className="flex min-h-full flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Feather className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-2 text-xl font-semibold tracking-tight">Ask your manuscript</h3>
          <p className="mb-6 max-w-md text-sm text-muted-foreground sm:text-base">
            Questions about characters, plot threads, or scenes — answered from your actual
            chapters, with sources.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSuggestedPrompt(prompt)}
                className="rounded-full border bg-card px-3.5 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6 px-3 py-4 sm:px-4 sm:py-6">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              projectIdForLinks={projectIdForLinks}
            />
          ))}

          {thinking && streamingText && (
            <div className="flex gap-3">
              <AssistantAvatar />
              <div className="min-w-0 flex-1 pt-1">
                <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                  {streamingText}
                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-foreground/70 align-middle" />
                </div>
              </div>
            </div>
          )}

          {thinking && !streamingText && (
            <div className="flex items-center gap-3">
              <AssistantAvatar />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                    style={{ animationDelay: '0.2s' }}
                  />
                </span>
                Searching manuscript...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  )
}
