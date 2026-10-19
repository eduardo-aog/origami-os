import { getBuiltinWallpaperUrl } from '../../kernel/appearance'
import { osConfig } from '../../kernel/config'
import { useSettingValue } from '../../kernel/settings/hooks'
import { useFsImageUrl } from '@os/ui'
import './Wallpaper.css'

/** Fondo de pantalla según `appearance.wallpaper`. Ocupa todo su contenedor. */
export function Wallpaper() {
  const wallpaper = useSettingValue('appearance.wallpaper')
  const fileUrl = useFsImageUrl(wallpaper.type === 'file' ? wallpaper.nodeId : null)
  const url =
    wallpaper.type === 'builtin'
      ? getBuiltinWallpaperUrl(wallpaper.id)
      : (fileUrl ?? getBuiltinWallpaperUrl(osConfig.defaults.wallpaper))

  return <div className="wallpaper" style={url ? { backgroundImage: `url("${url}")` } : undefined} />
}
