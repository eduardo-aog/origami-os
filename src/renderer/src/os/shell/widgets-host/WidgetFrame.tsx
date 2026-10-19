import { X } from 'lucide-react'
import { Suspense, useMemo, useState, type PointerEvent } from 'react'
import { WidgetInstanceContext } from '../../kernel/apps/context'
import { getWidget } from '../../kernel/apps'
import { windowsStore } from '../../kernel/windows/store'
import { WIDGET_SIZE_PX, WIDGET_SNAP, removeWidget, updateWidget, type WidgetEntry } from './actions'

const SIZE_LABELS = { small: 'P', medium: 'M', large: 'G' } as const
const SIZE_NAMES = { small: 'pequeño', medium: 'mediano', large: 'grande' } as const

/** Contenido del widget, con el contexto que lee `useWidgetOS`. */
function WidgetBody({ widgetId, size }: { widgetId: string; size: WidgetEntry['size'] }) {
  const definition = getWidget(widgetId)
  const ownerApp = definition?.manifest.ownerApp ?? null
  const info = useMemo(() => ({ widgetId, ownerApp, size }), [widgetId, ownerApp, size])
  if (!definition) return null
  return (
    <WidgetInstanceContext.Provider value={info}>
      <Suspense fallback={null}>
        <definition.Component />
      </Suspense>
    </WidgetInstanceContext.Provider>
  )
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

export function WidgetFrame({ entry, viewport }: { entry: WidgetEntry; viewport: { width: number; height: number } }) {
  const definition = getWidget(entry.widgetId)
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null)
  if (!definition) return null

  const { width, height } = WIDGET_SIZE_PX[entry.size]
  const top = windowsStore.getState().workArea.top
  const bounds = (x: number, y: number) => ({
    x: clamp(x, 0, viewport.width - width),
    y: clamp(y, top, viewport.height - 80)
  })
  const position = dragging ?? bounds(entry.x, entry.y)

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    const element = event.currentTarget
    const startX = event.clientX
    const startY = event.clientY
    const origin = { x: position.x, y: position.y }
    element.setPointerCapture(event.pointerId)
    let latest = origin

    const onMove = (move: globalThis.PointerEvent) => {
      latest = bounds(origin.x + move.clientX - startX, origin.y + move.clientY - startY)
      setDragging(latest)
    }
    const onEnd = () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onEnd)
      element.removeEventListener('pointercancel', onEnd)
      setDragging(null)
      const snapped = bounds(Math.round(latest.x / WIDGET_SNAP) * WIDGET_SNAP, Math.round(latest.y / WIDGET_SNAP) * WIDGET_SNAP)
      if (snapped.x !== entry.x || snapped.y !== entry.y) updateWidget(entry.id, snapped)
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onEnd)
    element.addEventListener('pointercancel', onEnd)
  }

  const { sizes, name } = definition.manifest
  return (
    <section
      className={`widget${dragging ? ' widget--dragging' : ''}`}
      aria-label={name}
      data-widget-id={entry.widgetId}
      data-size={entry.size}
      style={{ left: position.x, top: position.y, width, height }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="widget__bar" onPointerDown={startDrag}>
        <div className="widget__sizes" role="group" aria-label="Tamaño">
          {sizes.length > 1
            ? sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className="widget__size"
                  aria-pressed={size === entry.size}
                  aria-label={`Tamaño ${SIZE_NAMES[size]}`}
                  onClick={() => updateWidget(entry.id, { size })}
                >
                  {SIZE_LABELS[size]}
                </button>
              ))
            : null}
        </div>
        <button type="button" className="widget__remove" aria-label={`Quitar ${name}`} onClick={() => removeWidget(entry.id)}>
          <X size={12} />
        </button>
      </div>
      <div className="widget__body">
        <WidgetBody widgetId={entry.widgetId} size={entry.size} />
      </div>
    </section>
  )
}
