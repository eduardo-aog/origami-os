import { createStore } from 'zustand/vanilla'
import { osConfig } from '../config'
import { emit } from '../events'
import { createInitialTree, renameHomeFolder, validateNodeName } from '../fs'
import { media } from '../media'
import { python } from '../python'
import { native } from '../native'
import { processes } from '../processes'
import { scheduler } from '../scheduler'
import { settings, type SettingValue } from '../settings'
import { sound } from '../sound'
import { avatarSchema, storage, userRecordSchema, type Avatar, type UserRecord } from '../storage'

export type SessionPhase = 'boot' | 'setup' | 'login' | 'locked' | 'desktop' | 'shutdown'

export interface SessionUser {
  name: string
  avatar: Avatar
}

export interface SessionState {
  phase: SessionPhase
  /** La cuenta del sistema; `null` hasta que el asistente de primer arranque la crea. */
  user: SessionUser | null
  /** Instante en que empezó el arranque actual (para animar la barra de progreso). */
  bootStartedAt: number
  bootError: string | null
}

export interface SetupInput {
  name: string
  password: string
  avatar: Avatar
  theme: SettingValue<'appearance.theme'>
}

export const MIN_PASSWORD_LENGTH = 4

/** Por qué termina la sesión actual. */
export type SessionEndReason = 'logout' | 'restart' | 'shutdown'

/**
 * Paso previo a cerrar sesión, reiniciar o apagar. Devuelve `false` para cancelar la acción.
 * La Fase 2 registra aquí el recorrido por las ventanas con cambios sin guardar (sección 4.9).
 */
export type SessionEndGuard = (reason: SessionEndReason) => Promise<boolean>

/** Lo que tarda la pantalla "Apagando…" antes de cerrar la aplicación. */
const SHUTDOWN_SCREEN_MS = 2200

const store = createStore<SessionState>(() => ({
  phase: 'boot',
  user: null,
  bootStartedAt: Date.now(),
  bootError: null
}))

const guards = new Set<SessionEndGuard>()
let bootInProgress: Promise<void> | null = null

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function toSessionUser(record: UserRecord): SessionUser {
  return { name: record.name, avatar: record.avatar }
}

