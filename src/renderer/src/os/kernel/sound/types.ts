/** Nombres fijos de los sonidos del sistema (sección 4.13). */
export const SYSTEM_SOUNDS = [
  'boot',
  'login',
  'logout',
  'shutdown',
  'notification',
  'error',
  'trash',
  'empty-trash',
  'alarm',
  'shutter',
  'lock'
] as const

export type SystemSound = (typeof SYSTEM_SOUNDS)[number]

/** Con `sound.systemSounds` desactivado solo suenan estos. */
export const ALWAYS_AUDIBLE: readonly SystemSound[] = ['alarm', 'shutter']
