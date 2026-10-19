import { useState } from 'react'
import { Tabs } from '@os/ui'
import { useLaunchArgs, type LaunchArgs } from '@os/sdk'
import { Alarms } from './Alarms'
import { Stopwatch } from './Stopwatch'
import { Timer } from './Timer'
import { WorldClock } from './WorldClock'
import './clock.css'

type TabId = 'world' | 'alarms' | 'timer' | 'stopwatch'

const TABS: { id: TabId; label: string }[] = [
  { id: 'world', label: 'Reloj mundial' },
  { id: 'alarms', label: 'Alarmas' },
  { id: 'timer', label: 'Temporizador' },
  { id: 'stopwatch', label: 'Cronómetro' }
]

/** Pestaña a la que apunta la notificación de una alarma o de un temporizador, si la app se abrió desde una. */
function tabFromArgs(args: LaunchArgs): TabId | null {
  const payload = args.payload as { kind?: unknown } | null | undefined
  return payload?.kind === 'alarm' ? 'alarms' : payload?.kind === 'timer' ? 'timer' : null
}

export default function App() {
  const args = useLaunchArgs()
  const [tab, setTab] = useState<TabId>('world')
  const [handledArgs, setHandledArgs] = useState<LaunchArgs | null>(null)

  const target = tabFromArgs(args)
  if (target !== null && handledArgs !== args) {
    setHandledArgs(args)
    setTab(target)
  }

  return (
    <div className="clock" tabIndex={-1}>
      <Tabs aria-label="Secciones del reloj" tabs={TABS} value={tab} onChange={(id) => setTab(id as TabId)} />
      <div className="clock__content">
        {tab === 'world' ? <WorldClock /> : null}
        {tab === 'alarms' ? <Alarms /> : null}
        {tab === 'timer' ? <Timer /> : null}
        {tab === 'stopwatch' ? <Stopwatch /> : null}
      </div>
    </div>
  )
}
