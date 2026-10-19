import { listBuiltinAvatars, listBuiltinWallpapers, type BuiltinAsset } from '../kernel/appearance'
import { osConfig } from '../kernel/config'

export interface AppearanceApi {
  /** Fondos incluidos (`system/wallpapers`); el `id` es el nombre del archivo sin extensión. */
  wallpapers: BuiltinAsset[]
  /** Avatares incluidos (`system/avatars`). */
  avatars: BuiltinAsset[]
  /** Colores de acento que ofrece el sistema (`accentColors` de `os.config.json`). */
  accentColors: { name: string; value: string }[]
}

/** Recursos de apariencia incluidos con el sistema. Lectura abierta a todas las apps. */
export function useAppearance(): AppearanceApi {
  return {
    wallpapers: listBuiltinWallpapers(),
    avatars: listBuiltinAvatars(),
    accentColors: osConfig.accentColors
  }
}
