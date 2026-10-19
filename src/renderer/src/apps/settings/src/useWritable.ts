import { useRef, useState } from 'react'
import { useOS, useSetting, type SettingKey, type SettingValue } from '@os/sdk'

/**
 * Valor de una opción y la función que lo guarda. Mientras se guarda se muestra el valor nuevo,
 * para que controles como los deslizadores no den saltos; si falla, se avisa y vuelve el anterior.
 */
export function useWritable<K extends SettingKey>(key: K): [SettingValue<K>, (value: SettingValue<K>) => void] {
  const os = useOS()
  const stored = useSetting(key)
  const [pending, setPending] = useState<{ value: SettingValue<K> } | null>(null)
  const latest = useRef(0)

  function write(value: SettingValue<K>) {
    const id = ++latest.current
    setPending({ value })
    os.settings
      .set(key, value)
      .catch((error: unknown) =>
        os.dialogs.alert({
          title: 'No se pudo guardar el cambio',
          message: error instanceof Error ? error.message : String(error)
        })
      )
      .finally(() => {
        if (latest.current === id) setPending(null)
      })
  }

  return [pending ? pending.value : stored, write]
}
