export const ROOT_ID = 'root'
export const TRASH_ID = 'trash'
export const TRASH_NAME = '.Papelera'
export const USERS_DIR = 'Usuarios'
export const MAX_NAME_LENGTH = 255

/** Devuelve el motivo por el que `name` no es un nombre válido, o `null` si lo es. */
export function validateNodeName(name: string): string | null {
  if (name.trim() === '') return 'El nombre no puede estar vacío.'
  if (name === '.' || name === '..') return `"${name}" no es un nombre válido.`
  if (name.includes('/')) return 'El nombre no puede contener "/".'
  if (name.includes('\0')) return 'El nombre contiene caracteres no válidos.'
  if (name.length > MAX_NAME_LENGTH) return `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`
  return null
}

/** Segmentos de una ruta ya expandida: ignora vacíos y ".", y resuelve "..". */
export function pathSegments(path: string): string[] {
  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  return segments
}

/** Une segmentos en una ruta absoluta normalizada. */
export function joinPath(...parts: string[]): string {
  return `/${pathSegments(parts.join('/')).join('/')}`
}

export function parentPath(path: string): string {
  const segments = pathSegments(path)
  segments.pop()
  return `/${segments.join('/')}`
}

export function baseName(path: string): string {
  return pathSegments(path).pop() ?? ''
}
