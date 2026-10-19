import { createStore } from 'zustand/vanilla'
import type { LaunchArgs } from '../apps/types'
import { emit } from '../events'
import { sound } from '../sound'

export interface NotificationInput {
  appId: string
  title: string
  body?: string
  /** `false` para publicarla sin el sonido "notification". */
  sound?: boolean
  /** Argumentos con los que se lanza la app al hacer clic en la notificación. */
  launchArgs?: LaunchArgs
}

export interface NotificationItem {
  id: string
  appId: string
  title: string
  body?: string
  launchArgs?: LaunchArgs
  createdAt: number
}

/** Cuántas notificaciones sin descartar se conservan; las más antiguas se eliminan. */
const MAX_ACTIVE = 20

const store = createStore<{ items: NotificationItem[] }>(() => ({ items: [] }))

export const notifications = {
  post(input: NotificationInput): string {
    const item: NotificationItem = {
      id: crypto.randomUUID(),
      appId: input.appId,
      title: input.title,
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.launchArgs !== undefined ? { launchArgs: input.launchArgs } : {}),
      createdAt: Date.now()
    }
    store.setState((state) => ({ items: [...state.items, item].slice(-MAX_ACTIVE) }))
    if (input.sound !== false) sound.play('notification')
    emit('notification:posted', { id: item.id, appId: item.appId })
    return item.id
  },

  dismiss(id: string): void {
    store.setState((state) => ({ items: state.items.filter((item) => item.id !== id) }))
  },

  /** Notificaciones activas, de la más antigua a la más reciente. */
  list(): readonly NotificationItem[] {
    return store.getState().items
  },

  subscribe(listener: (items: readonly NotificationItem[]) => void): () => void {
    return store.subscribe((state) => listener(state.items))
  }
}
