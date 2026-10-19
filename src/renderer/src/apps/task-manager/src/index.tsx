import { useState } from 'react'
import { Tabs } from '@os/ui'
import { PerformanceTab } from './PerformanceTab'
import { ProcessesTab } from './ProcessesTab'
import { useSnapshots } from './useSnapshots'
import './task-manager.css'

const TABS = [
  { id: 'processes', label: 'Procesos' },
  { id: 'performance', label: 'Rendimiento' }
]

export default function App() {
  const [tab, setTab] = useState('processes')
  // La muestra vive aquí para que las gráficas sigan acumulando historia al cambiar de pestaña.
  const snapshot = useSnapshots()

  return (
    <div className="task-manager">
      <Tabs aria-label="Secciones" tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'processes' ? <ProcessesTab snapshot={snapshot} /> : <PerformanceTab snapshot={snapshot} />}
    </div>
  )
}
