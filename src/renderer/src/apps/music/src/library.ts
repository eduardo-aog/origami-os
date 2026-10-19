import type { FsApi, FsNode } from '@os/sdk'

/** Los de la asociación del manifiesto más `webm`, que es el formato de la Grabadora de voz (`~/Música/Grabaciones`). */
export const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'webm']

const LIBRARY_ROOT = '~/Música'

export interface Track {
  path: string
  title: string
  /** Nombre de la carpeta que la contiene, para distinguir discos o grabaciones. */
  folder: string
}

const MAX_DEPTH = 8

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export const isAudioName = (name: string) => AUDIO_EXTENSIONS.includes(extensionOf(name))

export function titleOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path

export function trackFromPath(path: string): Track {
  const parts = path.split('/').filter(Boolean)
  return { path, title: titleOf(parts[parts.length - 1] ?? path), folder: parts[parts.length - 2] ?? '' }
}

const byName = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true })

/** Recorre `~/Música` de forma recursiva y devuelve sus pistas ordenadas por carpeta y nombre. */
export async function scanLibrary(fs: Pick<FsApi, 'list' | 'stat' | 'pathOf'>): Promise<Track[]> {
  const found: Track[] = []
  let root: string
  try {
    // Rutas absolutas, para poder reconocer los archivos que otras apps piden abrir.
    root = await fs.pathOf((await fs.stat(LIBRARY_ROOT)).id)
  } catch {
    return found
  }

  async function walk(folder: string, depth: number): Promise<void> {
    let children: FsNode[]
    try {
      children = await fs.list(folder)
    } catch {
      return
    }
    for (const child of children) {
      const path = `${folder}/${child.name}`
      if (child.kind === 'folder') {
        if (depth < MAX_DEPTH) await walk(path, depth + 1)
      } else if (isAudioName(child.name)) {
        found.push(trackFromPath(path))
      }
    }
  }

  await walk(root, 0)
  return found.sort((a, b) => byName(a.folder, b.folder) || byName(a.title, b.title))
}

/** Pistas cuyo título o carpeta contienen el texto, sin distinguir mayúsculas ni tildes. */
export function filterTracks(tracks: Track[], query: string): Track[] {
  const needle = normalize(query)
  if (needle === '') return tracks
  return tracks.filter((track) => normalize(`${track.title} ${track.folder}`).includes(needle))
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
