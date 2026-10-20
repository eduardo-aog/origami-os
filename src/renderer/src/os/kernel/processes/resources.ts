import type { ResourceId, SyncResourceInfo } from './types'

interface Resource {
  id: ResourceId
  name: string
  capacity: number
  lab: boolean
  holders: number[]
  queue: number[]
}

function create(id: ResourceId, name: string, capacity: number, lab = false): Resource {
  return { id, name, capacity, lab, holders: [], queue: [] }
}

/**
 * Recursos compartidos. Un mutex es un semáforo de capacidad 1: solo un proceso a la vez puede estar
 * en su sección crítica; los demás esperan en la cola, en orden de llegada.
 */
const resources = new Map<ResourceId, Resource>([
  ['disk-bus', create('disk-bus', 'Bus del disco', 1)],
  ['audio-mixer', create('audio-mixer', 'Canales de audio', 2)],
  ['frame-buffer', create('frame-buffer', 'Búfer de pantalla', 1)],
  ['lab-a', create('lab-a', 'Recurso A', 1, true)],
  ['lab-b', create('lab-b', 'Recurso B', 1, true)]
])

function get(id: ResourceId): Resource {
  const resource = resources.get(id)
  if (!resource) throw new Error(`Recurso desconocido: ${id}`)
  return resource
}

export const syncResources = {
  name: (id: ResourceId): string => get(id).name,

  kindOf: (id: ResourceId): 'mutex' | 'semaphore' => (get(id).capacity === 1 ? 'mutex' : 'semaphore'),

  /** `wait`: pide el recurso (`P`). Devuelve `true` si lo obtuvo y `false` si el proceso quedó en la cola. */
  wait(id: ResourceId, pid: number): boolean {
    const resource = get(id)
    if (resource.holders.length < resource.capacity) {
      resource.holders.push(pid)
      return true
    }
    resource.queue.push(pid)
    return false
  },

  /** `signal`: libera el recurso (`V`). Devuelve el PID del primero de la cola, que pasa a ser el nuevo dueño. */
  signal(id: ResourceId, pid: number): number | undefined {
    const resource = get(id)
    const index = resource.holders.indexOf(pid)
    if (index === -1) return undefined
    resource.holders.splice(index, 1)
    const next = resource.queue.shift()
    if (next !== undefined) resource.holders.push(next)
    return next
  },

  /** Saca al proceso de todas las colas y libera lo que tenía. Devuelve los procesos que ganaron un recurso. */
  purge(pid: number): { pid: number; resource: ResourceId }[] {
    const woken: { pid: number; resource: ResourceId }[] = []
    for (const resource of resources.values()) {
      resource.queue = resource.queue.filter((queued) => queued !== pid)
      const next = syncResources.signal(resource.id, pid)
      if (next !== undefined) woken.push({ pid: next, resource: resource.id })
    }
    return woken
  },

  /** Recursos que el proceso posee, o los que espera si `queued` es `true`. */
  of(pid: number, queued = false): ResourceId[] {
    return [...resources.values()]
      .filter((resource) => (queued ? resource.queue : resource.holders).includes(pid))
      .map((resource) => resource.id)
  },

  /** Dueños actuales de un recurso. */
  holders: (id: ResourceId): readonly number[] => get(id).holders,

  info(nameOf: (pid: number) => string): SyncResourceInfo[] {
    return [...resources.values()].map((resource) => ({
      id: resource.id,
      name: resource.name,
      kind: syncResources.kindOf(resource.id),
      capacity: resource.capacity,
      available: resource.capacity - resource.holders.length,
      holders: resource.holders.map((pid) => ({ pid, name: nameOf(pid) })),
      queue: resource.queue.map((pid) => ({ pid, name: nameOf(pid) })),
      lab: resource.lab
    }))
  }
}
