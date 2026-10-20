import { useSyncExternalStore } from 'react'
import { useProcesses, type SystemSnapshot } from '@os/sdk'

/** La simulación del sistema, al día en cada tick. */
export function useSnapshot(): SystemSnapshot {
  const { subscribe, getSnapshot } = useProcesses()
  return useSyncExternalStore(subscribe, getSnapshot)
}
