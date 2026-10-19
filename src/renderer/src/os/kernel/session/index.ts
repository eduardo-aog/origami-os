import { createStore } from 'zustand/vanilla'
import { osConfig } from '../config'
import { emit } from '../events'
import { createSystemTree, createUserHome, renameHomeFolder, setCurrentUser, validateNodeName } from '../fs'
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
  id: string
  name: string
  avatar: Avatar
}

export interface SessionState {
  phase: SessionPhase
  /** La cuenta con la sesión abierta; `null` en el arranque, el asistente y la pantalla de inicio de sesión. */
  user: SessionUser | null
  /** Todas las cuentas, de la más antigua a la más reciente. */
  users: SessionUser[]
  /** La última cuenta que inició sesión: la que la pantalla de inicio ofrece primero. */
  lastUserId: string | null
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
  users: [],
  lastUserId: null,
  bootStartedAt: Date.now(),
  bootError: null
}))

const guards = new Set<SessionEndGuard>()
let bootInProgress: Promise<void> | null = null

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function toSessionUser(record: UserRecord): SessionUser {
  return { id: record.id, name: record.name, avatar: record.avatar }
}

/** Lee todas las cuentas guardadas y comprueba que sean válidas. */
async function loadUsers(): Promise<UserRecord[]> {
  const records = await storage.user.all()
  return records.map((record) => {
    const parsed = userRecordSchema.safeParse(record)
    if (!parsed.success) throw new Error('Los datos de una cuenta guardada no son válidos.')
    return parsed.data
  })
}

async function refreshUsers(): Promise<void> {
  store.setState({ users: (await loadUsers()).map(toSessionUser) })
}

/** La cuenta con la sesión abierta, tal como está guardada. */
async function activeRecord(): Promise<UserRecord> {
  const id = store.getState().user?.id
  const record = id === undefined ? undefined : await storage.user.get(id)
  if (!record) throw new Error('No hay ninguna cuenta con la sesión abierta.')
  return record
}

/** Un nombre de cuenta debe ser un nombre de carpeta válido y no repetirse (sin distinguir mayúsculas). */
async function checkName(name: string, exceptId?: string): Promise<void> {
  const problem = validateNodeName(name)
  if (problem) throw new Error(problem)
  const taken = (await storage.user.all()).some(
    (record) => record.id !== exceptId && record.name.toLowerCase() === name.toLowerCase()
  )
  if (taken) throw new Error('Ya existe un usuario con ese nombre.')
}

async function runBoot(): Promise<void> {
  store.setState({ phase: 'boot', user: null, bootStartedAt: Date.now(), bootError: null })
  setCurrentUser(null)
  const startedAt = store.getState().bootStartedAt
  try {
    await storage.open()
    processes.init()
    media.init()
    python.init()

    const [setupCompleted, savedLastId, users] = await Promise.all([
      storage.meta.get<boolean>('setupCompleted'),
      storage.meta.get<string>('lastUserId'),
      loadUsers()
    ])

    // Antes de que hubiera varias cuentas los ajustes eran globales: pasan a la cuenta que ya existía.
    const legacyOwner = users.find((record) => record.id === 'user') ?? users[0]
    if (legacyOwner) await settings.migrateLegacy(legacyOwner.id)

    // La pantalla de inicio muestra el fondo y el tema de la última cuenta que entró.
    const lastUserId = users.find((record) => record.id === savedLastId)?.id ?? users[0]?.id ?? null
    await settings.load(lastUserId)

    sound.play('boot')
    await wait(Math.max(0, osConfig.bootDurationMs - (Date.now() - startedAt)))

    store.setState({
      phase: setupCompleted && users.length > 0 ? 'login' : 'setup',
      users: users.map(toSessionUser),
      lastUserId
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.setState({ bootError: `No se pudo iniciar el sistema. ${message}` })
  }
}

function verifyPassword(record: UserRecord | undefined, password: string): Promise<boolean> {
  if (!record) return Promise.resolve(false)
  return native().auth.verifyPassword(password, record.passwordHash, record.salt)
}

/** Da de alta una cuenta: su registro, su carpeta de inicio y sus ajustes. No inicia sesión. */
async function createAccount(input: SetupInput): Promise<UserRecord> {
  const name = input.name.trim()
  await checkName(name)
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  }

  const first = (await storage.user.all()).length === 0
  const { hash, salt } = await native().auth.hashPassword(input.password)
  const record: UserRecord = {
    id: crypto.randomUUID(),
    name,
    avatar: input.avatar,
    passwordHash: hash,
    salt,
    createdAt: Date.now()
  }

  await storage.transaction(async () => {
    await storage.user.put(record)
    if (first) await createSystemTree()
    await createUserHome(name)
    await settings.persistNew(record.id, { 'appearance.theme': input.theme })
    await storage.meta.set('setupCompleted', true)
  })
  await refreshUsers()
  return record
}

/** Abre la sesión de una cuenta ya verificada: carga sus ajustes y apunta `~` a su carpeta. */
async function openSession(record: UserRecord): Promise<void> {
  await settings.load(record.id)
  await storage.meta.set('lastUserId', record.id)
  setCurrentUser(record.name)
  store.setState({ user: toSessionUser(record), lastUserId: record.id })
  startSession()
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

  /** Primer arranque: crea la primera cuenta, el árbol de carpetas y los valores por defecto, e inicia la sesión. */
  async completeSetup(input: SetupInput): Promise<void> {
    await openSession(await createAccount(input))
  },

  /** Da de alta una cuenta más desde la pantalla de inicio. No inicia sesión: la cuenta aparece en la lista. */
  async createUser(input: SetupInput): Promise<void> {
    await createAccount(input)
  },

  /** Inicia la sesión de una cuenta. Devuelve `false` si la contraseña no es correcta. */
  async login(userId: string, password: string): Promise<boolean> {
    if (store.getState().phase !== 'login') return false
    const record = await storage.user.get(userId)
    if (!(await verifyPassword(record, password)) || !record) return false
    await openSession(record)
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
    if (!(await verifyPassword(await activeRecord(), password))) return false
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
    setCurrentUser(null)
    store.setState({ phase: 'login', user: null })
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
    const record = await activeRecord()
    await checkName(name, record.id)
    if (record.name === name) return
    const updated: UserRecord = { ...record, name }
    const home = await storage.transaction(async () => {
      const folder = await renameHomeFolder(record.name, name)
      await storage.user.put(updated)
      return folder
    })
    setCurrentUser(name)
    store.setState({ user: toSessionUser(updated) })
    await refreshUsers()
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
    const record = await activeRecord()
    const updated: UserRecord = { ...record, avatar: valid }
    await storage.user.put(updated)
    store.setState({ user: toSessionUser(updated) })
    await refreshUsers()
  },

  /** Cambia la contraseña. Pide la actual y lanza un error en español si no coincide. */
  async changePassword(current: string, next: string): Promise<void> {
    if (next.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    }
    const record = await activeRecord()
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
