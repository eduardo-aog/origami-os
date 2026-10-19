import { useFsImageUrl } from './useFsImageUrl'

export interface FsImageProps {
  /** Id del nodo (archivo de imagen) del sistema de archivos. */
  nodeId: string
  className?: string
  alt?: string
}

/** Imagen guardada en el sistema de archivos virtual (miniaturas de fondos, avatares…). */
export function FsImage({ nodeId, className, alt = '' }: FsImageProps) {
  const url = useFsImageUrl(nodeId)
  return url ? <img className={className} src={url} alt={alt} draggable={false} /> : <span className={className} />
}
