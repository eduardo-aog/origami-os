import { createStore } from 'zustand/vanilla'
import { emit } from '../events'
import { storage } from '../storage'
import { formatIssues } from '../validation'
import {
  isSettingKey,
  settingDefaults,
  settingSchemas,
  type SettingKey,
  type SettingValue,
  type SettingValues
} from './schema'

export { settingDefaults, settingSchemas, isSettingKey } from './schema'
export type { SettingKey, SettingValue, SettingValues } from './schema'

const store = createStore<{ values: SettingValues }>(() => ({ values: { ...settingDefaults } }))

/** Cuenta cuyos ajustes están cargados; sin cuenta (asistente de primer arranque) los cambios no se guardan. */
let scope: string | null = null
/** Cada `load` toma un número: si llega otro antes de terminar, el resultado del primero se descarta. */
let loadCount = 0

const keyOf = (userId: string, key: string) => `${userId}:${key}`

function validate<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  const result = settingSchemas[key].safeParse(value)
  if (!result.success) {
    throw new Error(`Valor no válido para "${key}": ${formatIssues(result.error).join('; ')}`)
  }
  return result.data as SettingValue<K>
}

export const settings = {
  /**
   * Carga los ajustes de una cuenta (`null`: solo los valores por defecto) y los deja como ajustes en
   * uso: lo que falte o sea inválido usa el valor por defecto, y desde ahora `set` guarda en esa cuenta.
   */
  async load(userId: string | null): Promise<void> {
    const mine = ++loadCount
    scope = userId
    const values: SettingValues = { ...settingDefaults }
    if (userId !== null) {
      const prefix = keyOf(userId, '')
      const records = await storage.settings.byPrefix(prefix)
      if (mine !== loadCount) return
      for (const record of records) {
        const key = record.key.slice(prefix.length)
        if (!isSettingKey(key)) continue
        const result = settingSchemas[key].safeParse(record.value)
        if (result.success) {
          ;(values as Record<string, unknown>)[key] = result.data
        } else {
          console.warn(`[configuración] Se ignora el valor guardado de "${key}":`, formatIssues(result.error))
        }
      }
    }
    store.setState({ values })
  },

  /** Pasa a la cuenta `userId` los ajustes globales de antes de que hubiera varias cuentas. Es seguro repetirlo. */
  migrateLegacy(userId: string): Promise<void> {
    return storage.settings.migrateLegacy(userId, isSettingKey)
  },

  get<K extends SettingKey>(key: K): SettingValue<K> {
    return store.getState().values[key]
  },

  /** Valida, guarda y publica `settings:changed`. Lanza un error si el valor no es válido. */
  async set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
    const valid = validate(key, value)
    if (scope !== null) await storage.settings.set(keyOf(scope, key), valid)
    store.setState((state) => ({ values: { ...state.values, [key]: valid } }))
    emit('settings:changed', { key, value: valid })
  },

  /** Vuelve una clave a su valor por defecto. */
  reset<K extends SettingKey>(key: K): Promise<void> {
    return settings.set(key, settingDefaults[key])
  },

  getDefault<K extends SettingKey>(key: K): SettingValue<K> {
    return settingDefaults[key]
  },

  /** Cambia un ajuste solo en memoria, sin guardarlo (la vista previa del asistente). */
  preview<K extends SettingKey>(key: K, value: SettingValue<K>): void {
    const valid = validate(key, value)
    store.setState((state) => ({ values: { ...state.values, [key]: valid } }))
  },

  /** Avisa solo cuando cambia el valor de `key`. Devuelve la función que cancela la suscripción. */
  subscribe<K extends SettingKey>(key: K, listener: (value: SettingValue<K>) => void): () => void {
    return store.subscribe((state, previous) => {
      if (state.values[key] !== previous.values[key]) listener(state.values[key])
    })
  },

  /**
   * Guarda todos los ajustes de una cuenta nueva: los valores por defecto con las excepciones de `overrides`.
   * No cambia los ajustes que están en uso. Se guardan todos para que, por ejemplo, `dock.pinned` no cambie
   * si más adelante se instala una app anclada por defecto.
   */
  async persistNew(userId: string, overrides: Partial<SettingValues> = {}): Promise<void> {
    const values: SettingValues = { ...settingDefaults, ...overrides }
    await storage.settings.bulkSet(
      (Object.keys(values) as SettingKey[]).map((key) => ({ key: keyOf(userId, key), value: validate(key, values[key]) }))
    )
  }
}
