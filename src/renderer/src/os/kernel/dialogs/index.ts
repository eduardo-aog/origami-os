import { createStore } from 'zustand/vanilla'
import { on } from '../events'
import { windowsStore } from '../windows/store'
import type {
  DialogKind,
  DialogOptions,
  DialogRequest,
  DialogResult,
  DialogScope,
  ScopedDialogs
} from './types'

export type { DialogRequest, DialogScope, DialogsApi, ScopedDialogs } from './types'

const store = createStore<{ queue: readonly DialogRequest[] }>(() => ({ queue: [] }))

/** Lo que recibe quien espera un diálogo que se cancela porque su ventana se cerró. */
const CANCELLED: { [K in DialogKind]: DialogResult<K> } = {
  alert: undefined,
  confirm: false,
  prompt: null,
  choose: null,
  openFile: null,
  saveFile: null,
  unsaved: 'cancel',
  about: undefined,
  info: undefined
}

const sameScope = (a: DialogScope, b: DialogScope) =>
  a.type === b.type && (a.type === 'system' || (b.type === 'window' && a.windowId === b.windowId))

/** Mantiene `hasSheet` de cada ventana en sintonía con los diálogos pendientes. */
function syncSheets(): void {
  const withSheet = new Set(
    store.getState().queue.flatMap((request) => (request.scope.type === 'window' ? [request.scope.windowId] : []))
  )
  for (const window of windowsStore.getState().windows) {
    windowsStore.setHasSheet(window.id, withSheet.has(window.id))
  }
}

function ask<K extends DialogKind>(
  scope: DialogScope,
  kind: K,
  options: DialogOptions<K>
): Promise<DialogResult<K>> {
  return new Promise((resolve) => {
    if (scope.type === 'window' && !windowsStore.get(scope.windowId)) {
      resolve(CANCELLED[kind])
      return
    }
    const request = { id: crypto.randomUUID(), scope, kind, options, resolve } as DialogRequest
    store.setState((state) => ({ queue: [...state.queue, request] }))
    syncSheets()
  })
}

function createApi(scope: DialogScope): ScopedDialogs {
  return {
    alert: (options) => ask(scope, 'alert', options),
    confirm: (options) => ask(scope, 'confirm', options),
    prompt: (options) => ask(scope, 'prompt', options),
    choose: ((options: DialogOptions<'choose'>) => ask(scope, 'choose', options)) as ScopedDialogs['choose'],
    openFile: (options = {}) => ask(scope, 'openFile', options),
    saveFile: (options = {}) => ask(scope, 'saveFile', options),
    unsaved: (documentName) => ask(scope, 'unsaved', { documentName }),
    about: (appId) => ask(scope, 'about', { appId }),
    info: (nodeId) => ask(scope, 'info', { nodeId })
  }
}

const systemApi = createApi({ type: 'system' })

export const dialogs = {
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  /** Diálogos modales de sistema: centrados y bloquean todo. */
  system: systemApi,

  /** Diálogos modales de ventana: aparecen como hoja y bloquean solo esa ventana. */
  forWindow(windowId: string): ScopedDialogs {
    return createApi({ type: 'window', windowId })
  },

  /** Primer diálogo pendiente de un ámbito (el que se está mostrando). */
  active(scope: DialogScope): DialogRequest | undefined {
    return store.getState().queue.find((request) => sameScope(request.scope, scope))
  },

  /** Cierra un diálogo entregando su resultado a quien lo esperaba. */
  settle<K extends DialogKind>(request: Extract<DialogRequest, { kind: K }>, result: DialogResult<K>): void {
    if (!store.getState().queue.includes(request)) return
    store.setState((state) => ({ queue: state.queue.filter((item) => item !== request) }))
    syncSheets()
    ;(request.resolve as (result: DialogResult<K>) => void)(result)
  },

  /** Descarta (como cancelados) los diálogos pendientes de una ventana. */
  cancelForWindow(windowId: string): void {
    const doomed = store
      .getState()
      .queue.filter((request) => request.scope.type === 'window' && request.scope.windowId === windowId)
    if (doomed.length === 0) return
    store.setState((state) => ({ queue: state.queue.filter((request) => !doomed.includes(request)) }))
    for (const request of doomed) {
      ;(request.resolve as (result: unknown) => void)(CANCELLED[request.kind])
    }
  }
}

on('window:closed', ({ windowId }) => dialogs.cancelForWindow(windowId))
