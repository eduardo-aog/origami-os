import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FolderPlus,
  Home,
  Image,
  LayoutGrid,
  List as ListIcon,
  Monitor,
  Music,
  Trash2,
  Video,
  type LucideIcon
} from 'lucide-react'
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref
} from 'react'
import { fs, joinPath, parentPath, TRASH_NAME, type FsNode } from '../kernel/fs'
import { useFsFolder, useFsTrash } from '../kernel/fs/hooks'
import { useContextMenu, type MenuItem } from './ContextMenu'
import { getNodeDrag, hasNodeDrag, setNodeDrag } from './drag'
import { EmptyState } from './EmptyState'
import { FileIcon } from './FileIcon'
import { IconButton } from './IconButton'
import { TextField } from './TextField'
import { describeKind, formatBytes, formatDateTime } from './format'
import './FileBrowser.css'

/** Ruta de la papelera: en el modo `manage` es un lugar más, cuyo contenido son los elementos eliminados. */
export const TRASH_PATH = `/${TRASH_NAME}`

export type FileBrowserView = 'list' | 'icons'

export interface FileBrowserState {
  /** Carpeta que se está mostrando (ruta absoluta; `TRASH_PATH` en la papelera). */
  path: string
  /** Rutas de lo seleccionado que cumple las condiciones (`folders`, `extensions`). */
  selection: string[]
  /** Nombre escrito en el modo "save". */
  name: string
  /** Todo lo seleccionado, sin filtrar. */
  nodes: FsNode[]
  /** Se está mostrando la papelera. */
  inTrash: boolean
}

/** Lo que hay bajo el puntero al abrir un menú contextual en el modo `manage`. */
export interface FileBrowserContext {
  /** Elementos seleccionados; vacío si se hizo clic en el fondo. */
  nodes: FsNode[]
  /** Carpeta que se está mostrando. */
  folder: string
  inTrash: boolean
}

/** Acciones que quien usa el explorador puede lanzar desde fuera (menús, atajos). */
export interface FileBrowserHandle {
  navigate(path: string): void
  /** Crea una carpeta nueva y deja su nombre en edición (modo `manage`). */
  createFolder(): Promise<void>
  /** Pone en edición el nombre de un elemento de la carpeta actual. */
  rename(nodeId: string): void
  selectAll(): void
  focus(): void
}

export interface FileBrowserProps {
  /** Carpeta inicial (por defecto "~"). Si es un archivo, se abre su carpeta. */
  startPath?: string
  /**
   * `open` y `save` son los diálogos de abrir y guardar. `manage` es el explorador completo de la
   * app Archivos: papelera, vistas, menú contextual, renombrado en línea y arrastrar y soltar.
   */
  mode?: 'open' | 'save' | 'manage'
  multiple?: boolean
  /** Se eligen carpetas en lugar de archivos. */
  folders?: boolean
  /** Solo se pueden elegir archivos con estas extensiones (sin punto). */
  extensions?: string[]
  defaultName?: string
  /** Vista actual (modo `manage`). Sin ella el explorador la recuerda por su cuenta. */
  view?: FileBrowserView
  onViewChange?: (view: FileBrowserView) => void
  /** Botones propios al final de la barra de herramientas (modo `manage`). */
  toolbar?: ReactNode
  /** Opciones del menú contextual; sin ellas no se muestra ninguno (modo `manage`). */
  contextMenu?: (context: FileBrowserContext) => MenuItem[]
  /** Se soltaron elementos sobre la Papelera (modo `manage`). */
  onTrash?: (nodes: FsNode[]) => void
  /** Algo que el explorador hace por su cuenta (renombrar, mover…) ha fallado. */
  onError?: (title: string, error: unknown) => void
  onChange?: (state: FileBrowserState) => void
  /** Doble clic o Enter sobre un archivo que se puede elegir. */
  onActivate?: (path: string) => void
  ref?: Ref<FileBrowserHandle>
}

