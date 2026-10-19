/** Una nota en el `appData` de la app (clave `note:<id>`). */
export interface Note {
  id: string
  content: string
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export const NOTE_PREFIX = 'note:'
export const noteKey = (id: string) => `${NOTE_PREFIX}${id}`

const lines = (note: Note) => note.content.split('\n').map((line) => line.trim()).filter((line) => line !== '')

/** El título es la primera línea con texto. */
export const noteTitle = (note: Note) => lines(note)[0] ?? 'Nueva nota'

/** Vista previa: la línea siguiente al título. */
export const notePreview = (note: Note) => lines(note)[1] ?? 'Sin texto adicional'

/** Fijadas primero; dentro de cada grupo, de la más reciente a la más antigua. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
}

const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function matchesQuery(note: Note, query: string): boolean {
  return query.trim() === '' || plain(note.content).includes(plain(query.trim()))
}

export function newNote(): Note {
  const now = Date.now()
  return { id: crypto.randomUUID(), content: '', pinned: false, createdAt: now, updatedAt: now }
}

export function formatNoteDate(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return new Intl.DateTimeFormat('es', sameDay ? { timeStyle: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}
