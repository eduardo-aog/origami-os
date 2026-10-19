import './Tabs.css'

export interface TabsProps {
  tabs: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  'aria-label'?: string
}

/** Barra de pestañas. Quien la usa muestra el contenido de la pestaña elegida. */
export function Tabs({ tabs, value, onChange, 'aria-label': ariaLabel }: TabsProps) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="os-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className="os-tabs__tab"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
