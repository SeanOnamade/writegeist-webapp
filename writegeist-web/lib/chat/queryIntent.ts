export function isOpeningOrSummaryQuery(query: string): boolean {
  const q = query.toLowerCase()
  return (
    /\b(summariz|summary|opening|beginning|start of|opening scene)\b/.test(q) ||
    /\bwhat happens (at|in) the (start|beginning|opening)\b/.test(q) ||
    /\b(act\s*(one|1|i)|first chapter|chapter\s*(one|1|i))\b/.test(q)
  )
}

export function getTargetChapterOrder(query: string): number | null {
  const match = query.match(/\bchapter\s*(\d+)\b/i)
  if (!match) return null
  const order = parseInt(match[1], 10)
  return Number.isFinite(order) && order > 0 ? order : null
}

export function isThematicQuery(query: string): boolean {
  const q = query.toLowerCase()
  return (
    /\b(theme|themes|motif|motifs|symbolism|symbolic|meaning|tone|message)\b/.test(q) ||
    /\bwhat is (the |this )?(book|story|novel) (about|really about)\b/.test(q) ||
    /\bso far\b/.test(q) && /\b(theme|about|meaning)\b/.test(q)
  )
}
