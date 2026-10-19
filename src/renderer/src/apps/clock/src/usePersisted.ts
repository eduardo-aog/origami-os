import { useCallback, useEffect, useState } from 'react'
import { useOS } from '@os/sdk'

/** Valor guardado en el `appData` de la app. `loaded` indica si ya se leyó; hasta entonces vale `fallback`. */
export function usePersisted<T>(key: string, fallback: T): { value: T; loaded: boolean; save: (next: T) => Promise<void> } {
  const { storage } = useOS()
  const [initial] = useState(fallback)
  const [state, setState] = useState({ loaded: false, value: initial })

  useEffect(() => {
    let active = true
    storage.get<T>(key).then((saved) => {
      if (active) setState({ loaded: true, value: saved ?? initial })
    })
    return () => {
      active = false
    }
  }, [storage, key, initial])

  const save = useCallback(
    async (next: T) => {
      setState({ loaded: true, value: next })
      await storage.set(key, next)
    },
    [storage, key]
  )

  return { value: state.value, loaded: state.loaded, save }
}
