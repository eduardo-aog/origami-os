import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MenuList, type MenuItem } from '@os/ui'
import systemMenuUrl from '@system/icons/system-menu.svg'
import { getApp, SETTINGS_APP_ID } from '../../kernel/apps'
import { launchApp } from '../../kernel/apps/launcher'
import { dialogs } from '../../kernel/dialogs'
import { useAppMenusOf } from '../../kernel/menus/hooks'
import { session } from '../../kernel/session'
import { closeApp } from '../../kernel/windows'
import { useWindows } from '../../kernel/windows/hooks'
import { windowsStore } from '../../kernel/windows/store'
import { StatusItems } from './StatusItems'
import './Menubar.css'

interface TriggerProps {
  id: string
  open: string | null
  setOpen: (id: string | null) => void
  items: MenuItem[]
  className?: string
  children: React.ReactNode
}

/** Un botón de la barra de menú con su lista desplegable. Con un menú abierto, pasar a otro lo abre (como en macOS). */
function MenuTrigger({ id, open, setOpen, items, className = '', children }: TriggerProps) {
  const isOpen = open === id
  return (
    <div className="menubar__slot">
      <button
        type="button"
        className={`menubar__item ${className}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setOpen(isOpen ? null : id)}
        onPointerEnter={() => open !== null && !isOpen && setOpen(id)}
      >
        {children}
      </button>
      {isOpen ? (
        <div className="menubar__dropdown">
          <MenuList items={items} onClose={() => setOpen(null)} />
        </div>
      ) : null}
    </div>
  )
}

export function Menubar() {
  const barRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState<string | null>(null)

  const focused = useWindows((state) => state.windows.find((win) => win.focused && win.state !== 'minimized' && !win.closing))
  const app = focused ? getApp(focused.appId) : undefined
  const appMenus = useAppMenusOf(focused?.instanceId ?? null)

  // La barra le dice a las ventanas dónde empieza la zona libre.
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const report = () => windowsStore.setWorkArea({ top: bar.getBoundingClientRect().height })
    report()
    const observer = new ResizeObserver(report)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (open === null) return
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.menubar__slot')) setOpen(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('blur', () => setOpen(null))
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const settingsApp = getApp(SETTINGS_APP_ID)
  const systemItems: MenuItem[] = [
    ...(settingsApp
      ? [
          { label: settingsApp.manifest.name, onSelect: () => launchApp(SETTINGS_APP_ID) },
          { separator: true as const }
        ]
      : []),
    { label: 'Bloquear', onSelect: () => session.lock() },
    { label: 'Cerrar sesión', onSelect: () => void session.logout() },
    { separator: true },
    { label: 'Reiniciar', onSelect: () => void session.restart() },
    { label: 'Apagar', onSelect: () => void session.shutdown() }
  ]

  const appItems: MenuItem[] = app
    ? [
        { label: `Acerca de ${app.manifest.name}`, onSelect: () => void dialogs.system.about(app.manifest.id) },
        { separator: true },
        { label: `Cerrar ${app.manifest.name}`, onSelect: () => void closeApp(app.manifest.id) }
      ]
    : []

  return (
    <header ref={barRef} className="menubar">
      <div className="menubar__left">
        <MenuTrigger id="system" open={open} setOpen={setOpen} items={systemItems} className="menubar__item--logo">
          <span className="menubar__logo" style={{ maskImage: `url("${systemMenuUrl}")` }} role="img" aria-label="Menú del sistema" />
        </MenuTrigger>

        {app ? (
          <>
            <MenuTrigger id="app" open={open} setOpen={setOpen} items={appItems} className="menubar__item--app">
              {app.manifest.name}
            </MenuTrigger>
            {appMenus.map((menu, index) => (
              <MenuTrigger key={`${index}-${menu.label}`} id={`menu:${index}`} open={open} setOpen={setOpen} items={menu.items}>
                {menu.label}
              </MenuTrigger>
            ))}
          </>
        ) : (
          <span className="menubar__item menubar__item--app menubar__item--static">Escritorio</span>
        )}
      </div>
      <StatusItems />
    </header>
  )
}