type SortKey = 'name' | 'size' | 'kind' | 'modified'

const PLACES: { label: string; path: string; icon: LucideIcon }[] = [
  { label: 'Inicio', path: '', icon: Home },
  { label: 'Escritorio', path: 'Escritorio', icon: Monitor },
  { label: 'Documentos', path: 'Documentos', icon: FileText },
  { label: 'Descargas', path: 'Descargas', icon: Download },
  { label: 'Imágenes', path: 'Imágenes', icon: Image },
  { label: 'Música', path: 'Música', icon: Music },
  { label: 'Videos', path: 'Videos', icon: Video }
]

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** Cuándo cambió un elemento; en la papelera, cuándo se eliminó. */
const timeOf = (node: FsNode, inTrash: boolean) => (inTrash ? (node.trash?.trashedAt ?? node.modifiedAt) : node.modifiedAt)

function compare(a: FsNode, b: FsNode, key: SortKey, inTrash: boolean): number {
  switch (key) {
    case 'size':
      return a.size - b.size
    case 'modified':
      return timeOf(a, inTrash) - timeOf(b, inTrash)
    case 'kind':
      return describeKind(a).localeCompare(describeKind(b), 'es')
    default:
      return a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })
  }
}

/** Campo para renombrar en el sitio: Enter o perder el foco confirma, Esc cancela. */
function RenameField({ node, onCommit, onCancel }: { node: FsNode; onCommit: (name: string) => void; onCancel: () => void }) {
  const finished = useRef(false)
  const finish = (action: () => void) => {
    if (finished.current) return
    finished.current = true
    action()
  }
  return (
    <input
      className="os-file-browser__rename"
      aria-label="Nombre"
      defaultValue={node.name}
      autoComplete="off"
      spellCheck={false}
      autoFocus
      ref={(input) => {
        if (!input) return
        const dot = node.name.lastIndexOf('.')
        input.setSelectionRange(0, node.kind === 'file' && dot > 0 ? dot : node.name.length)
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') finish(() => onCommit(event.currentTarget.value))
        else if (event.key === 'Escape') finish(onCancel)
      }}
      onBlur={(event) => finish(() => onCommit(event.currentTarget.value))}
    />
  )
}

