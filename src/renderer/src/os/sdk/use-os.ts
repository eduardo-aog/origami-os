import { useContext, useMemo } from 'react'
import { AppInstanceContext, WidgetInstanceContext } from '../kernel/apps/context'
import { launchApp, getAppsForFile, openFile } from '../kernel/apps/launcher'
import { apps as registeredApps, getApp, getWidget } from '../kernel/apps'
import type { AppContext, AppManifest, AppPermission, LaunchArgs, WidgetManifest } from '../kernel/apps'
import { osConfig } from '../kernel/config'
import { dialogs, type DialogsApi } from '../kernel/dialogs'
import { on, type EventData, type EventName } from '../kernel/events'
import { fs, type FsApi } from '../kernel/fs'
import { media } from '../kernel/media'
import { notifications } from '../kernel/notifications'
import { python, type PythonIo, type PythonJob, type PythonRun } from '../kernel/python'
import { scheduler, type NewJob, type ScheduledJob } from '../kernel/scheduler'
import { settings, type SettingKey, type SettingValue } from '../kernel/settings'
import { sound, type SystemSound } from '../kernel/sound'
import { storage } from '../kernel/storage'
import { closeWindow } from '../kernel/windows'
import { windowsStore } from '../kernel/windows/store'

export interface OSApi {
  app: { id: string; manifest: AppManifest; instanceId: string }
  /** Nombre y versión del sistema, de `os.config.json`. */
  system: { name: string; version: string }
  fs: FsApi
  window: {
    setTitle(title: string): void
    /** Cierra la ventana respetando los cambios sin guardar. */
    close(): Promise<void>
    focus(): void
  }
  dialogs: DialogsApi
  notify(n: { title: string; body?: string; sound?: boolean; launchArgs?: LaunchArgs }): void
  /** `appData` con espacio de nombres de esta app. */
  storage: {
    get<T>(key: string): Promise<T | undefined>
    set<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
    list<T>(prefix?: string): Promise<{ key: string; value: T }[]>
  }
  /** Lectura para todas las apps; escritura solo con el permiso `settings:write`. */
  settings: {
    get<K extends SettingKey>(key: K): SettingValue<K>
    /** Valor de fábrica de una clave, para las opciones de "restablecer". */
    getDefault<K extends SettingKey>(key: K): SettingValue<K>
    set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void>
  }
  sound: { playSystem(name: SystemSound): void }
  apps: {
    launch(appId: string, args?: LaunchArgs): void
    /** Sin `appId` usa la app predeterminada del tipo de archivo. */
    openFile(path: string, appId?: string): void
    getAppsForFile(path: string): AppManifest[]
    list(): AppManifest[]
    /** URL del ícono declarado en el manifiesto de la app. */
    getIconUrl(appId: string): string | undefined
    /** URL de la portada (`cover`) de la app, si la declara. */
    getCoverUrl(appId: string): string | undefined
    /** Contenido de `meta/help.md` de la app, si lo tiene. */
    getHelp(appId: string): string | undefined
  }
  scheduler: {
    schedule(job: NewJob): Promise<string>
    cancel(id: string): Promise<void>
    list(): Promise<ScheduledJob[]>
  }
  /** Exige `camera` y `microphone` en el manifiesto. */
  media: {
    getCamera(constraints?: MediaTrackConstraints): Promise<MediaStream>
    getMicrophone(): Promise<MediaStream>
    listCameras(): Promise<MediaDeviceInfo[]>
  }
  /** Exige `python` en el manifiesto. Un programa a la vez; solo biblioteca estándar. */
  python: {
    run(job: PythonJob, io: PythonIo): PythonRun
  }
  events: { on<E extends EventName>(event: E, handler: (data: EventData<E>) => void): () => void }
}

/** Lanza un error explícito con el nombre del permiso que le falta a la app. */
export function assertPermission(manifest: AppManifest, permission: AppPermission): void {
  if (!manifest.permissions.includes(permission)) {
    throw new Error(`La app "${manifest.name}" necesita el permiso "${permission}" en su manifiesto.`)
  }
}

