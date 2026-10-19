export interface AppIconProps {
  /** URL del ícono (la entrega el registro de apps). */
  src: string
  /** Lado en píxeles. */
  size?: number
  /** Texto alternativo; vacío si el nombre ya aparece junto al ícono. */
  alt?: string
}

export function AppIcon({ src, size = 48, alt = '' }: AppIconProps) {
  return <img src={src} width={size} height={size} alt={alt} draggable={false} />
}
