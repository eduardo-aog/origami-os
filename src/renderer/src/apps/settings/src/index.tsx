import { Clock, Monitor, Palette, User, Volume2, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { Sidebar } from '@os/ui'
import { useLaunchArgs, useOS } from '@os/sdk'
import { AccountSection } from './sections/AccountSection'
import { AppearanceSection } from './sections/AppearanceSection'
import { DateTimeSection } from './sections/DateTimeSection'
import { DesktopSection } from './sections/DesktopSection'
import { SoundSection } from './sections/SoundSection'
import './settings.css'

interface SectionDefinition {
  id: string
  label: string
  icon: LucideIcon
  Component: ComponentType
}

const SECTIONS: SectionDefinition[] = [
  { id: 'appearance', label: 'Apariencia', icon: Palette, Component: AppearanceSection },
  { id: 'desktop', label: 'Escritorio y Dock', icon: Monitor, Component: DesktopSection },
  { id: 'sound', label: 'Sonido', icon: Volume2, Component: SoundSection },
  { id: 'datetime', label: 'Fecha y hora', icon: Clock, Component: DateTimeSection },
  { id: 'account', label: 'Cuenta', icon: User, Component: AccountSection }
]

const FIRST_SECTION = SECTIONS[0]?.id ?? 'appearance'

const findSection = (id: unknown) => SECTIONS.find((section) => section.id === id)

export default function App() {
  const os = useOS()
  const args = useLaunchArgs()
  const [sectionId, setSectionId] = useState(() => findSection(args.section)?.id ?? FIRST_SECTION)
  const [seenArgs, setSeenArgs] = useState(args)

  // Configuración es de instancia única: cada lanzamiento entrega argumentos nuevos a la ventana que
  // ya está abierta, aunque pidan la misma sección que antes.
  if (seenArgs !== args) {
    setSeenArgs(args)
    const requested = findSection(args.section)
    if (requested) setSectionId(requested.id)
  }

  // Otras apps (el Visor de imágenes) piden cambiar el fondo con `wallpaperPath`, porque no pueden escribir ajustes.
  useEffect(() => {
    const path = args.wallpaperPath
    if (typeof path !== 'string') return
    let active = true
    os.fs
      .stat(path)
      .then((node) => (active ? os.settings.set('appearance.wallpaper', { type: 'file', nodeId: node.id }) : undefined))
      .catch((error: unknown) =>
        os.dialogs.alert({
          title: 'No se pudo usar la imagen como fondo',
          message: error instanceof Error ? error.message : String(error)
        })
      )
    return () => {
      active = false
    }
  }, [args, os])

  const section = findSection(sectionId) ?? SECTIONS[0]
  if (!section) return null
  const { Component } = section

  return (
    <div className="settings">
      <Sidebar
        aria-label="Secciones de configuración"
        selected={section.id}
        onSelect={setSectionId}
        items={SECTIONS.map(({ id, label, icon: Icon }) => ({ id, label, icon: <Icon size={16} /> }))}
      />
      <main className="settings__content">
        <h2 className="settings__title">{section.label}</h2>
        <Component />
      </main>
    </div>
  )
}
