export type Tool = 'brush' | 'pencil' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'fill' | 'picker' | 'text'

export type ShapeTool = 'line' | 'rect' | 'ellipse'
export type FreehandTool = 'brush' | 'pencil' | 'eraser'

export interface Point {
  x: number
  y: number
}

export type Rgba = readonly [number, number, number, number]

export const isShapeTool = (tool: Tool): tool is ShapeTool => tool === 'line' || tool === 'rect' || tool === 'ellipse'
export const isFreehandTool = (tool: Tool): tool is FreehandTool =>
  tool === 'brush' || tool === 'pencil' || tool === 'eraser'

export const MAX_SIDE = 2000
export const MAX_PIXELS = 4_000_000
/** El deshacer nunca baja de 30 pasos; con lienzos pequeños admite más mientras la memoria lo permita. */
export const MIN_UNDO_STEPS = 30
const MAX_UNDO_STEPS = 60
const HISTORY_BUDGET_BYTES = 160_000_000

export function historyLimit(width: number, height: number): number {
  const affordable = Math.floor(HISTORY_BUDGET_BYTES / (width * height * 4))
  return Math.max(MIN_UNDO_STEPS, Math.min(MAX_UNDO_STEPS, affordable))
}

/** Mensaje de error si el tamaño no es válido para un lienzo; `null` si lo es. */
export function validateSize(width: number, height: number): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return 'El ancho y el alto deben ser números enteros mayores que cero.'
  }
  if (width > MAX_SIDE || height > MAX_SIDE) return `Cada lado puede medir como máximo ${MAX_SIDE} px.`
  if (width * height > MAX_PIXELS) return 'El lienzo es demasiado grande. Prueba con un tamaño menor.'
  return null
}

export function parseHex(hex: string): Rgba {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value
  const number = Number.parseInt(full, 16)
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255, 255]
}

export function toHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Traza desde `from` hasta `to` con un pincel redondo suave, un lápiz de bordes duros o el borrador. */
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  tool: FreehandTool,
  from: Point,
  to: Point,
  size: number,
  color: string
): void {
  if (tool === 'pencil') {
    drawAliasedLine(ctx, from, to, size, color)
    return
  }
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (from.x === to.x && from.y === to.y) {
    ctx.beginPath()
    ctx.arc(to.x, to.y, size / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }
  ctx.restore()
}

/** Línea sin suavizado (Bresenham) hecha de cuadrados de `size` píxeles. */
function drawAliasedLine(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number, color: string): void {
  let x = Math.floor(from.x)
  let y = Math.floor(from.y)
  const endX = Math.floor(to.x)
  const endY = Math.floor(to.y)
  const dx = Math.abs(endX - x)
  const dy = -Math.abs(endY - y)
  const stepX = x < endX ? 1 : -1
  const stepY = y < endY ? 1 : -1
  const half = Math.floor(size / 2)
  let error = dx + dy

  ctx.save()
  ctx.fillStyle = color
  for (;;) {
    ctx.fillRect(x - half, y - half, size, size)
    if (x === endX && y === endY) break
    const doubled = 2 * error
    if (doubled >= dy) {
      error += dy
      x += stepX
    }
    if (doubled <= dx) {
      error += dx
      y += stepY
    }
  }
  ctx.restore()
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  tool: ShapeTool,
  from: Point,
  to: Point,
  size: number,
  color: string,
  filled: boolean
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (tool === 'line') {
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  } else if (tool === 'rect') {
    ctx.rect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y))
    if (filled) ctx.fill()
    else ctx.stroke()
  } else {
    ctx.ellipse(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2,
      Math.abs(to.x - from.x) / 2,
      Math.abs(to.y - from.y) / 2,
      0,
      0,
      Math.PI * 2
    )
    if (filled) ctx.fill()
    else ctx.stroke()
  }
  ctx.restore()
}

/**
 * Relleno por inundación (por filas). Pinta de `fill` la región contigua de píxeles parecidos al
 * del punto de partida; `tolerance` es la diferencia máxima por canal (0–255), para que los bordes
 * suavizados de un trazo no dejen un halo. Devuelve `false` si no cambió nada.
 */
export function floodFill(image: ImageData, startX: number, startY: number, fill: Rgba, tolerance: number): boolean {
  const { width, height, data } = image
  const x0 = Math.floor(startX)
  const y0 = Math.floor(startY)
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return false

  const origin = (y0 * width + x0) * 4
  const target: Rgba = [data[origin] ?? 0, data[origin + 1] ?? 0, data[origin + 2] ?? 0, data[origin + 3] ?? 0]
  if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === fill[3]) return false

  const matches = (x: number, y: number): boolean => {
    const at = (y * width + x) * 4
    return (
      Math.abs((data[at] ?? 0) - target[0]) <= tolerance &&
      Math.abs((data[at + 1] ?? 0) - target[1]) <= tolerance &&
      Math.abs((data[at + 2] ?? 0) - target[2]) <= tolerance &&
      Math.abs((data[at + 3] ?? 0) - target[3]) <= tolerance
    )
  }

  const visited = new Uint8Array(width * height)
  const stack: number[] = [x0, y0]
  while (stack.length > 0) {
    const y = stack.pop() ?? 0
    const x = stack.pop() ?? 0
    if (visited[y * width + x] === 1 || !matches(x, y)) continue

    let left = x
    while (left > 0 && visited[y * width + left - 1] !== 1 && matches(left - 1, y)) left -= 1
    let right = x
    while (right < width - 1 && visited[y * width + right + 1] !== 1 && matches(right + 1, y)) right += 1

    for (let column = left; column <= right; column += 1) {
      visited[y * width + column] = 1
      const at = (y * width + column) * 4
      data[at] = fill[0]
      data[at + 1] = fill[1]
      data[at + 2] = fill[2]
      data[at + 3] = fill[3]
    }
    for (const row of [y - 1, y + 1]) {
      if (row < 0 || row >= height) continue
      let inRun = false
      for (let column = left; column <= right; column += 1) {
        const open = visited[row * width + column] !== 1 && matches(column, row)
        if (open && !inRun) stack.push(column, row)
        inRun = open
      }
    }
  }
  return true
}
