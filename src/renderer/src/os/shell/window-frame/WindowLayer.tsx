import { useStore } from 'zustand'
import { useWindows } from '../../kernel/windows/hooks'
import { windowsStore } from '../../kernel/windows/store'
import { useViewport } from '../common/useViewport'
import { WindowFrame } from './WindowFrame'
import './WindowLayer.css'

/** Todas las ventanas abiertas. El orden del DOM no cambia: el apilamiento lo da `z-index`. */
export function WindowLayer() {
  const windows = useWindows((state) => state.windows)
  const workArea = useStore(windowsStore, (state) => state.workArea)
  const viewport = useViewport()

  return (
    <div className="window-layer">
      {windows.map((win) => (
        <WindowFrame key={win.id} win={win} viewport={viewport} workArea={workArea} />
      ))}
    </div>
  )
}
