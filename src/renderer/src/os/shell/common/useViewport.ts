import { useEffect, useState } from 'react'

/** Tamaño de la ventana de la aplicación, actualizado al redimensionarla. */
export function useViewport(): { width: number; height: number } {
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return viewport
}
