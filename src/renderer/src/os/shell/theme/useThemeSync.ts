import { useEffect } from 'react'
import { useSettingValue } from '../../kernel/settings/hooks'

/** Refleja `appearance.theme` y `appearance.accent` en el elemento <html> para que los tokens de tema los usen. */
export function useThemeSync(): void {
  const theme = useSettingValue('appearance.theme')
  const accent = useSettingValue('appearance.accent')

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--color-accent', accent)
  }, [accent])
}
