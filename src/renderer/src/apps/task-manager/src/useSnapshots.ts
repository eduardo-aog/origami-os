import { useEffect, useState } from 'react'
import { useProcesses, type ProcessInfo } from '@os/sdk'

/** Cuántos segundos de historia guardan las gráficas. */
export const HISTORY_SECONDS = 60

interface Stats {
  cpu: number
  memoryUsedMB: number
  memoryTotalMB: number
}

export interface Snapshot {
  processes: ProcessInfo[]
  stats: Stats
  /** CPU total en porcentaje y memoria usada en MB, de la muestra más antigua a la más reciente. */
  cpuHistory: number[]
  memoryHistory: number[]
}

/**
 * Procesos y métricas al día (una vez por segundo y al abrirse o cerrarse una app) con el historial
 * de los últimos 60 s. Las métricas son simuladas y deterministas, así que al abrir la app el
 * historial se reconstruye de inmediato en lugar de empezar vacío.
 */
export function useSnapshots(): Snapshot {
  const { list, stats, subscribe } = useProcesses()

  const [snapshot, setSnapshot] = useState<Snapshot>(() => {
    const now = Date.now()
    const past = Array.from({ length: HISTORY_SECONDS }, (_, index) => stats(now - (HISTORY_SECONDS - 1 - index) * 1000))
    return {
      processes: list(now),
      stats: stats(now),
      cpuHistory: past.map((sample) => sample.cpu),
      memoryHistory: past.map((sample) => sample.memoryUsedMB)
    }
  })

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      const current = stats(now)
      setSnapshot((previous) => ({
        processes: list(now),
        stats: current,
        cpuHistory: [...previous.cpuHistory.slice(1 - HISTORY_SECONDS), current.cpu],
        memoryHistory: [...previous.memoryHistory.slice(1 - HISTORY_SECONDS), current.memoryUsedMB]
      }))
    }
    // Al abrirse o cerrarse una app solo cambia la lista; la historia sigue a su ritmo.
    const refresh = () => {
      const now = Date.now()
      setSnapshot((previous) => ({ ...previous, processes: list(now), stats: stats(now) }))
    }
    const timer = setInterval(tick, 1000)
    const stop = subscribe(refresh)
    return () => {
      clearInterval(timer)
      stop()
    }
  }, [list, stats, subscribe])

  return snapshot
}
