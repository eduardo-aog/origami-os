export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov']

export const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path
export const folderOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/'

export function isVideoName(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && VIDEO_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase())
}

export function titleOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es', { numeric: true })

export const joinPath = (folder: string, name: string) => `${folder === '/' ? '' : folder}/${name}`

export const SEEK_STEP_S = 5
export const VOLUME_STEP = 0.05
