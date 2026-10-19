import { createStore } from 'zustand/vanilla'
import type { AppManifest } from '../apps/manifest.schema'
import type { LaunchArgs } from '../apps/types'
import { emit } from '../events'

export type WindowMode = 'normal' | 'minimized' | 'maximized'

/** Estado de una ventana (sección 4.10). */
export interface WindowState {
  id: string
  appId: string
  instanceId: string
  title: string
  x: number
  y: number
  width: number
  height: number
  state: WindowMode
  zIndex: number
  focused: boolean
  /** Hay un diálogo modal de ventana abierto. */
  hasSheet: boolean
}

/** `WindowState` más lo que necesita el marco de ventana. x, y, width y height son siempre los del estado normal. */
export interface WindowRecord extends WindowState {
  minWidth: number
  minHeight: number
  resizable: boolean
  launchArgs: LaunchArgs
  /** Aumenta cada vez que una app de instancia única recibe argumentos nuevos. */
  argsVersion: number
  /** Modo al que vuelve la ventana al restaurarse de minimizada. */
  restoreMode: 'normal' | 'maximized'
  /** Centro del ícono del Dock hacia el que se minimizó. */
  minimizeTarget: { x: number; y: number } | null
  closing: boolean
}

/** Zona libre entre la barra de menú (arriba) y el Dock (abajo). */
export interface WorkArea {
  top: number
  bottom: number
}

interface WindowsState {
  windows: readonly WindowRecord[]
  workArea: WorkArea
}

const store = createStore<WindowsState>(() => ({ windows: [], workArea: { top: 28, bottom: 96 } }))

const Z_BASE = 100
const Z_RENUMBER_AT = 5000
let zCounter = Z_BASE
let cascadeStep = 0

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

function update(id: string, change: (window: WindowRecord) => WindowRecord): void {
  store.setState((state) => ({
    windows: state.windows.map((window) => (window.id === id ? change(window) : window))
  }))
}

function nextZ(): number {
  if (zCounter > Z_RENUMBER_AT) {
    const ordered = [...store.getState().windows].sort((a, b) => a.zIndex - b.zIndex)
    zCounter = Z_BASE
    const renumbered = new Map(ordered.map((window) => [window.id, ++zCounter]))
    store.setState((state) => ({
      windows: state.windows.map((window) => ({ ...window, zIndex: renumbered.get(window.id) ?? window.zIndex }))
    }))
  }
  return ++zCounter
}

function initialBounds(manifest: AppManifest): Pick<WindowState, 'x' | 'y' | 'width' | 'height'> {
  const { workArea } = store.getState()
  const viewportWidth = window.innerWidth
  const available = window.innerHeight - workArea.top - workArea.bottom
  const width = Math.min(manifest.window.width, viewportWidth - 24)
  const height = Math.min(manifest.window.height, available)
  const step = 30 * (cascadeStep++ % 8)
  return {
    width,
    height,
    x: clamp(Math.round((viewportWidth - width) / 2) - 120 + step, 0, viewportWidth - width),
    y: clamp(workArea.top + 20 + step, workArea.top, workArea.top + available - height)
  }
}

