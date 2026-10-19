/** Tipo de dato propio para arrastrar archivos o carpetas del sistema de archivos virtual. */
export const NODE_DRAG_TYPE = 'application/x-simos-node'

export interface NodeDragPayload {
  nodeIds: string[]
  /** Accesos del escritorio que se arrastran (el escritorio los usa para reordenarse). */
  itemIds?: string[]
  /** Posición del puntero respecto a la esquina del elemento arrastrado. */
  grab?: { x: number; y: number }
}

type DragLike = { dataTransfer: DataTransfer | null }

export function setNodeDrag(event: DragLike, payload: NodeDragPayload): void {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(NODE_DRAG_TYPE, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'copyMove'
}

/** ¿Lo que se arrastra son nodos del sistema de archivos? (Durante `dragover` no se puede leer el contenido.) */
export function hasNodeDrag(event: DragLike): boolean {
  return event.dataTransfer?.types.includes(NODE_DRAG_TYPE) ?? false
}

export function getNodeDrag(event: DragLike): NodeDragPayload | null {
  const raw = event.dataTransfer?.getData(NODE_DRAG_TYPE)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<NodeDragPayload>
    return {
      nodeIds: Array.isArray(parsed.nodeIds) ? parsed.nodeIds.filter((id) => typeof id === 'string') : [],
      ...(Array.isArray(parsed.itemIds) ? { itemIds: parsed.itemIds.filter((id) => typeof id === 'string') } : {}),
      ...(parsed.grab ? { grab: parsed.grab } : {})
    }
  } catch {
    return null
  }
}
