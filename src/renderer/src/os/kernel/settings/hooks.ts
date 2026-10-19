import { useSyncExternalStore } from 'react'
import { settings, type SettingKey, type SettingValue } from '.'

/** Valor reactivo de una clave de configuración. */
export function useSettingValue<K extends SettingKey>(key: K): SettingValue<K> {
  return useSyncExternalStore(
    (onChange) => settings.subscribe(key, onChange),
    () => settings.get(key)
  )
}