export const windowsStore = {
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  get(id: string): WindowRecord | undefined {
    return store.getState().windows.find((window) => window.id === id)
  },

  byInstance(instanceId: string): WindowRecord | undefined {
    return store.getState().windows.find((window) => window.instanceId === instanceId)
  },

  byApp(appId: string): WindowRecord[] {
    return store.getState().windows.filter((window) => window.appId === appId && !window.closing)
  },

  /** Ventanas visibles de la más alta a la más baja. */
  stacking(): WindowRecord[] {
    return store
      .getState()
      .windows.filter((window) => window.state !== 'minimized' && !window.closing)
      .sort((a, b) => b.zIndex - a.zIndex)
  },

  /** Actualiza la zona libre; la barra de menú fija `top` y el Dock fija `bottom`. */
  setWorkArea(change: Partial<WorkArea>): void {
    const current = store.getState().workArea
    const next = { ...current, ...change }
    if (current.top !== next.top || current.bottom !== next.bottom) store.setState({ workArea: next })
  },

  open(manifest: AppManifest, launchArgs: LaunchArgs): WindowRecord {
    const bounds = initialBounds(manifest)
    const record: WindowRecord = {
      id: crypto.randomUUID(),
      appId: manifest.id,
      instanceId: crypto.randomUUID(),
      title: manifest.name,
      ...bounds,
      state: 'normal',
      zIndex: nextZ(),
      focused: false,
      hasSheet: false,
      minWidth: Math.min(manifest.window.minWidth, bounds.width),
      minHeight: Math.min(manifest.window.minHeight, bounds.height),
      resizable: manifest.window.resizable,
      launchArgs,
      argsVersion: 0,
      restoreMode: 'normal',
      minimizeTarget: null,
      closing: false
    }
    store.setState((state) => ({ windows: [...state.windows, record] }))
    emit('app:launched', { appId: record.appId, instanceId: record.instanceId })
    emit('window:opened', { windowId: record.id, appId: record.appId })
    windowsStore.focus(record.id)
    return windowsStore.get(record.id) ?? record
  },

  /** Da el foco a una ventana (y la restaura si estaba minimizada). `null` quita el foco a todas. */
  focus(id: string | null): void {
    const target = id === null ? undefined : windowsStore.get(id)
    if (id !== null && (!target || target.closing)) return
    const alreadyFocused = target?.focused === true && target.state !== 'minimized'
    if (alreadyFocused) return
    const topZ = nextZ()
    store.setState((state) => ({
      windows: state.windows.map((window) => {
        if (window.id !== id) return window.focused ? { ...window, focused: false } : window
        return {
          ...window,
          focused: true,
          zIndex: topZ,
          state: window.state === 'minimized' ? window.restoreMode : window.state,
          minimizeTarget: null
        }
      })
    }))
    if (target) emit('window:focused', { windowId: target.id, appId: target.appId })
  },

  /** Enfoca la ventana visible más alta (o ninguna). */
  focusTop(): void {
    windowsStore.focus(windowsStore.stacking()[0]?.id ?? null)
  },

  minimize(id: string, target: { x: number; y: number } | null): void {
    const window = windowsStore.get(id)
    if (!window || window.state === 'minimized') return
    update(id, (current) => ({
      ...current,
      state: 'minimized',
      restoreMode: current.state === 'maximized' ? 'maximized' : 'normal',
      minimizeTarget: target,
      focused: false
    }))
    windowsStore.focusTop()
  },

  toggleMaximize(id: string): void {
    const window = windowsStore.get(id)
    if (!window || !window.resizable || window.state === 'minimized') return
    update(id, (current) => ({ ...current, state: current.state === 'maximized' ? 'normal' : 'maximized' }))
  },

  move(id: string, x: number, y: number): void {
    update(id, (current) => ({ ...current, x, y }))
  },

  resize(id: string, bounds: Pick<WindowState, 'x' | 'y' | 'width' | 'height'>): void {
    update(id, (current) => ({ ...current, ...bounds }))
  },

  setTitle(id: string, title: string): void {
    update(id, (current) => ({ ...current, title }))
  },

  setHasSheet(id: string, hasSheet: boolean): void {
    update(id, (current) => (current.hasSheet === hasSheet ? current : { ...current, hasSheet }))
  },

  /** Entrega argumentos nuevos a una ventana ya abierta (apps de instancia única). */
  deliverArgs(id: string, launchArgs: LaunchArgs): void {
    update(id, (current) => ({ ...current, launchArgs, argsVersion: current.argsVersion + 1 }))
  },

  markClosing(id: string): void {
    update(id, (current) => ({ ...current, closing: true, focused: false }))
    windowsStore.focusTop()
  },

  /** Quita la ventana de inmediato y publica `window:closed` y `app:terminated`. */
  remove(id: string): void {
    const window = windowsStore.get(id)
    if (!window) return
    store.setState((state) => ({ windows: state.windows.filter((current) => current.id !== id) }))
    emit('window:closed', { windowId: window.id, appId: window.appId })
    emit('app:terminated', { appId: window.appId, instanceId: window.instanceId })
    windowsStore.focusTop()
  }
}
