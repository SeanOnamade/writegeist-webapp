'use client'

import { Lightbulb, Headphones, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Chapter } from '@/types/database'

interface ChapterMetaPanelProps {
  content: string
  wordCount: number
  status: Chapter['status']
  onStatusChange: (status: Chapter['status']) => void
  onBrowseIdeas: () => void
  onGenerateAudio: () => void
  onGetWritingHelp: () => void
  /** Distinguishes the radio group when the panel is rendered twice. */
  idPrefix?: string
}

/**
 * Writing stats, status, and quick actions. Rendered in the desktop sidebar
 * and the mobile overlay (previously two copy-pasted implementations).
 */
export function ChapterMetaPanel({
  content,
  wordCount,
  status,
  onStatusChange,
  onBrowseIdeas,
  onGenerateAudio,
  onGetWritingHelp,
  idPrefix = 'meta',
}: ChapterMetaPanelProps) {
  const paragraphCount = content.split('\n\n').filter((p) => p.trim().length > 0).length

  return (
    <div className="w-full">
      <div className="mb-6">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onBrowseIdeas}>
          <Lightbulb className="h-4 w-4" />
          Browse Ideas
        </Button>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold mb-2">Writing Stats</h4>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">Word Count</div>
            <div className="text-2xl font-bold">{wordCount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Character Count</div>
            <div className="text-lg font-semibold">{content.length.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Paragraphs</div>
            <div className="text-lg font-semibold">{paragraphCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Reading Time</div>
            <div className="text-lg font-semibold">{Math.ceil(wordCount / 200)} min</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold mb-2">Chapter Status</h4>
        <div className="space-y-1">
          {(['draft', 'in_progress', 'completed', 'published'] as const).map((statusOption) => (
            <label key={statusOption} className="flex items-center space-x-2 py-1.5 cursor-pointer">
              <input
                type="radio"
                name={`${idPrefix}-status`}
                value={statusOption}
                checked={status === statusOption}
                onChange={(e) => onStatusChange(e.target.value as Chapter['status'])}
                className="rounded"
              />
              <span className="text-sm capitalize">{statusOption.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold mb-2">Quick Actions</h4>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={onGenerateAudio}
          >
            <Headphones className="h-4 w-4" />
            Generate Audio
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={onGetWritingHelp}
          >
            <MessageSquare className="h-4 w-4" />
            Get Writing Help
          </Button>
        </div>
      </div>
    </div>
  )
}
