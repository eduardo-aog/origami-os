import { useStore } from 'zustand'
import { session, type SessionState } from '.'

/** Estado reactivo de la sesión; acepta un selector para suscribirse solo a una parte. */
export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(session, selector)
}
