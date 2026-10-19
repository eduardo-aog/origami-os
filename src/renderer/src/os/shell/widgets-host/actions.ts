import { getWidget, type WidgetSize } from '../../kernel/apps'
import { settings, type SettingValue } from '../../kernel/settings'
import { windowsStore } from '../../kernel/windows/store'

export type WidgetEntry = SettingValue<'desktop.widgets'>[number]

/** Tamaños de la sección 4.7, en píxeles. */
export const WIDGET_SIZE_PX: Record<WidgetSize, { width: number; height: number }> = {
  small: { width: 160, height: 160 },
  medium: { width: 340, height: 160 },
  large: { width: 340, height: 340 }
}

/** Los widgets se acomodan a una retícula de este tamaño al soltarlos. */
export const WIDGET_SNAP = 20
const MARGIN = 24
const TOP = 44

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

/** Primer hueco libre, empezando por la esquina superior derecha y bajando. */
function freeSpot(existing: readonly WidgetEntry[], size: WidgetSize): { x: number; y: number } {
  const { width, height } = WIDGET_SIZE_PX[size]
  const placed = existing.map((entry) => ({ x: entry.x, y: entry.y, ...WIDGET_SIZE_PX[entry.size] }))
  const bottom = window.innerHeight - windowsStore.getState().workArea.bottom
  for (let x = window.innerWidth - width - MARGIN; x >= MARGIN; x -= width + WIDGET_SNAP) {
    for (let y = TOP; y + height <= bottom; y += WIDGET_SNAP) {
      if (!placed.some((other) => overlaps({ x, y, width, height }, other))) return { x, y }
    }
  }
  return { x: MARGIN, y: TOP }
}

export function addWidget(widgetId: string): void {
  const definition = getWidget(widgetId)
  if (!definition) return
  const current = settings.get('desktop.widgets')
  const size = definition.manifest.defaultSize
  void settings.set('desktop.widgets', [...current, { id: crypto.randomUUID(), widgetId, size, ...freeSpot(current, size) }])
}

export function updateWidget(id: string, change: Partial<Pick<WidgetEntry, 'size' | 'x' | 'y'>>): void {
  void settings.set(
    'desktop.widgets',
    settings.get('desktop.widgets').map((entry) => (entry.id === id ? { ...entry, ...change } : entry))
  )
}

export function removeWidget(id: string): void {
  void settings.set(
    'desktop.widgets',
    settings.get('desktop.widgets').filter((entry) => entry.id !== id)
  )
}
