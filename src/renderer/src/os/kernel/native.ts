import type { NativeApi } from '../../../../shared/native-api'

/** Único punto de acceso a `window.native`: solo los servicios del kernel lo usan. */
export function native(): NativeApi {
  if (!window.native) throw new Error('El puente nativo no está disponible.')
  return window.native
}
