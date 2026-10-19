import type { FsNode } from '../kernel/fs'

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${value.toLocaleString('es', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

/** Descripción corta del tipo de un elemento: "Carpeta", "Imagen", "Texto"… */
export function describeKind(node: Pick<FsNode, 'kind' | 'mime' | 'name'>): string {
  if (node.kind === 'folder') return 'Carpeta'
  if (node.mime.startsWith('image/')) return 'Imagen'
  if (node.mime.startsWith('audio/')) return 'Audio'
  if (node.mime.startsWith('video/')) return 'Video'
  if (node.mime === 'text/x-python') return 'Python'
  if (node.mime.startsWith('text/')) return 'Texto'
  const dot = node.name.lastIndexOf('.')
  return dot > 0 ? `Archivo ${node.name.slice(dot + 1).toUpperCase()}` : 'Archivo'
}

/** Duración en segundos como `m:ss` (o `h:mm:ss` a partir de una hora); `--:--` si no es un número válido. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = String(total % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
