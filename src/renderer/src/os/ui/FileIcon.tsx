import folderUrl from '@system/icons/folder.svg'
import folderSystemUrl from '@system/icons/folder-system.svg'
import audioUrl from '@system/icons/file-audio.svg'
import genericUrl from '@system/icons/file-generic.svg'
import imageUrl from '@system/icons/file-image.svg'
import pythonUrl from '@system/icons/file-python.svg'
import textUrl from '@system/icons/file-text.svg'
import videoUrl from '@system/icons/file-video.svg'

export interface FileIconProps {
  kind: 'file' | 'folder'
  mime?: string
  /** Las carpetas del sistema tienen su propio ícono. */
  system?: boolean
  size?: number
}

export function fileIconUrl({ kind, mime = '', system = false }: Omit<FileIconProps, 'size'>): string {
  if (kind === 'folder') return system ? folderSystemUrl : folderUrl
  if (mime.startsWith('image/')) return imageUrl
  if (mime.startsWith('audio/')) return audioUrl
  if (mime.startsWith('video/')) return videoUrl
  // Python va antes que el resto de `text/*`: tiene su propio ícono.
  if (mime === 'text/x-python') return pythonUrl
  if (mime.startsWith('text/')) return textUrl
  return genericUrl
}

export function FileIcon({ size = 20, ...node }: FileIconProps) {
  return <img src={fileIconUrl(node)} width={size} height={size} alt="" draggable={false} />
}
