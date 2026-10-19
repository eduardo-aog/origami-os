import { useEffect, useState } from 'react'
import { fs } from '../kernel/fs'

/** URL de objeto de una imagen guardada en el sistema de archivos; `null` mientras carga o si falla. */
export function useFsImageUrl(nodeId: string | null): string | null {
  const [loaded, setLoaded] = useState<{ nodeId: string; url: string } | null>(null)

  useEffect(() => {
    if (nodeId === null) return
    let cancelled = false
    let handle: { url: string; revoke(): void } | null = null
    fs.pathOf(nodeId)
      .then((path) => fs.getObjectUrl(path))
      .then((result) => {
        if (cancelled) {
          result.revoke()
          return
        }
        handle = result
        setLoaded({ nodeId, url: result.url })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      handle?.revoke()
    }
  }, [nodeId])

  return loaded !== null && loaded.nodeId === nodeId ? loaded.url : null
}
