import { defaultAvatarUrl, getBuiltinAvatarUrl } from '../kernel/appearance'
import type { Avatar as AvatarSpec } from '../kernel/storage'
import { useFsImageUrl } from './useFsImageUrl'
import './Avatar.css'

export interface AvatarProps {
  avatar: AvatarSpec | null
  /** Lado en píxeles. */
  size?: number
}

/** Avatar de la cuenta: uno de los incluidos o una imagen del sistema de archivos. */
export function Avatar({ avatar, size = 64 }: AvatarProps) {
  const fileUrl = useFsImageUrl(avatar?.type === 'file' ? avatar.nodeId : null)
  const url = avatar?.type === 'builtin' ? getBuiltinAvatarUrl(avatar.id) : (fileUrl ?? defaultAvatarUrl)
  return <img className="os-avatar" src={url} width={size} height={size} alt="" draggable={false} />
}
