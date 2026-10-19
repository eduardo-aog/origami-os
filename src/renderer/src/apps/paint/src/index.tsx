import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import {
  Brush,
  Eraser,
  FilePlus2,
  FolderOpen,
  PaintBucket,
  Pencil,
  Pipette,
  Redo2,
  Save,
  Slash,
  Square,
  Circle,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon
} from 'lucide-react'
import { IconButton, SegmentedControl, Select, Slider, Toolbar, ToolbarSeparator, ToolbarSpacer } from '@os/ui'
import { useAppMenus, useLaunchArgs, useOS, useUnsavedChanges, type AppMenu } from '@os/sdk'
import {
  drawSegment,
  drawShape,
  floodFill,
  historyLimit,
  isFreehandTool,
  isShapeTool,
  parseHex,
  toHex,
  validateSize,
  type Point,
  type Tool
} from './engine'
import { NewCanvas } from './NewCanvas'
import { CANVAS_BACKGROUND, DEFAULT_COLOR, PALETTE } from './palette'
import './paint.css'

const UNTITLED = 'Sin título.png'
const OPEN_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]
const FILL_TOLERANCE = 24
const TEXT_SIZES = [12, 16, 24, 32, 48, 64, 96]

const TOOLS: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'brush', label: 'Pincel', icon: Brush },
  { id: 'pencil', label: 'Lápiz', icon: Pencil },
  { id: 'eraser', label: 'Borrador', icon: Eraser },
  { id: 'line', label: 'Línea', icon: Slash },
  { id: 'rect', label: 'Rectángulo', icon: Square },
  { id: 'ellipse', label: 'Elipse', icon: Circle },
  { id: 'fill', label: 'Relleno', icon: PaintBucket },
  { id: 'picker', label: 'Cuentagotas', icon: Pipette },
  { id: 'text', label: 'Texto', icon: Type }
]

interface Doc {
  width: number
  height: number
  /** Ruta del `.png` en el que se guarda; `null` mientras no tenga archivo. */
  path: string | null
  name: string
}

interface Snapshot {
  data: ImageData
  id: number
}

interface History {
  states: Snapshot[]
  index: number
  nextId: number
  /** Identificador de la versión guardada; si el estado actual es otro, hay cambios sin guardar. */
  savedId: number
  limit: number
}

type Gesture =
  | { kind: 'freehand'; tool: 'brush' | 'pencil' | 'eraser'; last: Point }
  | { kind: 'shape'; tool: 'line' | 'rect' | 'ellipse'; start: Point }

const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path
const folderOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/'
const stripExtension = (name: string) => (name.lastIndexOf('.') > 0 ? name.slice(0, name.lastIndexOf('.')) : name)
const isPng = (name: string) => /\.png$/i.test(name)
const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

