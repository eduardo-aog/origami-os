export const PHOTOS_FOLDER = '~/Imágenes/Cámara'
export const VIDEOS_FOLDER = '~/Videos/Cámara'

export type Mode = 'photo' | 'video'
export type TimerSeconds = 0 | 3 | 10

const pad = (value: number) => String(value).padStart(2, '0')

/** Nombre por fecha y hora local, sin extensión: `Foto 2026-10-19 14-32-05`. */
export function captureName(mode: Mode, date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  return `${mode === 'photo' ? 'Foto' : 'Video'} ${day} ${time}`
}

export function preferredVideoType(withAudio: boolean): string | undefined {
  const candidates = withAudio
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

const HINTS: Record<string, string> = {
  'not-found': 'Conecta una cámara y vuelve a intentarlo.',
  denied: 'Permite el acceso a la cámara y vuelve a intentarlo.',
  unavailable: 'Cierra las aplicaciones que la estén usando y vuelve a intentarlo.'
}

/** Mensaje del error de `kernel/media` con una indicación de qué hacer. */
export function describeCameraError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const hint = HINTS[code]
  return hint === undefined ? error.message : `${error.message} ${hint}`
}
