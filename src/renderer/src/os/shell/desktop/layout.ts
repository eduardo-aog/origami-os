import type { SettingValue } from '../../kernel/settings'

/** Medidas de la retícula invisible del escritorio, en píxeles. */
export const CELL_WIDTH = 96
export const CELL_HEIGHT = 104
export const GRID_LEFT = 16
export const GRID_TOP = 40

export interface Cell {
  col: number
  row: number
}

export interface Grid {
  cols: number
  rows: number
}

export type DesktopItem = SettingValue<'desktop.items'>[number]

export const cellKey = ({ col, row }: Cell) => `${col}:${row}`

export const cellToPosition = ({ col, row }: Cell) => ({ x: GRID_LEFT + col * CELL_WIDTH, y: GRID_TOP + row * CELL_HEIGHT })

export function positionToCell(x: number, y: number): Cell {
  return { col: Math.round((x - GRID_LEFT) / CELL_WIDTH), row: Math.round((y - GRID_TOP) / CELL_HEIGHT) }
}

export function gridSize(viewport: { width: number; height: number }, reservedBottom: number): Grid {
  return {
    cols: Math.max(1, Math.floor((viewport.width - GRID_LEFT) / CELL_WIDTH)),
    rows: Math.max(1, Math.floor((viewport.height - GRID_TOP - reservedBottom) / CELL_HEIGHT))
  }
}

export function clampCell(cell: Cell, grid: Grid): Cell {
  return { col: Math.min(Math.max(cell.col, 0), grid.cols - 1), row: Math.min(Math.max(cell.row, 0), grid.rows - 1) }
}

export function occupiedCells(items: readonly DesktopItem[], ignore: ReadonlySet<string> = new Set()): Set<string> {
  return new Set(items.filter((item) => !ignore.has(item.id)).map((item) => cellKey(positionToCell(item.x, item.y))))
}

/** Primera celda libre recorriendo la retícula por columnas, desde la esquina superior izquierda. */
export function firstFreeCell(occupied: ReadonlySet<string>, grid: Grid): Cell {
  for (let col = 0; col < grid.cols; col++) {
    for (let row = 0; row < grid.rows; row++) {
      if (!occupied.has(cellKey({ col, row }))) return { col, row }
    }
  }
  // Retícula llena: se sigue en columnas nuevas (el icono quedará fuera de la vista hasta ordenar).
  let extra = grid.cols
  while (occupied.has(cellKey({ col: extra, row: 0 }))) extra += 1
  return { col: extra, row: 0 }
}

/** Celda libre más cercana a `target` dentro de la retícula. */
export function nearestFreeCell(target: Cell, occupied: ReadonlySet<string>, grid: Grid): Cell {
  const start = clampCell(target, grid)
  if (!occupied.has(cellKey(start))) return start
  for (let radius = 1; radius < Math.max(grid.cols, grid.rows); radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
        const candidate = { col: start.col + dc, row: start.row + dr }
        if (candidate.col < 0 || candidate.row < 0 || candidate.col >= grid.cols || candidate.row >= grid.rows) continue
        if (!occupied.has(cellKey(candidate))) return candidate
      }
    }
  }
  return firstFreeCell(occupied, grid)
}
