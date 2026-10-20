import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { registerOpenFileHandler } from '../kernel/apps/launcher'
import { getApp, type LaunchArgs } from '../kernel/apps'
import { dialogs } from '../kernel/dialogs'
import {
  confirmWindowDiscard,
  isWindowDirty,
  registerUnsaved,
  unregisterUnsaved,
  type UnsavedOptions
} from '../kernel/dialogs/unsaved'
import { useFsFolder } from '../kernel/fs/hooks'
import type { FsNode } from '../kernel/fs'
import { menus, type AppMenu } from '../kernel/menus'
import { peripherals } from '../kernel/peripherals'
import { processes } from '../kernel/processes'
import { session, type SessionUser } from '../kernel/session'
import { useSession } from '../kernel/session/hooks'
import type { Avatar } from '../kernel/storage'
import { useSettingValue } from '../kernel/settings/hooks'
import type { SettingKey, SettingValue } from '../kernel/settings'
import { sound } from '../kernel/sound'
import { closeWindow } from '../kernel/windows'
import { useWindows } from '../kernel/windows/hooks'
import { windowsStore } from '../kernel/windows/store'
import { assertPermission, useAppInstance } from './use-os'

const NO_ARGS: LaunchArgs = {}

/** Argumentos con los que se lanzó la app; se actualizan si una app de instancia única recibe otros nuevos. */
export function useLaunchArgs(): LaunchArgs {
  const { instanceId } = useAppInstance()
  return useWindows((state) => state.windows.find((window) => window.instanceId === instanceId)?.launchArgs ?? NO_ARGS)
}

/** Las apps de instancia única reciben aquí los archivos que se abren estando ya abiertas. */
export function useOpenFileHandler(handler: (path: string) => void): void {
  const { instanceId } = useAppInstance()
  useEffect(() => registerOpenFileHandler(instanceId, handler), [instanceId, handler])
}

export function useSetting<K extends SettingKey>(key: K): SettingValue<K> {
  return useSettingValue(key)
}

/** Volumen del sistema entre 0 y 1; ya considera "silenciado". */
export function useSystemVolume(): number {
  return useSyncExternalStore(
    (onChange) => sound.subscribeVolume(onChange),
    () => sound.getVolume()
  )
}

/** Lista reactiva de una carpeta. */
export function useFsWatch(path: string): FsNode[] {
  return useFsFolder(path)
}

/** Declara los menús de la app que aparecen en la barra superior mientras su ventana tiene el foco. */
export function useAppMenus(appMenus: AppMenu[]): void {
  const { instanceId } = useAppInstance()
  useEffect(() => {
    menus.set(instanceId, appMenus)
  })
  useEffect(() => () => menus.clear(instanceId), [instanceId])
}

/**
 * Avisa al sistema de que la ventana tiene cambios sin guardar. Es el sistema, no la app, quien
 * pregunta qué hacer al cerrar. Devuelve `confirmDiscard`, para las acciones propias de la app
 * que descartarían los cambios (por ejemplo "Nuevo"): `false` significa que hay que abortar.
 */
export function useUnsavedChanges(options: UnsavedOptions): { confirmDiscard: () => Promise<boolean> } {
  const { windowId } = useAppInstance()
  useEffect(() => {
    registerUnsaved(windowId, options)
  })
  useEffect(() => () => unregisterUnsaved(windowId), [windowId])
  return { confirmDiscard: () => confirmWindowDiscard(windowId) }
}

export interface ProcessesApi {
  /** Estado de la simulación; cambia en cada tick. Está pensado para `useSyncExternalStore`. */
  getSnapshot: typeof processes.getSnapshot
  subscribe: typeof processes.subscribe
  setPaused: typeof processes.setPaused
  setSpeed: typeof processes.setSpeed
  step: typeof processes.step
  spawnTest: typeof processes.spawnTest
  terminateTest: typeof processes.terminateTest
  startDeadlockLab: typeof processes.startDeadlockLab
  stopDeadlockLab: typeof processes.stopDeadlockLab
  resolveDeadlock: typeof processes.resolveDeadlock
  /**
   * Fuerza el cierre de una instancia. Primero avisa de que se pueden perder datos y, si la
   * ventana tiene cambios sin guardar, pasa por el flujo único de cambios sin guardar.
   * Devuelve `false` si el usuario canceló.
   */
  forceQuit: (instanceId: string) => Promise<boolean>
}

/** Requiere el permiso `system:processes`. */
export function useProcesses(): ProcessesApi {
  const { manifest, windowId } = useAppInstance()
  assertPermission(manifest, 'system:processes')
  return useMemo<ProcessesApi>(
    () => ({
      getSnapshot: processes.getSnapshot,
      subscribe: processes.subscribe,
      setPaused: processes.setPaused,
      setSpeed: processes.setSpeed,
      step: processes.step,
      spawnTest: processes.spawnTest,
      terminateTest: processes.terminateTest,
      startDeadlockLab: processes.startDeadlockLab,
      stopDeadlockLab: processes.stopDeadlockLab,
      resolveDeadlock: processes.resolveDeadlock,
      async forceQuit(instanceId) {
        const target = windowsStore.byInstance(instanceId)
        if (!target || target.closing) return false
        const name = getApp(target.appId)?.manifest.name ?? target.title
        const confirmed = await dialogs.forWindow(windowId).confirm({
          title: `¿Forzar el cierre de "${name}"?`,
          message: 'Se cerrará de inmediato y los datos que no hayas guardado se perderán.',
          confirmLabel: 'Forzar cierre',
          destructive: true
        })
        if (!confirmed) return false
        // Si la ventana tiene cambios, el aviso del sistema aparece en ella: hay que traerla al frente.
        if (isWindowDirty(target.id)) windowsStore.focus(target.id)
        return closeWindow(target.id)
      }
    }),
    [windowId]
  )
}

export interface PeripheralsApi {
  catalog: typeof peripherals.catalog
  getSnapshot: typeof peripherals.getSnapshot
  subscribe: typeof peripherals.subscribe
  /** Lanza un error en español si el dispositivo ya está conectado o no queda un puerto libre. */
  connect: (modelId: string) => void
  disconnect: typeof peripherals.disconnect
}

/** Requiere el permiso `system:peripherals`. */
export function usePeripherals(): PeripheralsApi {
  const { manifest } = useAppInstance()
  assertPermission(manifest, 'system:peripherals')
  return {
    catalog: peripherals.catalog,
    getSnapshot: peripherals.getSnapshot,
    subscribe: peripherals.subscribe,
    connect(modelId) {
      peripherals.connect(modelId)
    },
    disconnect: peripherals.disconnect
  }
}

export interface AccountApi {
  /** La cuenta del sistema; se actualiza sola al cambiar el nombre o el avatar. */
  user: SessionUser | null
  /** Cambia el nombre de la cuenta y, con él, el de la carpeta de inicio. */
  rename: (name: string) => Promise<void>
  setAvatar: (avatar: Avatar) => Promise<void>
  /** Pide la contraseña actual; lanza un error en español si no coincide. */
  changePassword: (current: string, next: string) => Promise<void>
}

/** Requiere el permiso `system:account`. */
export function useAccount(): AccountApi {
  const { manifest } = useAppInstance()
  assertPermission(manifest, 'system:account')
  const user = useSession((state) => state.user)
  return {
    user,
    rename: session.rename,
    setAvatar: session.setAvatar,
    changePassword: session.changePassword
  }
}
