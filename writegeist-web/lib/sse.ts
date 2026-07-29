/**
 * Parse a Server-Sent Events response body, invoking the callback for each
 * complete `event:`/`data:` frame. Handles frames split across chunks.
 */
export async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        let event = 'message'
        let dataStr = ''
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) {
            event = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataStr += line.slice(5).trim()
          }
        }
        if (!dataStr) continue

        try {
          onEvent(event, JSON.parse(dataStr))
        } catch {
          // Skip malformed frames.
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
