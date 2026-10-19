import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Maximize,
  Monitor,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Button, EmptyState, IconButton, Toolbar, ToolbarSeparator, ToolbarSpacer, useFsObjectUrl } from '@os/ui'
import { useAppMenus, useFsWatch, useLaunchArgs, useOS, type AppMenu } from '@os/sdk'
import {
  IMAGE_EXTENSIONS,
  baseName,
  byName,
  clampScale,
  fitScale,
  folderOf,
  formatPercent,
  isImageName,
  rotatedSize,
  zoomOffset,
  type Offset,
  type Size
} from './view'
import './viewer.css'

const ZOOM_STEP = 1.25
const FALLBACK_SIZE = 512

interface View {
  path: string | null
  /** `null` = ajustada a la ventana. */
  scale: number | null
  offset: Offset
  rotation: number
}

const freshView = (path: string | null): View => ({ path, scale: null, offset: { x: 0, y: 0 }, rotation: 0 })

export default function App() {
  const os = useOS()
  const args = useLaunchArgs()
  const initialPath = typeof args.filePath === 'string' ? args.filePath : null

  const [view, setView] = useState<View>(() => freshView(initialPath))
  const [natural, setNatural] = useState<(Size & { path: string }) | null>(null)
  const [box, setBox] = useState<Size>({ width: 0, height: 0 })
  const [dragging, setDragging] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; startX: number; startY: number; origin: Offset } | null>(null)

  const path = view.path
  const folder = path === null ? '~' : folderOf(path)
  const siblings = useFsWatch(folder)
  const images = useMemo(
    () => siblings.filter((node) => node.kind === 'file' && isImageName(node.name)).sort(byName),
    [siblings]
  )
  const name = path === null ? null : baseName(path)
  const index = name === null ? -1 : images.findIndex((node) => node.name === name)
  const current = index === -1 ? null : (images[index] ?? null)
  const { url, error } = useFsObjectUrl(path)
  const size = natural !== null && natural.path === path ? natural : null

  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    os.window.setTitle(name === null ? os.app.manifest.name : `${name} — ${os.app.manifest.name}`)
  }, [os.window, os.app.manifest.name, name])

  useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [path])

  const natSize: Size = size ?? { width: FALLBACK_SIZE, height: FALLBACK_SIZE }
  const fit = fitScale(box, natSize, view.rotation)
  const scale = view.scale ?? fit

  function open(next: string) {
    setView(freshView(next))
  }

  function go(step: 1 | -1) {
    const target = images[index + step]
    if (target) open(`${folder === '/' ? '' : folder}/${target.name}`)
  }

  function zoomTo(next: number, anchor: Offset = { x: 0, y: 0 }) {
    const to = clampScale(next)
    setView((previous) => {
      const from = previous.scale ?? fit
      return { ...previous, scale: to, offset: zoomOffset(previous.offset, anchor, from, to) }
    })
  }

  const fitToWindow = () => setView((previous) => ({ ...previous, scale: null, offset: { x: 0, y: 0 } }))
  const actualSize = () => setView((previous) => ({ ...previous, scale: 1, offset: { x: 0, y: 0 } }))
  const rotate = (quarters: number) =>
    setView((previous) => ({ ...previous, rotation: previous.rotation + quarters * 90, scale: null, offset: { x: 0, y: 0 } }))

  async function pickImage() {
    const picked = await os.dialogs.openFile({ startPath: path === null ? '~/Imágenes' : folder, extensions: IMAGE_EXTENSIONS })
    const target = picked?.[0]
    if (target !== undefined) open(target)
    root.current?.focus()
  }

  function setAsWallpaper() {
    if (path !== null) os.apps.launch('settings', { section: 'appearance', wallpaperPath: path })
  }

  function showInfo() {
    if (current === null) return
    void os.dialogs.info(current.id).then(() => root.current?.focus())
  }

  const broken = size !== null && size.width === 0
  const hasImage = path !== null && current !== null && url !== null && !broken

  const menus: AppMenu[] = [
    {
      label: 'Archivo',
      items: [
        { label: 'Abrir…', shortcut: 'Ctrl+O', onSelect: () => void pickImage() },
        { separator: true },
        { label: 'Establecer como fondo de pantalla', disabled: !hasImage, onSelect: setAsWallpaper },
        { label: 'Información', shortcut: 'Ctrl+I', disabled: current === null, onSelect: showInfo }
      ]
    },
    {
      label: 'Visualización',
      items: [
        { label: 'Acercar', shortcut: 'Ctrl++', disabled: !hasImage, onSelect: () => zoomTo(scale * ZOOM_STEP) },
        { label: 'Alejar', shortcut: 'Ctrl+-', disabled: !hasImage, onSelect: () => zoomTo(scale / ZOOM_STEP) },
        { label: 'Tamaño real', shortcut: 'Ctrl+1', disabled: !hasImage, onSelect: actualSize },
        { label: 'Ajustar a la ventana', shortcut: 'Ctrl+0', disabled: !hasImage, onSelect: fitToWindow },
        { separator: true },
        { label: 'Girar a la izquierda', shortcut: 'Ctrl+L', disabled: !hasImage, onSelect: () => rotate(-1) },
        { label: 'Girar a la derecha', shortcut: 'Ctrl+R', disabled: !hasImage, onSelect: () => rotate(1) },
        { separator: true },
        { label: 'Imagen anterior', shortcut: '←', disabled: index <= 0, onSelect: () => go(-1) },
        { label: 'Imagen siguiente', shortcut: '→', disabled: index === -1 || index >= images.length - 1, onSelect: () => go(1) }
      ]
    }
  ]
  useAppMenus(menus)

  function onKeyDown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return
    const mod = event.ctrlKey || event.metaKey
    if (!mod && !event.altKey) {
      if (event.key === 'ArrowLeft') go(-1)
      else if (event.key === 'ArrowRight') go(1)
      else return
      event.preventDefault()
      return
    }
    if (!mod || event.altKey) return
    const actions: Record<string, () => void> = {
      o: () => void pickImage(),
      i: showInfo,
      '+': () => zoomTo(scale * ZOOM_STEP),
      '=': () => zoomTo(scale * ZOOM_STEP),
      '-': () => zoomTo(scale / ZOOM_STEP),
      '1': actualSize,
      '0': fitToWindow,
      l: () => rotate(-1),
      r: () => rotate(1)
    }
    const action = actions[event.key.toLowerCase()]
    if (action === undefined) return
    event.preventDefault()
    action()
  }

  function onWheel(event: WheelEvent) {
    if (!hasImage) return
    const rect = event.currentTarget.getBoundingClientRect()
    const anchor = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }
    zoomTo(scale * Math.exp(-event.deltaY * 0.0015), anchor)
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !hasImage) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, origin: view.offset }
    setDragging(true)
  }

  function onPointerMove(event: PointerEvent) {
    const state = drag.current
    if (!state || state.pointer !== event.pointerId) return
    const offset = { x: state.origin.x + event.clientX - state.startX, y: state.origin.y + event.clientY - state.startY }
    setView((previous) => ({ ...previous, scale: previous.scale ?? fit, offset }))
  }

  function endDrag(event: PointerEvent) {
    if (drag.current?.pointer !== event.pointerId) return
    drag.current = null
    setDragging(false)
  }

  const rotated = rotatedSize(natSize, view.rotation)
  const canPan = hasImage && (view.scale !== null || scale * rotated.width > box.width || scale * rotated.height > box.height)

  if (path === null) {
    return (
      <div ref={root} className="viewer" tabIndex={-1} onKeyDown={onKeyDown}>
        <EmptyState
          icon={<ImageIcon size={40} />}
          title="No hay ninguna imagen abierta"
          description="Abre una imagen para verla, ampliarla o girarla."
        >
          <Button variant="primary" onClick={() => void pickImage()}>
            <FolderOpen size={14} />
            Abrir imagen…
          </Button>
        </EmptyState>
      </div>
    )
  }

  return (
    <div ref={root} className="viewer" tabIndex={-1} onKeyDown={onKeyDown}>
      <Toolbar className="viewer__toolbar" aria-label="Herramientas">
        <IconButton label="Imagen anterior" disabled={index <= 0} onClick={() => go(-1)}>
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton label="Imagen siguiente" disabled={index === -1 || index >= images.length - 1} onClick={() => go(1)}>
          <ChevronRight size={16} />
        </IconButton>
        <ToolbarSeparator />
        <IconButton label="Alejar" disabled={!hasImage} onClick={() => zoomTo(scale / ZOOM_STEP)}>
          <ZoomOut size={16} />
        </IconButton>
        <button
          type="button"
          className="viewer__percent"
          title={view.scale === null ? 'Tamaño real' : 'Ajustar a la ventana'}
          disabled={!hasImage}
          onClick={view.scale === null ? actualSize : fitToWindow}
        >
          {formatPercent(scale)}
        </button>
        <IconButton label="Acercar" disabled={!hasImage} onClick={() => zoomTo(scale * ZOOM_STEP)}>
          <ZoomIn size={16} />
        </IconButton>
        <IconButton label="Ajustar a la ventana" active={view.scale === null} disabled={!hasImage} onClick={fitToWindow}>
          <Maximize size={16} />
        </IconButton>
        <ToolbarSeparator />
        <IconButton label="Girar a la izquierda" disabled={!hasImage} onClick={() => rotate(-1)}>
          <RotateCcw size={16} />
        </IconButton>
        <IconButton label="Girar a la derecha" disabled={!hasImage} onClick={() => rotate(1)}>
          <RotateCw size={16} />
        </IconButton>
        <ToolbarSpacer />
        {index !== -1 ? (
          <span className="viewer__counter">
            {index + 1} de {images.length}
          </span>
        ) : null}
        <IconButton label="Establecer como fondo de pantalla" disabled={!hasImage} onClick={setAsWallpaper}>
          <Monitor size={16} />
        </IconButton>
        <IconButton label="Información" disabled={current === null} onClick={showInfo}>
          <Info size={16} />
        </IconButton>
      </Toolbar>

      <div
        ref={stage}
        className={[
          'viewer__stage',
          canPan ? 'viewer__stage--pannable' : '',
          dragging ? 'viewer__stage--dragging' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={view.scale === null ? actualSize : fitToWindow}
      >
        {url !== null ? (
          <img
            key={path}
            className="viewer__canvas"
            src={url}
            alt={name ?? ''}
            draggable={false}
            style={{
              width: natSize.width,
              height: natSize.height,
              marginLeft: -natSize.width / 2,
              marginTop: -natSize.height / 2,
              opacity: size === null ? 0 : 1,
              transform: `translate(${view.offset.x}px, ${view.offset.y}px) scale(${scale}) rotate(${view.rotation}deg)`
            }}
            onLoad={(event) => {
              const image = event.currentTarget
              setNatural({
                path,
                width: image.naturalWidth || FALLBACK_SIZE,
                height: image.naturalHeight || FALLBACK_SIZE
              })
            }}
            onError={() => setNatural({ path, width: 0, height: 0 })}
          />
        ) : null}
        {error !== null ? <p className="viewer__message">{error}</p> : null}
        {broken ? (
          <p className="viewer__message">No se puede mostrar este archivo como imagen.</p>
        ) : null}
      </div>
    </div>
  )
}