function namespacedStorage(appId: string): OSApi['storage'] {
  return {
    get: (key) => storage.appData.get(appId, key),
    set: (key, value) => storage.appData.set(appId, key, value),
    delete: (key) => storage.appData.delete(appId, key),
    async list(prefix) {
      const records = await storage.appData.list(appId, prefix)
      return records.map((record) => ({ key: record.key, value: record.value as never }))
    }
  }
}

/** Información de la instancia en la que corre el componente; falla fuera de una ventana de app. */
export function useAppInstance(): { appId: string; instanceId: string; windowId: string; manifest: AppManifest } {
  const info = useContext(AppInstanceContext)
  if (!info) throw new Error('Este hook solo se puede usar dentro de una app.')
  const app = getApp(info.appId)
  if (!app) throw new Error(`La app "${info.appId}" no está registrada.`)
  return useMemo(() => ({ ...info, manifest: app.manifest }), [info, app.manifest])
}

export function useOS(): OSApi {
  const instance = useAppInstance()
  return useMemo<OSApi>(() => {
    const { appId, instanceId, windowId, manifest } = instance
    const context: AppContext = { appId, instanceId }
    return {
      app: { id: appId, manifest, instanceId },
      system: { name: osConfig.name, version: osConfig.version },
      fs,
      window: {
        setTitle: (title) => windowsStore.setTitle(windowId, title),
        close: async () => {
          await closeWindow(windowId)
        },
        focus: () => windowsStore.focus(windowId)
      },
      dialogs: dialogs.forWindow(windowId),
      notify: (n) => {
        notifications.post({ appId, ...n })
      },
      storage: namespacedStorage(appId),
      settings: {
        get: (key) => settings.get(key),
        getDefault: (key) => settings.getDefault(key),
        set: (key, value) => {
          assertPermission(manifest, 'settings:write')
          return settings.set(key, value)
        }
      },
      sound: { playSystem: (name) => sound.play(name) },
      apps: {
        launch: (id, args) => launchApp(id, args),
        openFile: (path, id) => void openFile(path, id),
        getAppsForFile,
        list: () => registeredApps.map((app) => app.manifest),
        getIconUrl: (id) => getApp(id)?.iconUrl,
        getCoverUrl: (id) => getApp(id)?.coverUrl ?? undefined,
        getHelp: (id) => getApp(id)?.helpText ?? undefined
      },
      scheduler: {
        schedule: (job) => scheduler.schedule(appId, job),
        cancel: (id) => scheduler.cancel(id),
        list: () => scheduler.list(appId)
      },
      media: {
        getCamera: (constraints) => media.getCamera(context, constraints),
        getMicrophone: () => media.getMicrophone(context),
        listCameras: () => media.listCameras(context)
      },
      python: {
        run: (job, io) => {
          assertPermission(manifest, 'python')
          return python.run(context, job, io)
        }
      },
      events: { on }
    }
  }, [instance])
}

export interface WidgetOSApi {
  widget: { id: string; manifest: WidgetManifest; size: 'small' | 'medium' | 'large' }
  fs: FsApi
  /** `appData` de la app dueña (`ownerApp`) o, si no tiene, uno propio del widget. */
  storage: OSApi['storage']
  settings: { get<K extends SettingKey>(key: K): SettingValue<K> }
  events: OSApi['events']
}

/** Equivalente de `useOS` para los widgets del escritorio. */
export function useWidgetOS(): WidgetOSApi {
  const info = useContext(WidgetInstanceContext)
  if (!info) throw new Error('Este hook solo se puede usar dentro de un widget.')
  const widget = getWidget(info.widgetId)
  if (!widget) throw new Error(`El widget "${info.widgetId}" no está registrado.`)
  return useMemo<WidgetOSApi>(
    () => ({
      widget: { id: info.widgetId, manifest: widget.manifest, size: info.size },
      fs,
      storage: namespacedStorage(info.ownerApp ?? `widget:${info.widgetId}`),
      settings: { get: (key) => settings.get(key) },
      events: { on }
    }),
    [info, widget.manifest]
  )
}
