import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppIcon, useContextMenu, type MenuItem } from '@os/ui'
import { apps, type AppDefinition } from '../../kernel/apps'
import { launchApp } from '../../kernel/apps/launcher'
import { addAppToDesktop, pinToDock } from '../common/actions'
import { launchpad, useLaunchpadOpen } from './store'
import './Launchpad.css'

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

function LaunchpadItem({ app }: { app: AppDefinition }) {
  const { show, menu } = useContextMenu()
  const open = () => {
    launchpad.close()
    launchApp(app.manifest.id)
  }
  const items: MenuItem[] = [
    { label: 'Abrir', onSelect: open },
    { label: 'Añadir al escritorio', onSelect: () => addAppToDesktop(app.manifest.id) },
    { label: 'Añadir al Dock', onSelect: () => pinToDock(app.manifest.id) }
  ]
  return (
    <>
      <button
        type="button"
        className="launchpad__app"
        onClick={(event) => {
          event.stopPropagation()
          open()
        }}
        onContextMenu={(event) => show(event, items)}
      >
        <AppIcon src={app.iconUrl} size={80} />
        <span className="launchpad__name">{app.manifest.name}</span>
      </button>
      {menu}
    </>
  )
}

/** El panel solo existe mientras el Launchpad está abierto, así la búsqueda se limpia sola al cerrarlo. */
function LaunchpadPanel() {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') launchpad.close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const visible = useMemo(() => {
    const needle = normalize(query.trim())
    return apps
      .filter((app) => app.manifest.launchpad.visible)
      .filter((app) => needle === '' || normalize(`${app.manifest.name} ${app.manifest.description}`).includes(needle))
      .sort((a, b) => a.manifest.launchpad.order - b.manifest.launchpad.order || a.manifest.name.localeCompare(b.manifest.name, 'es'))
  }, [query])

  return (
    <div className="launchpad" onClick={() => launchpad.close()}>
      <label className="launchpad__search" onClick={(event) => event.stopPropagation()}>
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar"
          aria-label="Buscar aplicaciones"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="launchpad__grid">
        {visible.map((app) => (
          <LaunchpadItem key={app.manifest.id} app={app} />
        ))}
        {visible.length === 0 ? <p className="launchpad__empty">No se encontró ninguna aplicación.</p> : null}
      </div>
    </div>
  )
}

export function Launchpad() {
  return useLaunchpadOpen() ? <LaunchpadPanel /> : null
}
