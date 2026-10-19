export interface Match {
  start: number
  end: number
}

/** Coincidencias de `query` en `text`, sin distinguir mayúsculas. */
export function findMatches(text: string, query: string): Match[] {
  if (query === '') return []
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return Array.from(text.matchAll(pattern), (match) => ({ start: match.index, end: match.index + match[0].length }))
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}
