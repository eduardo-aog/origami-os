export const RECORDINGS_FOLDER = '~/Música/Grabaciones'
export const RECORDING_EXTENSION = 'webm'

const pad = (value: number) => String(value).padStart(2, '0')

/** Nombre por fecha y hora local, sin extensión: `Grabación 2026-10-19 14-32-05`. */
export function recordingName(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  return `Grabación ${day} ${time}`
}

/** Mejor formato de audio que admite `MediaRecorder`; `undefined` deja que el navegador decida. */
export function preferredMimeType(): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type))
}

export function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** Mensaje de error si el nombre no sirve para un archivo; `null` si es válido. */
export function validateName(value: string): string | null {
  const name = value.trim()
  if (name === '') return 'Escribe un nombre.'
  if (name.includes('/')) return 'El nombre no puede contener «/».'
  if (name === '.' || name === '..') return 'Ese nombre no es válido.'
  return null
}