export default function App() {
  const os = useOS()
  const { fs, dialogs } = os
  const args = useLaunchArgs()
  const initialFile = typeof args.filePath === 'string' ? args.filePath : null

  const [doc, setDoc] = useState<Doc | null>(null)
  const [hist, setHist] = useState({ canUndo: false, canRedo: false, dirty: false })
  const [panel, setPanel] = useState(initialFile === null)
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [size, setSize] = useState(4)
  const [filled, setFilled] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [textSize, setTextSize] = useState(24)
  const [textBox, setTextBox] = useState<Point | null>(null)

  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const history = useRef<History | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const previousTool = useRef<Tool>('brush')
  const textRef = useRef<{ box: Point; value: string } | null>(null)

  const context = () => canvas.current?.getContext('2d', { willReadFrequently: true }) ?? null

  const sync = useCallback(() => {
    const h = history.current
    if (!h) return
    setHist({
      canUndo: h.index > 0,
      canRedo: h.index < h.states.length - 1,
      dirty: h.states[h.index]?.id !== h.savedId
    })
  }, [])

  /** Guarda el estado actual del lienzo como un paso nuevo del historial (descartando los rehacer). */
  function commit() {
    const h = history.current
    const ctx = context()
    const element = canvas.current
    if (!h || !ctx || !element) return
    h.states.length = h.index + 1
    h.states.push({ data: ctx.getImageData(0, 0, element.width, element.height), id: h.nextId })
    h.nextId += 1
    while (h.states.length > h.limit + 1) h.states.shift()
    h.index = h.states.length - 1
    sync()
  }

  const createDocument = useCallback(
    (width: number, height: number, source: ImageBitmap | null, path: string | null, name: string) => {
      const element = canvas.current
      const preview = overlay.current
      const ctx = element?.getContext('2d', { willReadFrequently: true })
      if (!element || !preview || !ctx) return
      element.width = width
      element.height = height
      preview.width = width
      preview.height = height
      if (source) {
        ctx.drawImage(source, 0, 0)
      } else {
        ctx.fillStyle = CANVAS_BACKGROUND
        ctx.fillRect(0, 0, width, height)
      }
      history.current = {
        states: [{ data: ctx.getImageData(0, 0, width, height), id: 1 }],
        index: 0,
        nextId: 2,
        savedId: 1,
        limit: historyLimit(width, height)
      }
      textRef.current = null
      setTextBox(null)
      setDoc({ width, height, path, name })
      setZoom(1)
      setPanel(false)
      sync()
    },
    [sync]
  )

  const loadImage = useCallback(
    async (target: string): Promise<boolean> => {
      try {
        const blob = await fs.readFile(target)
        const bitmap = await createImageBitmap(blob).catch(() => {
          throw new Error('El archivo no es una imagen válida o está dañado.')
        })
        const problem = validateSize(bitmap.width, bitmap.height)
        if (problem !== null) {
          bitmap.close()
          await dialogs.alert({ title: 'No se puede abrir la imagen', message: problem })
          return false
        }
        const name = baseName(target)
        // Solo un `.png` se guarda sobre su propio archivo; el resto se guarda como un `.png` nuevo.
        createDocument(
          bitmap.width,
          bitmap.height,
          bitmap,
          isPng(name) ? target : null,
          isPng(name) ? name : `${stripExtension(name)}.png`
        )
        bitmap.close()
        return true
      } catch (error) {
        await dialogs.alert({ title: 'No se pudo abrir la imagen', message: describeError(error) })
        return false
      }
    },
    [fs, dialogs, createDocument]
  )

  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    if (initialFile === null) return
    let active = true
    void loadImage(initialFile).then((opened) => {
      if (active && !opened) setPanel(true)
    })
    return () => {
      active = false
    }
  }, [initialFile, loadImage])

  useEffect(() => {
    os.window.setTitle(`${hist.dirty ? '● ' : ''}${doc?.name ?? UNTITLED} — ${os.app.manifest.name}`)
  }, [os.window, os.app.manifest.name, doc?.name, hist.dirty])

  /** Dibuja el texto que se está escribiendo (si hay) y cierra el cuadro. */
  function closeText(apply: boolean) {
    const pending = textRef.current
    textRef.current = null
    setTextBox(null)
    const ctx = context()
    if (!apply || !pending || !ctx || pending.value.trim() === '') return
    ctx.save()
    ctx.fillStyle = color
    ctx.textBaseline = 'top'
    ctx.font = `${textSize}px ${root.current ? getComputedStyle(root.current).fontFamily : 'sans-serif'}`
    ctx.fillText(pending.value, pending.box.x, pending.box.y)
    ctx.restore()
    commit()
  }

  function selectTool(next: Tool) {
    closeText(true)
    if (next !== tool) previousTool.current = tool
    setTool(next)
  }

  function restore(index: number) {
    const h = history.current
    const ctx = context()
    const snapshot = h?.states[index]
    if (!h || !ctx || !snapshot) return
    h.index = index
    ctx.putImageData(snapshot.data, 0, 0)
    sync()
  }

  function undo() {
    closeText(true)
    const h = history.current
    if (h && h.index > 0) restore(h.index - 1)
  }

  function redo() {
    closeText(true)
    const h = history.current
    if (h && h.index < h.states.length - 1) restore(h.index + 1)
  }

  function pointOf(event: PointerEvent): Point | null {
    const element = canvas.current
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * element.width) / rect.width,
      y: ((event.clientY - rect.top) * element.height) / rect.height
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || doc === null || panel) return
    const point = pointOf(event)
    const ctx = context()
    if (!point || !ctx) return

    if (tool === 'text') {
      event.preventDefault()
      closeText(true)
      const box = { x: Math.round(point.x), y: Math.round(point.y) }
      textRef.current = { box, value: '' }
      setTextBox(box)
      return
    }
    closeText(true)

    if (tool === 'picker') {
      const pixel = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data
      if ((pixel[3] ?? 0) > 0) setColor(toHex(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0))
      setTool(previousTool.current === 'picker' ? 'brush' : previousTool.current)
      return
    }
    if (tool === 'fill') {
      const element = canvas.current
      if (!element) return
      const image = ctx.getImageData(0, 0, element.width, element.height)
      if (floodFill(image, point.x, point.y, parseHex(color), FILL_TOLERANCE)) {
        ctx.putImageData(image, 0, 0)
        commit()
      }
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    if (isFreehandTool(tool)) {
      gesture.current = { kind: 'freehand', tool, last: point }
      drawSegment(ctx, tool, point, point, size, tool === 'eraser' ? CANVAS_BACKGROUND : color)
    } else if (isShapeTool(tool)) {
      gesture.current = { kind: 'shape', tool, start: point }
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current
    const point = pointOf(event)
    const ctx = context()
    if (!active || !point || !ctx) return
    if (active.kind === 'freehand') {
      drawSegment(ctx, active.tool, active.last, point, size, active.tool === 'eraser' ? CANVAS_BACKGROUND : color)
      active.last = point
      return
    }
    const preview = overlay.current?.getContext('2d')
    if (!preview || !overlay.current) return
    preview.clearRect(0, 0, overlay.current.width, overlay.current.height)
    drawShape(preview, active.tool, active.start, point, size, color, filled)
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current
    if (!active) return
    gesture.current = null
    const point = pointOf(event)
    const ctx = context()
    if (active.kind === 'shape') {
      const preview = overlay.current
      preview?.getContext('2d')?.clearRect(0, 0, preview.width, preview.height)
      if (point && ctx) drawShape(ctx, active.tool, active.start, point, size, color, filled)
    }
    commit()
  }

  async function writePng(target: string): Promise<boolean> {
    closeText(true)
    const element = canvas.current
    if (!element) return false
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        element.toBlob((result) => (result ? resolve(result) : reject(new Error('No se pudo generar la imagen.'))), 'image/png')
      )
      await fs.writeFile(target, blob, { overwrite: true, mime: 'image/png' })
      const h = history.current
      if (h) h.savedId = h.states[h.index]?.id ?? h.savedId
      setDoc((previous) => (previous ? { ...previous, path: target, name: baseName(target) } : previous))
      sync()
      return true
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo guardar', message: describeError(error) })
      return false
    }
  }

  async function saveAs(): Promise<boolean> {
    if (doc === null) return false
    closeText(true)
    let target = await dialogs.saveFile({
      startPath: doc.path === null ? '~/Imágenes' : folderOf(doc.path),
      defaultName: doc.name,
      extensions: ['png']
    })
    root.current?.focus()
    if (target === null) return false
    if (!isPng(target)) {
      target = `${target}.png`
      if (
        (await fs.exists(target)) &&
        !(await dialogs.confirm({ title: `¿Reemplazar «${baseName(target)}»?`, confirmLabel: 'Reemplazar', destructive: true }))
      ) {
        return false
      }
    }
    return writePng(target)
  }

  async function save(): Promise<boolean> {
    if (doc === null) return false
    const saved = doc.path === null ? await saveAs() : await writePng(doc.path)
    root.current?.focus()
    return saved
  }

  const { confirmDiscard } = useUnsavedChanges({ isDirty: hist.dirty, documentName: doc?.name ?? UNTITLED, save })

  async function openImage() {
    closeText(true)
    const picked = await dialogs.openFile({
      startPath: doc?.path == null ? '~/Imágenes' : folderOf(doc.path),
      extensions: OPEN_EXTENSIONS
    })
    const target = picked?.[0]
    if (target !== undefined && (await confirmDiscard())) await loadImage(target)
    root.current?.focus()
  }

  /** Los cambios sin guardar se preguntan al crear o abrir, no al mostrar el panel. */
  function requestNew() {
    closeText(true)
    setPanel(true)
  }

  function stepZoom(direction: 1 | -1) {
    const nearest = ZOOMS.findIndex((value) => value >= zoom)
    const index = nearest === -1 ? ZOOMS.length - 1 : nearest
    const target = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, index + direction))]
    if (target !== undefined) setZoom(target)
  }

  const menus: AppMenu[] = [
    {
      label: 'Archivo',
      items: [
        { label: 'Nuevo…', shortcut: 'Ctrl+N', onSelect: () => requestNew() },
        { label: 'Abrir…', shortcut: 'Ctrl+O', onSelect: () => void openImage() },
        { separator: true },
        { label: 'Guardar', shortcut: 'Ctrl+S', disabled: doc === null, onSelect: () => void save() },
        { label: 'Guardar como…', shortcut: 'Ctrl+Shift+S', disabled: doc === null, onSelect: () => void saveAs() }
      ]
    },
    {
      label: 'Edición',
      items: [
        { label: 'Deshacer', shortcut: 'Ctrl+Z', disabled: !hist.canUndo, onSelect: undo },
        { label: 'Rehacer', shortcut: 'Ctrl+Y', disabled: !hist.canRedo, onSelect: redo }
      ]
    },
    {
      label: 'Visualización',
      items: [
        { label: 'Acercar', shortcut: 'Ctrl++', disabled: doc === null, onSelect: () => stepZoom(1) },
        { label: 'Alejar', shortcut: 'Ctrl+-', disabled: doc === null, onSelect: () => stepZoom(-1) },
        { label: 'Tamaño real', shortcut: 'Ctrl+0', disabled: doc === null, onSelect: () => setZoom(1) }
      ]
    }
  ]
  useAppMenus(menus)

  function onKeyDown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement && event.target.type !== 'range') return
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLowerCase()
    const shortcuts: Record<string, () => void> = {
      z: event.shiftKey ? redo : undo,
      y: redo,
      s: () => void (event.shiftKey ? saveAs() : save()),
      n: () => requestNew(),
      o: () => void openImage(),
      '+': () => stepZoom(1),
      '=': () => stepZoom(1),
      '-': () => stepZoom(-1),
      '0': () => setZoom(1)
    }
    const action = shortcuts[key]
    if (action === undefined) return
    event.preventDefault()
    action()
  }

  const sheetStyle: CSSProperties | undefined =
    doc === null ? { display: 'none' } : { width: doc.width * zoom, height: doc.height * zoom }

  return (
    <div ref={root} className="paint" tabIndex={-1} onKeyDown={onKeyDown}>
      <Toolbar aria-label="Herramientas del archivo">
        <IconButton label="Nuevo…" onClick={() => requestNew()}>
          <FilePlus2 size={16} />
        </IconButton>
        <IconButton label="Abrir…" onClick={() => void openImage()}>
          <FolderOpen size={16} />
        </IconButton>
        <IconButton label="Guardar" disabled={doc === null} onClick={() => void save()}>
          <Save size={16} />
        </IconButton>
        <ToolbarSeparator />
        <IconButton label="Deshacer" disabled={!hist.canUndo} onClick={undo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Rehacer" disabled={!hist.canRedo} onClick={redo}>
          <Redo2 size={16} />
        </IconButton>
        <ToolbarSeparator />
        <IconButton label="Alejar" disabled={doc === null} onClick={() => stepZoom(-1)}>
          <ZoomOut size={16} />
        </IconButton>
        <span className="paint__zoom">{Math.round(zoom * 100)} %</span>
        <IconButton label="Acercar" disabled={doc === null} onClick={() => stepZoom(1)}>
          <ZoomIn size={16} />
        </IconButton>
        <ToolbarSpacer />
        {doc !== null ? (
          <span className="paint__dimensions">
            {doc.width} × {doc.height} px
          </span>
        ) : null}
      </Toolbar>

      <div className="paint__workspace">
        <div className="paint__tools" role="toolbar" aria-orientation="vertical" aria-label="Herramientas de dibujo">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <IconButton key={id} label={label} active={tool === id} disabled={doc === null} onClick={() => selectTool(id)}>
              <Icon size={16} />
            </IconButton>
          ))}
        </div>

        <div className="paint__scroller">
          <div
            className="paint__sheet"
            style={sheetStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas
              ref={canvas}
              className={['paint__canvas', zoom > 1 ? 'paint__canvas--pixelated' : ''].filter(Boolean).join(' ')}
              aria-label="Lienzo"
            />
            <canvas ref={overlay} className="paint__canvas paint__overlay" aria-hidden="true" />
            {textBox !== null && doc !== null ? (
              <input
                className="paint__text"
                aria-label="Texto"
                autoFocus
                style={{
                  left: textBox.x * zoom,
                  top: textBox.y * zoom,
                  color,
                  fontSize: textSize * zoom
                }}
                onChange={(event) => {
                  if (textRef.current) textRef.current.value = event.target.value
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onBlur={() => closeText(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    closeText(true)
                    root.current?.focus()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    closeText(false)
                    root.current?.focus()
                  }
                }}
              />
            ) : null}
          </div>
        </div>

        {panel ? (
          <NewCanvas
            canCancel={doc !== null}
            onCreate={(width, height) => {
              void confirmDiscard().then((proceed) => {
                if (proceed) createDocument(width, height, null, null, UNTITLED)
              })
            }}
            onOpen={() => void openImage()}
            onCancel={() => {
              setPanel(false)
              root.current?.focus()
            }}
          />
        ) : null}
      </div>

      <div className="paint__options">
        <div className="paint__palette" role="group" aria-label="Paleta de colores">
          {PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className="paint__swatch"
              title={swatch}
              aria-label={swatch}
              aria-pressed={swatch.toLowerCase() === color.toLowerCase()}
              style={{ background: swatch }}
              onClick={() => setColor(swatch)}
              onMouseDown={(event) => event.preventDefault()}
            />
          ))}
        </div>
        <label className="paint__picker">
          <input
            type="color"
            aria-label="Elegir otro color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>
        <ToolbarSeparator />
        <div className="paint__size">
          <span className="paint__option-label">Grosor</span>
          <div className="paint__size-slider">
            <Slider aria-label="Grosor" min={1} max={40} value={size} onChange={setSize} />
          </div>
          <span className="paint__size-value">{size} px</span>
        </div>
        {tool === 'rect' || tool === 'ellipse' ? (
          <SegmentedControl
            aria-label="Estilo de la forma"
            value={filled ? 'filled' : 'outline'}
            onChange={(value) => setFilled(value === 'filled')}
            options={[
              { value: 'outline', label: 'Contorno' },
              { value: 'filled', label: 'Relleno' }
            ]}
          />
        ) : null}
        {tool === 'text' ? (
          <Select
            aria-label="Tamaño del texto"
            value={String(textSize)}
            onChange={(value) => setTextSize(Number(value))}
            options={TEXT_SIZES.map((value) => ({ value: String(value), label: `${value} px` }))}
          />
        ) : null}
      </div>
    </div>
  )
}
