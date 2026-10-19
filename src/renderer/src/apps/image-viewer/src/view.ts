export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']

export const MIN_SCALE = 0.05
export const MAX_SCALE = 32

export interface Size {
  width: number
  height: number
}

export interface Offset {
  x: number
  y: number
}

export const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path
export const folderOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/'

export const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es', { numeric: true })

export function isImageName(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && IMAGE_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase())
}

export const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

/** Tamaño de la imagen una vez girada: con un cuarto de vuelta, ancho y alto se intercambian. */
export function rotatedSize(natural: Size, rotation: number): Size {
  const quarter = Math.abs(Math.round(rotation / 90)) % 2 === 1
  return quarter ? { width: natural.height, height: natural.width } : natural
}

/** Escala que hace caber la imagen en el área sin ampliarla por encima de su tamaño real. */
export function fitScale(box: Size, natural: Size, rotation: number): number {
  const size = rotatedSize(natural, rotation)
  if (size.width === 0 || size.height === 0 || box.width === 0 || box.height === 0) return 1
  return Math.min(box.width / size.width, box.height / size.height, 1)
}

/**
 * Nuevo desplazamiento tras cambiar de escala manteniendo fijo el punto `anchor`
 * (relativo al centro del área), para que el zoom se haga hacia el cursor.
 */
export function zoomOffset(offset: Offset, anchor: Offset, from: number, to: number): Offset {
  const ratio = to / from
  return { x: anchor.x - (anchor.x - offset.x) * ratio, y: anchor.y - (anchor.y - offset.y) * ratio }
}

export const formatPercent = (scale: number) => `${Math.round(scale * 100)} %`