export function FileBrowser({
  startPath = '~',
  mode = 'open',
  multiple = false,
  folders = false,
  extensions,
  defaultName = '',
  view,
  onViewChange,
  toolbar,
  contextMenu,
  onTrash,
  onError,
  onChange,
  onActivate,
  ref
}: FileBrowserProps) {
  const manage = mode === 'manage'
  const allowMultiple = multiple || manage

  const [home, setHome] = useState<string | null>(null)
  const [current, setCurrent] = useState<string | null>(null)
  const [history, setHistory] = useState<{ stack: string[]; index: number }>({ stack: [], index: 0 })
  const [selected, setSelected] = useState<string[]>([])
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: 'name', direction: 1 })
  const [name, setName] = useState(defaultName)
  const [creating, setCreating] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [ownView, setOwnView] = useState<FileBrowserView>('list')
  const currentView = view ?? ownView

  const inTrash = manage && current === TRASH_PATH
  const folderNodes = useFsFolder(current ?? TRASH_PATH)
  const trash = useFsTrash()
  const nodes = inTrash ? trash.nodes : folderNodes
  const tableRef = useRef<HTMLDivElement>(null)
  const scrollTo = useRef<string | null>(null)
  const { show, menu } = useContextMenu()

  // Resuelve la carpeta de inicio y la carpeta inicial a rutas absolutas.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const homePath = await fs.pathOf((await fs.stat('~')).id)
        let start = homePath
        try {
          const node = await fs.stat(startPath)
          const path = await fs.pathOf(node.id)
          start = node.kind === 'folder' ? path : parentPath(path)
        } catch {
          /* se queda en la carpeta de inicio */
        }
        if (!active) return
        setHome(homePath)
        setCurrent(start)
        setHistory({ stack: [start], index: 0 })
      } catch {
        /* sin sistema de archivos todavía */
      }
    })()
    return () => {
      active = false
    }
  }, [startPath])

  const eligible = useMemo(() => {
    const allowed = extensions?.map((extension) => extension.toLowerCase().replace(/^\./, ''))
    return (node: FsNode) => {
      if (manage) return true
      if (folders) return node.kind === 'folder'
      if (node.kind === 'folder') return false
      return !allowed || allowed.length === 0 || allowed.includes(extensionOf(node.name))
    }
  }, [manage, folders, extensions])

  const sorted = useMemo(() => {
    return [...nodes].sort((a, b) => {
      if (!inTrash && a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return compare(a, b, sort.key, inTrash) * sort.direction
    })
  }, [nodes, sort, inTrash])

  // Avisa a quien lo usa de cada cambio de carpeta, selección o nombre.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  useEffect(() => {
    if (current === null) return
    const chosen = sorted.filter((node) => selected.includes(node.id))
    onChangeRef.current?.({
      path: current,
      selection: chosen.filter(eligible).map((node) => joinPath(current, node.name)),
      name,
      nodes: chosen,
      inTrash
    })
  }, [current, sorted, selected, eligible, name, inTrash])

  // Tras moverse con el teclado, el elemento elegido tiene que quedar a la vista.
  useEffect(() => {
    const id = scrollTo.current
    if (id === null || selected[0] !== id) return
    scrollTo.current = null
    tableRef.current?.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected, sorted])

  function navigate(path: string) {
    setCurrent(path)
    setSelected([])
    setAnchorId(null)
    setCreating(null)
    setRenaming(null)
    setHistory((state) => ({ stack: [...state.stack.slice(0, state.index + 1), path], index: state.index + 1 }))
  }

  function go(offset: -1 | 1) {
    const index = history.index + offset
    const path = history.stack[index]
    if (path === undefined) return
    setCurrent(path)
    setSelected([])
    setCreating(null)
    setRenaming(null)
    setHistory({ stack: history.stack, index })
  }

  function open(node: FsNode) {
    if (current === null || inTrash) return
    const path = joinPath(current, node.name)
    if (node.kind === 'folder') navigate(path)
    else if (eligible(node)) onActivate?.(path)
  }

  function select(ids: string[], anchor: string | null = ids[0] ?? null) {
    setSelected(ids)
    setAnchorId(anchor)
  }

  function choose(node: FsNode, event: MouseEvent) {
    if (allowMultiple && (event.ctrlKey || event.metaKey)) {
      setSelected((ids) => (ids.includes(node.id) ? ids.filter((id) => id !== node.id) : [...ids, node.id]))
      setAnchorId(node.id)
    } else if (allowMultiple && event.shiftKey && anchorId !== null) {
      const from = sorted.findIndex((item) => item.id === anchorId)
      const to = sorted.findIndex((item) => item.id === node.id)
      setSelected(sorted.slice(Math.min(from, to), Math.max(from, to) + 1).map((item) => item.id))
    } else {
      select([node.id])
    }
    if (mode === 'save' && node.kind === 'file') setName(node.name)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (renaming !== null) return
    const index = sorted.findIndex((node) => node.id === selected[0])
    const step = (delta: number) => {
      event.preventDefault()
      const next = sorted[Math.min(sorted.length - 1, Math.max(0, index + delta))]
      if (!next) return
      scrollTo.current = next.id
      select([next.id])
    }
    if (event.key === 'Enter') {
      const node = sorted[index]
      if (node) open(node)
    } else if (event.key === 'Backspace' && current !== null && !inTrash) {
      navigate(parentPath(current))
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && allowMultiple) {
      event.preventDefault()
      select(sorted.map((node) => node.id), sorted[0]?.id ?? null)
    } else if (currentView === 'icons' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      step(event.key === 'ArrowRight' ? 1 : -1)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const grid = tableRef.current?.querySelector('.os-file-browser__grid')
      const columns = currentView === 'icons' && grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 1
      step((event.key === 'ArrowDown' ? 1 : -1) * columns)
    }
  }

  /* ───── Crear y renombrar ───── */

  async function createFolderBar(event: FormEvent) {
    event.preventDefault()
    if (current === null || creating === null) return
    try {
      const node = await fs.mkdir(joinPath(current, creating.trim()))
      setCreating(null)
      setCreateError(null)
      setSelected([node.id])
      // El campo desaparece: el foco vuelve a la tabla para que el teclado siga funcionando.
      tableRef.current?.focus({ preventScroll: true })
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error))
    }
  }

  async function createFolderInline() {
    if (current === null || inTrash) return
    let folderName = 'Nueva carpeta'
    for (let n = 2; await fs.exists(joinPath(current, folderName)); n++) folderName = `Nueva carpeta (${n})`
    try {
      const node = await fs.mkdir(joinPath(current, folderName))
      select([node.id])
      setRenaming(node.id)
    } catch (error) {
      onError?.('No se pudo crear la carpeta', error)
    }
  }

  async function commitRename(node: FsNode, value: string) {
    setRenaming(null)
    tableRef.current?.focus({ preventScroll: true })
    const next = value.trim()
    if (current === null || next === node.name) return
    try {
      await fs.rename(joinPath(current, node.name), next)
    } catch (error) {
      onError?.('No se pudo renombrar', error)
    }
  }

  useImperativeHandle(ref, () => ({
    navigate,
    createFolder: async () => {
      if (manage) await createFolderInline()
      else {
        setCreating('')
        setCreateError(null)
      }
    },
    rename: (nodeId) => setRenaming(nodeId),
    selectAll: () => select(sorted.map((node) => node.id), sorted[0]?.id ?? null),
    focus: () => tableRef.current?.focus({ preventScroll: true })
  }))

  /* ───── Arrastrar y soltar ───── */

  async function moveInto(nodeIds: string[], destination: string, destinationId?: string) {
    try {
      if (destination === TRASH_PATH) {
        const dropped = await Promise.all(nodeIds.map(async (id) => fs.stat(await fs.pathOf(id))))
        if (dropped.length > 0) onTrash?.(dropped)
        return
      }
      for (const id of nodeIds) {
        if (id === destinationId) continue
        await fs.move(await fs.pathOf(id), destination)
      }
    } catch (error) {
      onError?.('No se pudo mover', error)
    }
  }

  /** Propiedades de un elemento que acepta elementos soltados encima. */
  function dropProps(key: string, destination: string | null, destinationId?: string) {
    if (!manage || destination === null) return {}
    return {
      'data-drop': dropTarget === key ? 'true' : undefined,
      onDragOver: (event: DragEvent) => {
        if (!hasNodeDrag(event)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        setDropTarget(key)
      },
      onDragLeave: () => setDropTarget((target) => (target === key ? null : target)),
      onDrop: (event: DragEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setDropTarget(null)
        const payload = getNodeDrag(event)
        if (payload) void moveInto(payload.nodeIds, destination, destinationId)
      }
    }
  }

  function dragProps(node: FsNode) {
    if (!manage || inTrash || renaming === node.id) return {}
    return {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        const ids = selected.includes(node.id) ? selected : [node.id]
        if (!selected.includes(node.id)) select([node.id])
        setNodeDrag(event, { nodeIds: ids })
      },
      onDragEnd: () => setDropTarget(null)
    }
  }

  /* ───── Menú contextual ───── */

  function openMenu(event: MouseEvent, node: FsNode | null) {
    event.stopPropagation()
    if (!manage || !contextMenu || current === null) {
      event.preventDefault()
      return
    }
    let targets: FsNode[] = []
    if (node === null) select([])
    else if (selected.includes(node.id)) targets = sorted.filter((item) => selected.includes(item.id))
    else {
      select([node.id])
      targets = [node]
    }
    const items = contextMenu({ nodes: targets, folder: current, inTrash })
    if (items.length === 0) event.preventDefault()
    else show(event, items)
  }

  /* ───── Dibujo ───── */

  const headerCell = (key: SortKey, label: string) => (
    <button
      type="button"
      role="columnheader"
      className="os-file-browser__heading"
      aria-sort={sort.key === key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}
      onClick={() => setSort((state) => ({ key, direction: state.key === key && state.direction === 1 ? -1 : 1 }))}
    >
      {label}
      {sort.key === key ? <span aria-hidden="true">{sort.direction === 1 ? ' ▴' : ' ▾'}</span> : null}
    </button>
  )

  const crumbs: { label: string; path: string }[] = inTrash
    ? [{ label: 'Papelera', path: TRASH_PATH }]
    : (current ?? '/')
        .split('/')
        .filter(Boolean)
        .map((label, index, parts) => ({ label, path: `/${parts.slice(0, index + 1).join('/')}` }))

  const rowClass = (node: FsNode) =>
    `os-file-browser__row${node.kind === 'file' && !eligible(node) && mode === 'open' ? ' os-file-browser__row--disabled' : ''}`

  const nameOf = (node: FsNode) =>
    renaming === node.id ? (
      <RenameField node={node} onCommit={(value) => void commitRename(node, value)} onCancel={() => setRenaming(null)} />
    ) : (
      <span>{node.name}</span>
    )

  const folderDrop = (node: FsNode) =>
    node.kind === 'folder' && !inTrash && current !== null ? dropProps(`node:${node.id}`, joinPath(current, node.name), node.id) : {}

  const places = [...PLACES, ...(manage ? [{ label: 'Papelera', path: TRASH_PATH, icon: Trash2 }] : [])]

  return (
    <div className="os-file-browser">
      <nav className="os-file-browser__sidebar" aria-label="Lugares">
        {places.map(({ label, path, icon: Icon }) => {
          const target = home === null ? null : path === TRASH_PATH ? path : path === '' ? home : `${home}/${path}`
          return (
            <button
              key={label}
              type="button"
              className="os-file-browser__place"
              aria-current={target !== null && target === current ? 'true' : undefined}
              disabled={target === null}
              onClick={() => target !== null && navigate(target)}
              {...dropProps(`place:${label}`, target)}
            >
              <Icon size={15} />
              {label}
            </button>
          )
        })}
      </nav>

      <section className="os-file-browser__main">
        <div className="os-file-browser__toolbar">
          <IconButton label="Atrás" disabled={history.index <= 0} onClick={() => go(-1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton label="Adelante" disabled={history.index >= history.stack.length - 1} onClick={() => go(1)}>
            <ChevronRight size={16} />
          </IconButton>
          <IconButton
            label="Subir una carpeta"
            disabled={current === null || current === '/' || inTrash}
            onClick={() => current !== null && navigate(parentPath(current))}
          >
            <ArrowUp size={16} />
          </IconButton>
          <ol className="os-file-browser__path" aria-label="Ruta">
            {crumbs.map((crumb, index) => (
              <li key={`${index}-${crumb.path}`}>
                <button type="button" onClick={() => navigate(crumb.path)} {...dropProps(`crumb:${crumb.path}`, crumb.path)}>
                  {crumb.label}
                </button>
              </li>
            ))}
          </ol>
          {mode === 'save' ? (
            <IconButton
              label="Nueva carpeta"
              onClick={() => {
                setCreating('')
                setCreateError(null)
              }}
            >
              <FolderPlus size={16} />
            </IconButton>
          ) : null}
          {manage ? (
            <>
              {toolbar}
              <IconButton
                label="Ver como íconos"
                active={currentView === 'icons'}
                onClick={() => {
                  setOwnView('icons')
                  onViewChange?.('icons')
                }}
              >
                <LayoutGrid size={15} />
              </IconButton>
              <IconButton
                label="Ver como lista"
                active={currentView === 'list'}
                onClick={() => {
                  setOwnView('list')
                  onViewChange?.('list')
                }}
              >
                <ListIcon size={15} />
              </IconButton>
            </>
          ) : null}
        </div>

        {creating !== null ? (
          <form className="os-file-browser__create" onSubmit={createFolderBar}>
            <TextField
              aria-label="Nombre de la carpeta"
              placeholder="Nombre de la carpeta"
              autoFocus
              value={creating}
              error={createError}
              onChange={(event) => {
                setCreating(event.target.value)
                setCreateError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  setCreating(null)
                  tableRef.current?.focus({ preventScroll: true })
                }
              }}
            />
            <button type="submit" className="os-file-browser__create-button" disabled={creating.trim() === ''}>
              Crear
            </button>
          </form>
        ) : null}

        <div ref={tableRef} className="os-file-browser__table" role="grid" aria-multiselectable={allowMultiple} tabIndex={0} onKeyDown={onKeyDown}>
          {currentView === 'list' ? (
            <div role="row" className="os-file-browser__row os-file-browser__row--head">
              {headerCell('name', 'Nombre')}
              {headerCell('size', 'Tamaño')}
              {headerCell('kind', 'Tipo')}
              {headerCell('modified', inTrash ? 'Eliminado' : 'Modificado')}
            </div>
          ) : null}
          <div
            className="os-file-browser__body"
            onClick={(event) => {
              if (manage && !(event.target as HTMLElement).closest('[data-node-id]')) select([])
            }}
            onContextMenu={(event) => openMenu(event, null)}
            {...(current !== null ? dropProps('current', current) : {})}
          >
            {currentView === 'list' ? (
              <>
                {sorted.map((node) => (
                  <div
                    key={node.id}
                    role="row"
                    data-node-id={node.id}
                    aria-selected={selected.includes(node.id)}
                    className={rowClass(node)}
                    onClick={(event) => choose(node, event)}
                    onDoubleClick={() => open(node)}
                    onContextMenu={(event) => openMenu(event, node)}
                    {...dragProps(node)}
                    {...folderDrop(node)}
                  >
                    <span role="gridcell" className="os-file-browser__name">
                      <FileIcon kind={node.kind} mime={node.mime} system={node.system} size={18} />
                      {nameOf(node)}
                    </span>
                    <span role="gridcell">{node.kind === 'folder' ? '—' : formatBytes(node.size)}</span>
                    <span role="gridcell">{describeKind(node)}</span>
                    <span role="gridcell">{formatDateTime(timeOf(node, inTrash))}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="os-file-browser__grid" role="presentation">
                {sorted.map((node) => (
                  <div
                    key={node.id}
                    role="row"
                    data-node-id={node.id}
                    aria-selected={selected.includes(node.id)}
                    className="os-file-browser__tile"
                    title={node.name}
                    onClick={(event) => choose(node, event)}
                    onDoubleClick={() => open(node)}
                    onContextMenu={(event) => openMenu(event, node)}
                    {...dragProps(node)}
                    {...folderDrop(node)}
                  >
                    <FileIcon kind={node.kind} mime={node.mime} system={node.system} size={52} />
                    <span role="gridcell" className="os-file-browser__tile-name">
                      {nameOf(node)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {sorted.length === 0 ? (
              <div className="os-file-browser__empty">
                <EmptyState
                  title={inTrash ? 'La papelera está vacía' : 'Esta carpeta está vacía'}
                  description={
                    inTrash
                      ? 'Los elementos que borres aparecerán aquí.'
                      : manage
                        ? 'Arrastra archivos hasta aquí o crea una carpeta nueva.'
                        : undefined
                  }
                />
              </div>
            ) : null}
          </div>
        </div>

        {mode === 'save' ? (
          <div className="os-file-browser__save">
            <TextField label="Nombre" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
          </div>
        ) : null}
      </section>
      {menu}
    </div>
  )
}
