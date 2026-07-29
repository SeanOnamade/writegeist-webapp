'use client'

import { useState } from 'react'
import {
  Headphones,
  Download,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Book,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDuration, formatFileSize, formatGenerationDate } from '@/lib/audio/format'
import type { AudioLibraryChapter } from '@/lib/data/audioLibrary'

interface AudioChapterCardProps {
  chapter: AudioLibraryChapter
  isGenerating: boolean
  isValidating: boolean
  isDeleting: boolean
  progress?: { progress: number; message: string }
  onGenerate: (force: boolean) => void
  onDelete: () => void
  onDownload: () => void
  onReadAlong: () => void
}

function StatusBadge({
  chapter,
  isGenerating,
}: {
  chapter: AudioLibraryChapter
  isGenerating: boolean
}) {
  const audio = chapter.audio

  if (isGenerating || audio?.status === 'processing') {
    return (
      <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Generating...
      </Badge>
    )
  }

  switch (audio?.status) {
    case 'completed':
      return (
        <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Ready
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-red-500/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    case 'outdated':
      return (
        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <Clock className="h-3 w-3 mr-1" />
          Outdated
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="border-gray-500/30 text-gray-400">
          <Clock className="h-3 w-3 mr-1" />
          Not Generated
        </Badge>
      )
  }
}

export function AudioChapterCard({
  chapter,
  isGenerating,
  isValidating,
  isDeleting,
  progress,
  onGenerate,
  onDelete,
  onDownload,
  onReadAlong,
}: AudioChapterCardProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const audio = chapter.audio
  const busy = isGenerating || isValidating || isDeleting

  const generateButtonContent = (idleIcon: React.ReactNode, idleLabel: string) => {
    if (isValidating) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Validating...
        </>
      )
    }
    if (isGenerating) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      )
    }
    return (
      <>
        {idleIcon}
        {idleLabel}
      </>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{chapter.title}</CardTitle>
            <CardDescription className="mt-1">
              {chapter.project.title} • Chapter {chapter.order_index} • {chapter.word_count} words
            </CardDescription>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {chapter.content_preview}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <StatusBadge chapter={chapter} isGenerating={isGenerating} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {audio?.status === 'completed' && !isGenerating ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>Duration: {formatDuration(audio.duration || 0)}</span>
              <span>Size: {formatFileSize(audio.file_size || 0)}</span>
              <span>Voice: {audio.voice_model}</span>
              {audio.created_at && <span>Generated: {formatGenerationDate(audio.created_at)}</span>}
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <audio controls className="w-full" preload="metadata">
                <source
                  src={audio.playUrl || audio.audio_url || `/api/audio/stream/${audio.id}`}
                  type="audio/mpeg"
                />
                Your browser does not support the audio element.
              </audio>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onReadAlong}
                className="gap-2 flex-1 md:flex-[2] min-w-0"
              >
                <Book className="h-4 w-4" />
                Read Along
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDownload}
                className="gap-2 flex-1 min-w-0"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGenerate(true)}
                disabled={busy}
                className="gap-2 w-full md:flex-1 md:w-auto min-w-0"
              >
                {generateButtonContent(<RefreshCw className="h-4 w-4" />, 'Regenerate')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isDeleting}
                className="gap-2 flex-1 min-w-0 text-red-400 hover:text-red-300 hover:border-red-500/50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : audio?.status === 'error' && !isGenerating ? (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-red-400">
                {audio.error_message || 'Audio generation failed'}
              </p>
            </div>
            <Button onClick={() => onGenerate(true)} disabled={busy} className="gap-2">
              {generateButtonContent(<RefreshCw className="h-4 w-4" />, 'Try Again')}
            </Button>
          </div>
        ) : audio?.status === 'processing' || isGenerating ? (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span className="text-sm text-blue-400">
                {progress?.message || 'Generating audio...'}
              </span>
            </div>
            <Progress value={progress?.progress || 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {progress?.progress
                ? `${progress.progress}% complete`
                : 'This may take a few minutes depending on chapter length'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate high-quality audio narration for this chapter using AI text-to-speech.
            </p>
            <Button onClick={() => onGenerate(false)} disabled={busy} className="gap-2">
              {generateButtonContent(<Headphones className="h-4 w-4" />, 'Generate Audio')}
            </Button>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete audio?"
        description={`This deletes the generated audio for "${chapter.title}" and frees ${formatFileSize(
          audio?.file_size || 0
        )} of storage. The chapter text is not affected.`}
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
      />
    </Card>
  )
}
