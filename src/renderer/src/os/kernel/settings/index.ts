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

function validate<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  const result = settingSchemas[key].safeParse(value)
  if (!result.success) {
    throw new Error(`Valor no válido para "${key}": ${formatIssues(result.error).join('; ')}`)
  }
  return result.data as SettingValue<K>
}

export const settings = {
  /** Lee de la base de datos los valores guardados. Lo que falte o sea inválido usa el valor por defecto. */
  async load(): Promise<void> {
    const values: SettingValues = { ...settingDefaults }
    for (const record of await storage.settings.all()) {
      if (!isSettingKey(record.key)) continue
      const result = settingSchemas[record.key].safeParse(record.value)
      if (result.success) {
        ;(values as Record<string, unknown>)[record.key] = result.data
      } else {
        console.warn(`[configuración] Se ignora el valor guardado de "${record.key}":`, formatIssues(result.error))
      }
    }
    store.setState({ values })
  },

  get<K extends SettingKey>(key: K): SettingValue<K> {
    return store.getState().values[key]
  },

  /** Valida, guarda y publica `settings:changed`. Lanza un error si el valor no es válido. */
  async set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
    const valid = validate(key, value)
    await storage.settings.set(key, valid)
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

  /** Avisa solo cuando cambia el valor de `key`. Devuelve la función que cancela la suscripción. */
  subscribe<K extends SettingKey>(key: K, listener: (value: SettingValue<K>) => void): () => void {
    return store.subscribe((state, previous) => {
      if (state.values[key] !== previous.values[key]) listener(state.values[key])
    })
  },

  /** Guarda todos los valores actuales (los usa el asistente de primer arranque). */
  async persistAll(): Promise<void> {
    const values = store.getState().values
    await storage.settings.bulkSet(
      (Object.keys(values) as SettingKey[]).map((key) => ({ key, value: values[key] }))
    )
  }
}
