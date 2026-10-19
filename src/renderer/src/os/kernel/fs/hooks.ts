import { useEffect, useState } from 'react'
import { on } from '../events'
import { fs } from '.'
import type { FsNode } from './types'

/** Lista vacía compartida: devolver siempre la misma evita que quien depende de ella se redibuje sin fin mientras carga. */
const NO_NODES: FsNode[] = []

/** Contenido de una carpeta e indicación de si ya terminó de cargar. Se actualiza solo cuando cambia el sistema de archivos. */
export function useFsFolderState(path: string): { nodes: FsNode[]; loaded: boolean } {
  const [state, setState] = useState<{ path: string; nodes: FsNode[] } | null>(null)

  useEffect(() => {
    let active = true
    const refresh = () => {
      fs.list(path)
        .then((nodes) => active && setState({ path, nodes }))
        .catch(() => active && setState({ path, nodes: [] }))
    }
    refresh()
    const stop = on('fs:changed', refresh)
    return () => {
      active = false
      stop()
    }
  }, [path])

  return state !== null && state.path === path
    ? { nodes: state.nodes, loaded: true }
    : { nodes: NO_NODES, loaded: false }
}

/** Contenido de una carpeta (como `fs.list`), que se actualiza solo cuando cambia el sistema de archivos. */
export function useFsFolder(path: string): FsNode[] {
  return useFsFolderState(path).nodes
}

/** Elementos de la papelera (como `fs.listTrash`), que se actualizan solos cuando cambia el sistema de archivos. */
export function useFsTrash(): { nodes: FsNode[]; loaded: boolean } {
  const [state, setState] = useState<FsNode[] | null>(null)

  useEffect(() => {
    let active = true
    const refresh = () => {
      fs.listTrash()
        .then((nodes) => active && setState(nodes))
        .catch(() => active && setState([]))
    }
    refresh()
    const stop = on('fs:changed', refresh)
    return () => {
      active = false
      stop()
    }
  }, [])

  return { nodes: state ?? NO_NODES, loaded: state !== null }
}
