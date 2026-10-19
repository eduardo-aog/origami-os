import defaultAvatarUrl from '@system/icons/avatar-default.svg'

export interface BuiltinAsset {
  id: string
  url: string
}

type AssetFiles = Record<string, string>

// Cada imagen colocada en system/wallpapers o system/avatars queda disponible sin tocar código.
const wallpaperFiles: AssetFiles = import.meta.glob('/src/system/wallpapers/*.{svg,png,jpg,webp}', {
  eager: true,
  import: 'default',
  query: '?url'
})
const avatarFiles: AssetFiles = import.meta.glob('/src/system/avatars/*.{svg,png,jpg,webp}', {
  eager: true,
  import: 'default',
  query: '?url'
})

/** El id es el nombre del archivo sin extensión. */
function toAssets(files: AssetFiles): BuiltinAsset[] {
  return Object.entries(files)
    .map(([path, url]) => ({ id: path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, ''), url }))
    .sort((a, b) => a.id.localeCompare(b.id, 'es'))
}

const wallpapers = toAssets(wallpaperFiles)
const avatars = toAssets(avatarFiles)

export function listBuiltinWallpapers(): BuiltinAsset[] {
  return wallpapers
}

/** URL del fondo incluido con ese id, o la del primero disponible si ya no existe. */
export function getBuiltinWallpaperUrl(id: string): string | undefined {
  return (wallpapers.find((wallpaper) => wallpaper.id === id) ?? wallpapers[0])?.url
}

export function listBuiltinAvatars(): BuiltinAsset[] {
  return avatars
}

/** URL del avatar incluido con ese id, o la del avatar por defecto si ya no existe. */
export function getBuiltinAvatarUrl(id: string): string {
  return avatars.find((avatar) => avatar.id === id)?.url ?? defaultAvatarUrl
}

export { defaultAvatarUrl }