async function runBoot(): Promise<void> {
  store.setState({ phase: 'boot', bootStartedAt: Date.now(), bootError: null })
  const startedAt = store.getState().bootStartedAt
  try {
    await storage.open()
    await settings.load()
    processes.init()
    media.init()
    python.init()

    const [setupCompleted, rawUser] = await Promise.all([
      storage.meta.get<boolean>('setupCompleted'),
      storage.user.get()
    ])
    const parsedUser = rawUser ? userRecordSchema.safeParse(rawUser) : null
    if (parsedUser && !parsedUser.success) {
      throw new Error('Los datos de la cuenta guardada no son válidos.')
    }

    sound.play('boot')
    await wait(Math.max(0, osConfig.bootDurationMs - (Date.now() - startedAt)))

    if (setupCompleted && parsedUser?.success) {
      store.setState({ phase: 'login', user: toSessionUser(parsedUser.data) })
    } else {
      store.setState({ phase: 'setup', user: null })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.setState({ bootError: `No se pudo iniciar el sistema. ${message}` })
  }
}

async function verifyPassword(password: string): Promise<boolean> {
  const record = await storage.user.get()
  if (!record) return false
  return native().auth.verifyPassword(password, record.passwordHash, record.salt)
}

function startSession(): void {
  store.setState({ phase: 'desktop' })
  scheduler.start()
  emit('session:unlocked', {})
  sound.play('login')
}

async function confirmSessionEnd(reason: SessionEndReason): Promise<boolean> {
  for (const guard of [...guards]) {
    if (!(await guard(reason))) return false
  }
  return true
}

export const session = {
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  /** Arranca el sistema. Si ya hay un arranque en curso, devuelve ese mismo. */
  boot(): Promise<void> {
    bootInProgress ??= runBoot().finally(() => {
      bootInProgress = null
    })
    return bootInProgress
  },

  /** Crea la cuenta, el árbol de carpetas y los valores por defecto, e inicia la sesión. */
  async completeSetup(input: SetupInput): Promise<void> {
    const name = input.name.trim()
    const nameProblem = validateNodeName(name)
    if (nameProblem) throw new Error(nameProblem)
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    }

    const { hash, salt } = await native().auth.hashPassword(input.password)
    const record: UserRecord = {
      id: 'user',
      name,
      avatar: input.avatar,
      passwordHash: hash,
      salt,
      createdAt: Date.now()
    }

    await settings.set('appearance.theme', input.theme)
    await storage.transaction(async () => {
      await storage.user.put(record)
      await createInitialTree(name)
      await settings.persistAll()
      await storage.meta.set('setupCompleted', true)
    })

    store.setState({ user: toSessionUser(record) })
    startSession()
  },

  /** Inicia sesión desde la pantalla de inicio. Devuelve `false` si la contraseña no es correcta. */
  async login(password: string): Promise<boolean> {
    if (store.getState().phase !== 'login') return false
    if (!(await verifyPassword(password))) return false
    startSession()
    return true
  },

  lock(): void {
    if (store.getState().phase !== 'desktop') return
    store.setState({ phase: 'locked' })
    emit('session:locked', {})
    sound.play('lock')
  },

  /** Desbloquea la sesión. Devuelve `false` si la contraseña no es correcta. */
  async unlock(password: string): Promise<boolean> {
    if (store.getState().phase !== 'locked') return false
    if (!(await verifyPassword(password))) return false
    store.setState({ phase: 'desktop' })
    emit('session:unlocked', {})
    sound.play('login')
    return true
  },

  /** Cierra la sesión y vuelve a la pantalla de inicio. Devuelve `false` si una guarda lo canceló. */
  async logout(): Promise<boolean> {
    const { phase } = store.getState()
    if (phase !== 'desktop' && phase !== 'locked') return false
    if (!(await confirmSessionEnd('logout'))) return false
    scheduler.stop()
    emit('session:logout', {})
    sound.play('logout')
    store.setState({ phase: 'login' })
    return true
  },

  /** Vuelve a la pantalla de arranque. Devuelve `false` si una guarda lo canceló. */
  async restart(): Promise<boolean> {
    if (!(await confirmSessionEnd('restart'))) return false
    scheduler.stop()
    emit('power:restart', {})
    void session.boot()
    return true
  },

  /** Muestra "Apagando…" y cierra la aplicación. Devuelve `false` si una guarda lo canceló. */
  async shutdown(): Promise<boolean> {
    if (!(await confirmSessionEnd('shutdown'))) return false
    scheduler.stop()
    emit('power:shutdown', {})
    sound.play('shutdown')
    store.setState({ phase: 'shutdown' })
    await wait(SHUTDOWN_SCREEN_MS)
    native().power.quit()
    return true
  },

  /** Cambia el nombre de la cuenta y, con él, el de la carpeta de inicio. */
  async rename(rawName: string): Promise<void> {
    const name = rawName.trim()
    const problem = validateNodeName(name)
    if (problem) throw new Error(problem)
    const record = await storage.user.get()
    if (!record) throw new Error('Todavía no hay una cuenta.')
    if (record.name === name) return
    const updated: UserRecord = { ...record, name }
    const home = await storage.transaction(async () => {
      const folder = await renameHomeFolder(record.name, name)
      await storage.user.put(updated)
      return folder
    })
    store.setState({ user: toSessionUser(updated) })
    emit('fs:changed', { kind: 'update', nodeId: home.id, parentId: home.parentId ?? '' })
  },

  /** Cambia el avatar de la cuenta: uno de los incluidos o una imagen del sistema de archivos. */
  async setAvatar(avatar: Avatar): Promise<void> {
    const valid = avatarSchema.parse(avatar)
    if (valid.type === 'file') {
      const node = await storage.nodes.get(valid.nodeId)
      if (!node || node.kind !== 'file' || !node.mime.startsWith('image/')) {
        throw new Error('La imagen elegida ya no existe o no es una imagen.')
      }
    }
    const record = await storage.user.get()
    if (!record) throw new Error('Todavía no hay una cuenta.')
    const updated: UserRecord = { ...record, avatar: valid }
    await storage.user.put(updated)
    store.setState({ user: toSessionUser(updated) })
  },

  /** Cambia la contraseña. Pide la actual y lanza un error en español si no coincide. */
  async changePassword(current: string, next: string): Promise<void> {
    if (next.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    }
    const record = await storage.user.get()
    if (!record) throw new Error('Todavía no hay una cuenta.')
    if (!(await native().auth.verifyPassword(current, record.passwordHash, record.salt))) {
      throw new Error('La contraseña actual no es correcta.')
    }
    const { hash, salt } = await native().auth.hashPassword(next)
    await storage.user.put({ ...record, passwordHash: hash, salt })
  },

  /** Registra un paso que se ejecuta antes de cerrar sesión, reiniciar o apagar. */
  registerSessionEndGuard(guard: SessionEndGuard): () => void {
    guards.add(guard)
    return () => {
      guards.delete(guard)
    }
  }
}
