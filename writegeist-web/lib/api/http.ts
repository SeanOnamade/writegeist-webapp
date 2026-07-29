import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

/**
 * Consistent `{ error }` JSON shape for all API routes.
 */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Parse and validate a JSON request body against a zod schema.
 * Returns either the typed data or a ready-to-return 400 response.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  // Missing/malformed bodies parse as undefined so schemas with .default()
  // can accept body-less requests.
  const raw = await request.json().catch(() => undefined)
  const parsed = schema.safeParse(raw ?? undefined)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join('.')
    const message = issue
      ? path
        ? `${path}: ${issue.message}`
        : issue.message
      : 'Invalid request body'
    return { ok: false, response: jsonError(message, 400) }
  }

  return { ok: true, data: parsed.data }
}
