import { useState } from 'react'
import { Tabs } from '@os/ui'
import { useLaunchArgs } from '@os/sdk'
import { PerformanceTab } from './PerformanceTab'
import { PeripheralsTab } from './PeripheralsTab'
import { ProcessesTab } from './ProcessesTab'
import { StatesTab } from './StatesTab'
import { SyncTab } from './SyncTab'
import { useSnapshot } from './useSnapshot'
import './task-manager.css'

const TABS = [
  { id: 'processes', label: 'Procesos' },
  { id: 'states', label: 'Estados' },
  { id: 'sync', label: 'Sincronización' },
  { id: 'performance', label: 'Rendimiento' },
  { id: 'peripherals', label: 'Periféricos' }
]

const findTab = (id: unknown) => TABS.find((tab) => tab.id === id)?.id

export default function App() {
  const args = useLaunchArgs()
  const [tab, setTab] = useState(() => findTab(args.section) ?? 'processes')
  const [seenArgs, setSeenArgs] = useState(args)
  const snapshot = useSnapshot()

  // Es de instancia única: una notificación (por ejemplo "Interbloqueo detectado") reabre la ventana ya abierta
  // con otra sección.
  if (seenArgs !== args) {
    setSeenArgs(args)
    const requested = findTab(args.section)
    if (requested) setTab(requested)
  }

  return (
    <div className="task-manager">
      <Tabs aria-label="Secciones" tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'processes' ? <ProcessesTab snapshot={snapshot} /> : null}
      {tab === 'states' ? <StatesTab snapshot={snapshot} /> : null}
      {tab === 'sync' ? <SyncTab snapshot={snapshot} /> : null}
      {tab === 'performance' ? <PerformanceTab snapshot={snapshot} /> : null}
      {tab === 'peripherals' ? <PeripheralsTab /> : null}
    </div>
  )
}
