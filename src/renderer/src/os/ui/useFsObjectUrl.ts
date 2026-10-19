import { useEffect, useState } from 'react'
import { fs } from '../kernel/fs'

interface Loaded {
  path: string
  url: string | null
  error: string | null
}

/**
 * URL de objeto de un archivo del sistema de archivos, para el `src` de imágenes, audio y video
 * (la CSP no permite `fetch` sobre `blob:`). Se libera sola al cambiar de archivo o desmontar.
 * Mientras carga, `url` y `error` son `null`.
 */
export function useFsObjectUrl(path: string | null): { url: string | null; error: string | null } {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    let handle: { url: string; revoke(): void } | null = null
    fs.getObjectUrl(path)
      .then((result) => {
        if (cancelled) {
          result.revoke()
          return
        }
        handle = result
        setLoaded({ path, url: result.url, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded({ path, url: null, error: error instanceof Error ? error.message : String(error) })
      })
    return () => {
      cancelled = true
      handle?.revoke()
    }
  }, [path])

  return loaded !== null && loaded.path === path
    ? { url: loaded.url, error: loaded.error }
    : { url: null, error: null }
}
