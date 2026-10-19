import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  Button,
  FileBrowser,
  TRASH_PATH,
  type FileBrowserContext,
  type FileBrowserHandle,
  type FileBrowserState,
  type FileBrowserView,
  type MenuItem
} from '@os/ui'
import { useAppMenus, useLaunchArgs, useOS, type AppMenu, type FsNode } from '@os/sdk'
import './files.css'

const VIEW_KEY = 'view'

const joinPath = (folder: string, name: string) => `${folder === '/' ? '' : folder}/${name}`

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

const countLabel = (nodes: FsNode[]) =>
  nodes.length === 1 ? `"${nodes[0]?.name ?? ''}"` : `${nodes.length} elementos`

export default function App() {
  const os = useOS()
  const { fs, dialogs } = os
  const args = useLaunchArgs()
  const browser = useRef<FileBrowserHandle>(null)
  const [state, setState] = useState<FileBrowserState | null>(null)
  const [view, setView] = useState<FileBrowserView>('list')

  const startPath = args.view === 'trash' ? TRASH_PATH : typeof args.filePath === 'string' ? args.filePath : '~'
  const nodes = state?.nodes ?? []
  const inTrash = state?.inTrash ?? false
  const folder = state?.path ?? '/'

  // La vista elegida (íconos o lista) se recuerda entre sesiones.
  useEffect(() => {
    let active = true
    os.storage.get<FileBrowserView>(VIEW_KEY).then((saved) => {
      if (active && (saved === 'list' || saved === 'icons')) setView(saved)
    })
    return () => {
      active = false
    }
  }, [os.storage])

  // El título de la ventana es la carpeta que se está viendo.
  const folderName = state === null ? '' : inTrash ? 'Papelera' : (folder.split('/').filter(Boolean).pop() ?? '')
  useEffect(() => {
    os.window.setTitle(folderName ? `${folderName} — ${os.app.manifest.name}` : os.app.manifest.name)
  }, [os.window, os.app.manifest.name, folderName])

  const showError = (title: string, error: unknown) => dialogs.alert({ title, message: describeError(error) })

  /** Ejecuta `work` sobre cada elemento y avisa del primer error. Devuelve cuántos salieron bien. */
  async function forEach(title: string, items: FsNode[], work: (node: FsNode, path: string) => Promise<unknown>) {
    let done = 0
    let failure: unknown = null
    for (const node of items) {
      try {
        await work(node, await fs.pathOf(node.id))
        done += 1
      } catch (error) {
        failure ??= error
      }
    }
    if (failure !== null) await showError(title, failure)
    return done
  }

  async function openNodes(items: FsNode[]) {
    for (const node of items) {
      const path = await fs.pathOf(node.id)
      if (node.kind === 'folder') browser.current?.navigate(path)
      else os.apps.openFile(path)
    }
  }

  async function trashNodes(items: FsNode[]) {
    const done = await forEach('No se pudo mover a la papelera', items, (_node, path) => fs.trash(path))
    if (done > 0) os.sound.playSystem('trash')
  }

  async function transfer(items: FsNode[], action: 'copy' | 'move') {
    const destination = await dialogs.openFile({ folders: true, startPath: folder })
    const target = destination?.[0]
    if (target === undefined) return
    await forEach(
      action === 'copy' ? 'No se pudo copiar' : 'No se pudo mover',
      items,
      (_node, path) => (action === 'copy' ? fs.copy(path, target) : fs.move(path, target))
    )
  }

  const duplicateNodes = (items: FsNode[]) => forEach('No se pudo duplicar', items, (_node, path) => fs.duplicate(path))

  async function importFromHost() {
    try {
      await fs.importFromHost(folder, { multiple: true })
    } catch (error) {
      await showError('No se pudo importar', error)
    }
  }

  const restoreNodes = (items: FsNode[]) => forEach('No se pudo restaurar', items, (node) => fs.restore(node.id))

  async function deleteForever(items: FsNode[]) {
    if (items.length === 0) return
    const confirmed = await dialogs.confirm({
      title: `¿Eliminar ${countLabel(items)} definitivamente?`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true
    })
    if (confirmed) await forEach('No se pudo eliminar', items, (node) => fs.deletePermanently(node.id))
  }

  async function emptyTrash() {
    if ((await fs.listTrash()).length === 0) {
      await dialogs.alert({ title: 'La papelera ya está vacía' })
      return
    }
    const confirmed = await dialogs.confirm({
      title: '¿Vaciar la papelera?',
      message: 'Todos sus elementos se eliminarán definitivamente. Esta acción no se puede deshacer.',
      confirmLabel: 'Vaciar papelera',
      destructive: true
    })
    if (!confirmed) return
    try {
      await fs.emptyTrash()
      os.sound.playSystem('empty-trash')
    } catch (error) {
      await showError('No se pudo vaciar la papelera', error)
    }
  }

  const renameNode = (node: FsNode) => browser.current?.rename(node.id)
  const newFolder = () => void browser.current?.createFolder()
  const showInfo = (node: FsNode) => void dialogs.info(node.id)

  function changeView(next: FileBrowserView) {
    setView(next)
    void os.storage.set(VIEW_KEY, next)
  }

  function contextMenu({ nodes: targets, folder: location, inTrash: trashed }: FileBrowserContext): MenuItem[] {
    if (trashed) {
      if (targets.length === 0) return [{ label: 'Vaciar papelera', destructive: true, onSelect: () => void emptyTrash() }]
      return [
        { label: 'Restaurar', onSelect: () => void restoreNodes(targets) },
        { label: 'Eliminar definitivamente', destructive: true, onSelect: () => void deleteForever(targets) },
        { separator: true },
        { label: 'Información', disabled: targets.length !== 1, onSelect: () => targets[0] && showInfo(targets[0]) }
      ]
    }
    if (targets.length === 0) {
      return [
        { label: 'Nueva carpeta', onSelect: newFolder },
        { label: 'Importar desde el equipo…', onSelect: () => void importFromHost() }
      ]
    }
    const single = targets.length === 1 ? targets[0] : undefined
    const openWith: MenuItem[] =
      single?.kind === 'file'
        ? (() => {
            const path = joinPath(location, single.name)
            const candidates = os.apps.getAppsForFile(path)
            return [
              {
                label: 'Abrir con…',
                disabled: candidates.length === 0,
                submenu: candidates.map((app) => ({ label: app.name, onSelect: () => os.apps.openFile(path, app.id) }))
              }
            ]
          })()
        : []
    return [
      { label: 'Abrir', onSelect: () => void openNodes(targets) },
      ...openWith,
      { separator: true },
      { label: 'Renombrar', shortcut: 'F2', disabled: !single || single.system, onSelect: () => single && renameNode(single) },
      { label: 'Duplicar', onSelect: () => void duplicateNodes(targets) },
      { label: 'Copiar a…', onSelect: () => void transfer(targets, 'copy') },
      { label: 'Mover a…', onSelect: () => void transfer(targets, 'move') },
      { separator: true },
      {
        label: 'Mover a la papelera',
        shortcut: 'Supr',
        destructive: true,
        disabled: targets.some((node) => node.system),
        onSelect: () => void trashNodes(targets)
      },
      { separator: true },
      { label: 'Información', disabled: !single, onSelect: () => single && showInfo(single) }
    ]
  }

  const single = nodes.length === 1 ? nodes[0] : undefined
  const hasSelection = nodes.length > 0
  const menus: AppMenu[] = [
    {
      label: 'Archivo',
      items: [
        { label: 'Nueva carpeta', shortcut: 'Ctrl+Shift+N', disabled: inTrash, onSelect: newFolder },
        { label: 'Importar desde el equipo…', disabled: inTrash, onSelect: () => void importFromHost() },
        { separator: true },
        { label: 'Abrir', shortcut: 'Enter', disabled: !hasSelection || inTrash, onSelect: () => void openNodes(nodes) },
        { label: 'Información', disabled: !single, onSelect: () => single && showInfo(single) }
      ]
    },
    {
      label: 'Edición',
      items: [
        { label: 'Renombrar', shortcut: 'F2', disabled: !single || single.system || inTrash, onSelect: () => single && renameNode(single) },
        { label: 'Duplicar', disabled: !hasSelection || inTrash, onSelect: () => void duplicateNodes(nodes) },
        { label: 'Copiar a…', disabled: !hasSelection || inTrash, onSelect: () => void transfer(nodes, 'copy') },
        { label: 'Mover a…', disabled: !hasSelection || inTrash, onSelect: () => void transfer(nodes, 'move') },
        {
          label: 'Mover a la papelera',
          shortcut: 'Supr',
          destructive: true,
          disabled: !hasSelection || inTrash || nodes.some((node) => node.system),
          onSelect: () => void trashNodes(nodes)
        },
        { separator: true },
        { label: 'Restaurar', disabled: !hasSelection || !inTrash, onSelect: () => void restoreNodes(nodes) },
        {
          label: 'Eliminar definitivamente',
          destructive: true,
          disabled: !hasSelection || !inTrash,
          onSelect: () => void deleteForever(nodes)
        },
        { label: 'Vaciar papelera', destructive: true, disabled: !inTrash, onSelect: () => void emptyTrash() }
      ]
    },
    {
      label: 'Visualización',
      items: [
        { label: 'Como íconos', checked: view === 'icons', onSelect: () => changeView('icons') },
        { label: 'Como lista', checked: view === 'list', onSelect: () => changeView('list') }
      ]
    }
  ]
  useAppMenus(menus)

  function onKeyDown(event: KeyboardEvent) {
    // Los campos de texto (como el del nombre que se está editando) atienden sus propias teclas.
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    if (event.key === 'F2' && single && !single.system && !inTrash) {
      renameNode(single)
    } else if (event.key === 'Delete' && hasSelection) {
      void (inTrash ? deleteForever(nodes) : trashNodes(nodes.filter((node) => !node.system)))
    } else if (event.key.toLowerCase() === 'n' && event.shiftKey && (event.ctrlKey || event.metaKey) && !inTrash) {
      event.preventDefault()
      newFolder()
    }
  }

  const toolbar = inTrash ? (
    <>
      <Button className="files__toolbar-button" disabled={!hasSelection} onClick={() => void restoreNodes(nodes)}>
        Restaurar
      </Button>
      <Button className="files__toolbar-button" onClick={() => void emptyTrash()}>
        Vaciar papelera
      </Button>
    </>
  ) : (
    <Button className="files__toolbar-button" onClick={() => void importFromHost()}>
      Importar desde el equipo…
    </Button>
  )

  return (
    <div className="files" onKeyDown={onKeyDown}>
      <FileBrowser
        ref={browser}
        mode="manage"
        startPath={startPath}
        view={view}
        onViewChange={changeView}
        toolbar={toolbar}
        contextMenu={contextMenu}
        onTrash={(dropped) => void trashNodes(dropped)}
        onError={(title, error) => void showError(title, error)}
        onChange={setState}
        onActivate={(path) => os.apps.openFile(path)}
      />
    </div>
  )
}
