import type { EventData, EventName } from './types'

export type { EventData, EventMap, EventName, FsChangedEvent, FsChangeKind } from './types'

type Handler<E extends EventName> = (data: EventData<E>) => void

const listeners = new Map<EventName, Set<Handler<EventName>>>()

/** Suscribe un manejador a un evento. Devuelve la función que cancela la suscripción. */
export function on<E extends EventName>(event: E, handler: Handler<E>): () => void {
  const set = listeners.get(event) ?? new Set<Handler<EventName>>()
  set.add(handler as Handler<EventName>)
  listeners.set(event, set)
  return () => {
    set.delete(handler as Handler<EventName>)
  }
}

/** Publica un evento. Un manejador que falla no impide que los demás lo reciban. */
export function emit<E extends EventName>(event: E, data: EventData<E>): void {
  const set = listeners.get(event)
  if (!set) return
  for (const handler of [...set]) {
    try {
      handler(data)
    } catch (error) {
      console.error(`[eventos] Falló un manejador de "${event}":`, error)
    }
  }
}
