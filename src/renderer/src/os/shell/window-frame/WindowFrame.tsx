import { Suspense, memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AppInstanceContext } from '../../kernel/apps/context'
import { getApp } from '../../kernel/apps'
import { closeWindow, minimizeWindow } from '../../kernel/windows'
import { windowsStore, type WindowRecord, type WorkArea } from '../../kernel/windows/store'
import { SheetHost } from '../dialogs/SheetHost'
import { AppErrorBoundary } from './AppErrorBoundary'
import './WindowFrame.css'

type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const DIRECTIONS: Direction[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

/** Lo mínimo de la barra de título que debe quedar a la vista al arrastrar una ventana. */
const VISIBLE_MARGIN = 100
const TITLEBAR_HEIGHT = 38
/** Qué tanto se encoge una ventana al minimizarse hacia el Dock. */
const MINIMIZE_SCALE = 0.1
/** Un poco más que la animación de maximizar, para quitar la clase cuando ya terminó. */
const ANIMATION_MS = 260

interface Viewport {
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

function frameRect(win: WindowRecord, viewport: Viewport, workArea: WorkArea) {
  if (win.state === 'maximized') {
    return { x: 0, y: workArea.top, width: viewport.width, height: viewport.height - workArea.top - workArea.bottom }
  }
  return { x: win.x, y: win.y, width: win.width, height: win.height }
}

/** Memoizado: al mover o redimensionar una ventana, las demás no se vuelven a renderizar. */
export const WindowFrame = memo(function WindowFrame({
  win,
  viewport,
  workArea
}: {
  win: WindowRecord
  viewport: Viewport
  workArea: WorkArea
}) {
  const app = getApp(win.appId)
  const frameRef = useRef<HTMLDivElement>(null)
  const [animatingSize, setAnimatingSize] = useState(false)
  const rect = frameRect(win, viewport, workArea)
  const minimized = win.state === 'minimized'

  const instance = useMemo(
    () => ({ appId: win.appId, instanceId: win.instanceId, windowId: win.id }),
    [win.appId, win.instanceId, win.id]
  )

  // Al enfocar la ventana (por ejemplo desde el Dock) el foco del teclado entra en ella.
  useEffect(() => {
    const frame = frameRef.current
    if (win.focused && frame && !frame.contains(document.activeElement)) frame.focus({ preventScroll: true })
  }, [win.focused])

  function toggleMaximize() {
    setAnimatingSize(true)
    windowsStore.toggleMaximize(win.id)
    setTimeout(() => setAnimatingSize(false), ANIMATION_MS)
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || win.state === 'maximized' || (event.target as HTMLElement).closest('button')) return
    const element = event.currentTarget
    const startX = event.clientX
    const startY = event.clientY
    const origin = { x: win.x, y: win.y }
    element.setPointerCapture(event.pointerId)

    const onMove = (move: PointerEvent) => {
      windowsStore.move(
        win.id,
        clamp(origin.x + move.clientX - startX, VISIBLE_MARGIN - win.width, viewport.width - VISIBLE_MARGIN),
        clamp(origin.y + move.clientY - startY, workArea.top, viewport.height - TITLEBAR_HEIGHT)
      )
    }
    const onEnd = () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onEnd)
      element.removeEventListener('pointercancel', onEnd)
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onEnd)
    element.addEventListener('pointercancel', onEnd)
  }

  function startResize(direction: Direction, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.stopPropagation()
    const element = event.currentTarget
    const startX = event.clientX
    const startY = event.clientY
    const origin = { x: win.x, y: win.y, width: win.width, height: win.height }
    element.setPointerCapture(event.pointerId)

    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - startX
      const dy = move.clientY - startY
      let { x, y, width, height } = origin
      if (direction.includes('e')) width = Math.max(win.minWidth, origin.width + dx)
      if (direction.includes('w')) {
        width = Math.max(win.minWidth, origin.width - dx)
        x = origin.x + origin.width - width
      }
      if (direction.includes('s')) height = Math.max(win.minHeight, origin.height + dy)
      if (direction.includes('n')) {
        const top = clamp(origin.y + dy, workArea.top, origin.y + origin.height - win.minHeight)
        y = top
        height = origin.y + origin.height - top
      }
      windowsStore.resize(win.id, { x, y, width, height })
    }
    const onEnd = () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onEnd)
      element.removeEventListener('pointercancel', onEnd)
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onEnd)
    element.addEventListener('pointercancel', onEnd)
  }

  // Al minimizarse, la ventana se encoge y viaja hacia el ícono de su app en el Dock.
  let transform: string | undefined
  if (minimized) {
    const target = win.minimizeTarget ?? { x: viewport.width / 2, y: viewport.height }
    const dx = target.x - (rect.x + rect.width / 2)
    const dy = target.y - (rect.y + rect.height / 2)
    transform = `translate(${dx}px, ${dy}px) scale(${MINIMIZE_SCALE})`
  }

  const classes = [
    'window',
    win.focused ? 'window--focused' : '',
    minimized ? 'window--minimized' : '',
    win.state === 'maximized' ? 'window--maximized' : '',
    win.closing ? 'window--closing' : '',
    animatingSize ? 'window--resizing-animation' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={frameRef}
      className={classes}
      role="dialog"
      aria-label={win.title}
      tabIndex={-1}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: win.zIndex,
        ...(transform ? { transform } : {})
      }}
      onPointerDownCapture={() => windowsStore.focus(win.id)}
    >
      <div
        className="window__titlebar"
        onPointerDown={startDrag}
        onDoubleClick={(event) => {
          if (!(event.target as HTMLElement).closest('button')) toggleMaximize()
        }}
      >
        <div className="window__controls">
          <button type="button" className="window__control window__control--close" aria-label="Cerrar" onClick={() => void closeWindow(win.id)}>
            <svg viewBox="0 0 8 8" aria-hidden="true">
              <path d="M1.5 1.5l5 5m0-5l-5 5" />
            </svg>
          </button>
          <button type="button" className="window__control window__control--minimize" aria-label="Minimizar" onClick={() => minimizeWindow(win.id)}>
            <svg viewBox="0 0 8 8" aria-hidden="true">
              <path d="M1.2 4h5.6" />
            </svg>
          </button>
          <button
            type="button"
            className="window__control window__control--maximize"
            aria-label={win.state === 'maximized' ? 'Restaurar' : 'Maximizar'}
            disabled={!win.resizable}
            onClick={toggleMaximize}
          >
            <svg viewBox="0 0 8 8" aria-hidden="true">
              {win.state === 'maximized' ? <path d="M1.5 4h5M4 1.5v5" transform="rotate(45 4 4)" /> : <path d="M4 1.2v5.6M1.2 4h5.6" />}
            </svg>
          </button>
        </div>
        <span className="window__title">{win.title}</span>
      </div>

      <div className="window__content" data-app-id={win.appId} inert={win.hasSheet || minimized}>
        {app ? (
          <AppInstanceContext.Provider value={instance}>
            <AppErrorBoundary appName={app.manifest.name} onClose={() => void closeWindow(win.id)}>
              <Suspense fallback={null}>
                <app.Component />
              </Suspense>
            </AppErrorBoundary>
          </AppInstanceContext.Provider>
        ) : null}
      </div>

      <SheetHost windowId={win.id} />

      {win.resizable && win.state !== 'maximized'
        ? DIRECTIONS.map((direction) => (
            <div key={direction} className={`window__resize window__resize--${direction}`} onPointerDown={(event) => startResize(direction, event)} />
          ))
        : null}
    </div>
  )
})
