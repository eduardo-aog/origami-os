import { on } from '../events'
import { confirmWindowDiscard, isWindowDirty } from '../dialogs/unsaved'
import { session } from '../session'
import { windowsStore, type WindowRecord } from './store'

export { windowsStore } from './store'
export type { WindowMode, WindowRecord, WindowState, WorkArea } from './store'

/** Lo que dura la animación de cierre de una ventana. */
const CLOSE_ANIMATION_MS = 160

// Los íconos del Dock se registran aquí para que las ventanas se minimicen hacia el suyo.
const dockTargets = new Map<string, () => { x: number; y: number } | null>()
const pendingClose = new Set<string>()
let initialized = false

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function registerDockTarget(key: string, locate: () => { x: number; y: number } | null): () => void {
  dockTargets.set(key, locate)
  return () => {
    if (dockTargets.get(key) === locate) dockTargets.delete(key)
  }
}

export function minimizeWindow(id: string): void {
  const window = windowsStore.get(id)
  if (!window) return
  windowsStore.minimize(id, dockTargets.get(window.appId)?.() ?? null)
}

/** Cierra una ventana respetando el flujo de cambios sin guardar. `false` si se canceló. */
export async function closeWindow(id: string): Promise<boolean> {
  const window = windowsStore.get(id)
  if (!window || window.closing || pendingClose.has(id)) return false
  pendingClose.add(id)
  try {
    if (!(await confirmWindowDiscard(id))) return false
  } finally {
    pendingClose.delete(id)
  }
  windowsStore.markClosing(id)
  await wait(CLOSE_ANIMATION_MS)
  windowsStore.remove(id)
  return true
}

/** Cierra todas las ventanas de una app, una por una. Se detiene si el usuario cancela alguna. */
export async function closeApp(appId: string): Promise<boolean> {
  for (const window of windowsStore.byApp(appId)) {
    if (!(await closeWindow(window.id))) return false
  }
  return true
}

function closeAllImmediately(): void {
  for (const window of windowsStore.getState().windows) windowsStore.remove(window.id)
}

function dirtyWindows(): WindowRecord[] {
  return windowsStore
    .getState()
    .windows.filter((window) => isWindowDirty(window.id))
    .sort((a, b) => b.zIndex - a.zIndex)
}

/**
 * Conecta las ventanas con la sesión: antes de cerrar sesión, reiniciar o apagar se recorren las
 * ventanas con cambios sin guardar una por una (cancelar cualquiera aborta la acción), y al terminar
 * la sesión se cierran todas. Es seguro llamarla varias veces.
 */
export function initWindows(): void {
  if (initialized) return
  initialized = true
  session.registerSessionEndGuard(async () => {
    for (const window of dirtyWindows()) {
      windowsStore.focus(window.id)
      if (!(await confirmWindowDiscard(window.id))) return false
    }
    return true
  })
  on('session:logout', closeAllImmediately)
  on('power:restart', closeAllImmediately)
  on('power:shutdown', closeAllImmediately)
}
