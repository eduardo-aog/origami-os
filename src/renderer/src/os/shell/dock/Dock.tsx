import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react'
import { getNodeDrag, hasNodeDrag, useContextMenu, type MenuItem } from '@os/ui'
import launchpadUrl from '@system/icons/launchpad.svg'
import trashEmptyUrl from '@system/icons/trash-empty.svg'
import trashFullUrl from '@system/icons/trash-full.svg'
import { apps, FILES_APP_ID, type AppDefinition } from '../../kernel/apps'
import { launchApp } from '../../kernel/apps/launcher'
import { useSettingValue } from '../../kernel/settings/hooks'
import { closeApp, registerDockTarget } from '../../kernel/windows'
import { useWindows } from '../../kernel/windows/hooks'
import { windowsStore } from '../../kernel/windows/store'
import { activateApp, dropOnTrash, pinToDock, unpinFromDock } from '../common/actions'
import { useTrashCount } from '../common/useTrashCount'
import { launchpad, useLaunchpadOpen } from '../launchpad/store'
import { DockButton } from './DockButton'
import './Dock.css'

/** Espacio entre el Dock y el borde inferior de la pantalla. */
const DOCK_MARGIN = 8
/** Cuánto crece el ícono más cercano al cursor, y a qué distancia deja de notarse. */
const MAGNIFICATION = 0.65
const MAGNIFICATION_RANGE = 110
/** Separación entre centros de íconos (tamaño + espaciado de fábrica) para la que se calibró `MAGNIFICATION_RANGE`. */
const REFERENCE_PITCH = 60

function DockAppItem({ app, running, pinned }: { app: AppDefinition; running: boolean; pinned: boolean }) {
  const { show, menu } = useContextMenu()
  const appId = app.manifest.id
  const register = useCallback((locate: () => { x: number; y: number } | null) => registerDockTarget(appId, locate), [appId])

  const items: MenuItem[] = [
    { label: 'Abrir', onSelect: () => activateApp(appId) },
    pinned
      ? { label: 'Quitar del Dock', onSelect: () => unpinFromDock(appId) }
      : { label: 'Mantener en el Dock', onSelect: () => pinToDock(appId) },
    ...(running ? [{ separator: true }, { label: 'Cerrar', onSelect: () => void closeApp(appId) }] : [])
  ]

  return (
    <>
      <DockButton
        icon={app.iconUrl}
        label={app.manifest.name}
        running={running}
        onActivate={() => activateApp(appId)}
        onContextMenu={(event) => show(event, items)}
        registerTarget={register}
      />
      {menu}
    </>
  )
}

function TrashItem() {
  const count = useTrashCount()
  const [over, setOver] = useState(false)

  return (
    <DockButton
      icon={count > 0 ? trashFullUrl : trashEmptyUrl}
      label="Papelera"
      highlighted={over}
      onActivate={() => launchApp(FILES_APP_ID, { view: 'trash' })}
      onDragOver={(event: DragEvent) => {
        if (!hasNodeDrag(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event: DragEvent) => {
        event.preventDefault()
        setOver(false)
        const payload = getNodeDrag(event)
        if (payload) void dropOnTrash(payload)
      }}
    />
  )
}

export function Dock() {
  const rootRef = useRef<HTMLElement>(null)
  const pinnedIds = useSettingValue('dock.pinned')
  const iconSize = useSettingValue('dock.iconSize')
  const gap = useSettingValue('dock.gap')
  const windows = useWindows((state) => state.windows)
  const launchpadOpen = useLaunchpadOpen()

  const pinned = useMemo(
    () => pinnedIds.flatMap((id) => apps.find((app) => app.manifest.id === id) ?? []),
    [pinnedIds]
  )
  const running = useMemo(() => {
    const ids = new Set(windows.filter((win) => !win.closing).map((win) => win.appId))
    return apps.filter((app) => ids.has(app.manifest.id))
  }, [windows])
  const runningIds = new Set(running.map((app) => app.manifest.id))
  const unpinnedRunning = running.filter((app) => !pinnedIds.includes(app.manifest.id))

  // El Dock le dice a las ventanas cuánto espacio ocupa en la parte baja de la pantalla.
  useLayoutEffect(() => {
    const dock = rootRef.current
    if (!dock) return
    const report = () => windowsStore.setWorkArea({ bottom: Math.ceil(dock.getBoundingClientRect().height) + DOCK_MARGIN + 4 })
    report()
    const observer = new ResizeObserver(report)
    observer.observe(dock)
    return () => observer.disconnect()
  }, [])

  function magnify(event: PointerEvent<HTMLElement>) {
    const dock = rootRef.current
    if (!dock || event.pointerType === 'touch') return
    // El alcance de la ampliación sigue a la separación entre íconos, para que se vea igual con cualquier tamaño o espaciado.
    const range = (MAGNIFICATION_RANGE * (iconSize + gap)) / REFERENCE_PITCH
    for (const item of dock.querySelectorAll<HTMLElement>('[data-dock-item]')) {
      const rect = item.getBoundingClientRect()
      const distance = Math.abs(event.clientX - (rect.left + rect.width / 2))
      const scale = 1 + MAGNIFICATION * Math.exp(-((distance / range) ** 2) * 2)
      item.style.setProperty('--dock-scale', scale.toFixed(3))
    }
  }

  function resetMagnification() {
    rootRef.current?.querySelectorAll<HTMLElement>('[data-dock-item]').forEach((item) => item.style.removeProperty('--dock-scale'))
  }

  return (
    <div className="dock-wrap" style={{ bottom: DOCK_MARGIN }}>
      <nav
        ref={rootRef}
        className="dock"
        aria-label="Dock"
        style={{ '--dock-icon-size': `${iconSize}px`, '--dock-gap': `${gap}px` } as CSSProperties}
        onPointerMove={magnify}
        onPointerLeave={resetMagnification}
      >
        <DockButton icon={launchpadUrl} label="Launchpad" highlighted={launchpadOpen} onActivate={() => launchpad.toggle()} />
        {pinned.map((app) => (
          <DockAppItem key={app.manifest.id} app={app} running={runningIds.has(app.manifest.id)} pinned />
        ))}
        {unpinnedRunning.length > 0 ? <span className="dock__separator" role="separator" /> : null}
        {unpinnedRunning.map((app) => (
          <DockAppItem key={app.manifest.id} app={app} running pinned={false} />
        ))}
        <span className="dock__separator" role="separator" />
        <TrashItem />
      </nav>
    </div>
  )
}
