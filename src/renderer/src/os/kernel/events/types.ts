import type { SettingKey } from '../settings/schema'

type Empty = Record<string, never>

export type FsChangeKind = 'create' | 'update' | 'delete' | 'move' | 'trash' | 'restore'

export interface FsChangedEvent {
  kind: FsChangeKind
  nodeId: string
  /** Carpeta que contiene al nodo tras el cambio (o que lo contenía, si se eliminó). */
  parentId: string
  /** Carpeta de origen en `move`, `trash` y `restore`. */
  oldParentId?: string
}

/** Mapa tipado de eventos del sistema. Los eventos nuevos se agregan aquí y en la sección 4.4 de la especificación. */
export interface EventMap {
  'fs:changed': FsChangedEvent
  'settings:changed': { key: SettingKey; value: unknown }
  'session:locked': Empty
  'session:unlocked': Empty
  'session:logout': Empty
  'power:restart': Empty
  'power:shutdown': Empty
  'app:launched': { appId: string; instanceId: string }
  'app:terminated': { appId: string; instanceId: string }
  'window:opened': { windowId: string; appId: string }
  'window:closed': { windowId: string; appId: string }
  'window:focused': { windowId: string; appId: string }
  'notification:posted': { id: string; appId: string }
  'media:active': { camera: boolean; microphone: boolean }
  'scheduler:fired': { jobId: string; appId: string }
}

export type EventName = keyof EventMap
export type EventData<E extends EventName> = EventMap[E]
