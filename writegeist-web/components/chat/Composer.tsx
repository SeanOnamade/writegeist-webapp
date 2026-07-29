'use client'

import { ArrowUp, Loader2 } from 'lucide-react'

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  sending: boolean
  error: string | null
}

export function Composer({ value, onChange, onSend, sending, error }: ComposerProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const nearLimit = value.length >= 1500

  return (
    <div className="border-t bg-background mb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-3xl p-3 sm:p-4">
        {error && (
          <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="relative rounded-2xl border bg-card shadow-sm transition-shadow focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/30">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your manuscript — e.g. Who is Kane?"
            className="max-h-40 min-h-[52px] w-full resize-none bg-transparent py-3.5 pl-4 pr-14 text-base placeholder:text-muted-foreground focus:outline-none"
            rows={1}
            maxLength={2000}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!value.trim() || sending}
            aria-label="Send message"
            className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <div
          className={`mt-1.5 items-center justify-between px-1 text-xs text-muted-foreground ${
            nearLimit ? 'flex' : 'hidden sm:flex'
          }`}
        >
          <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
          {nearLimit && <span className="ml-auto">{value.length}/2000</span>}
        </div>
      </div>
    </div>
  )
}
