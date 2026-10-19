import { useCallback, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, EmptyState, IconButton, Select, TextField, Toggle } from '@os/ui'
import { useOS, useSetting } from '@os/sdk'
import { formatHm, nextOccurrence, type Repeat } from './time'

/** Una alarma en el `appData` (clave `alarm:<id>`). Está activa mientras exista su aviso en el programador. */
interface Alarm {
  id: string
  /** Hora en formato HH:mm. */
  time: string
  label: string
  repeat: Repeat
  jobId: string | null
}

const ALARM_PREFIX = 'alarm:'
const alarmKey = (id: string) => `${ALARM_PREFIX}${id}`

const REPEATS = [
  { value: 'none', label: 'Una vez' },
  { value: 'daily', label: 'Todos los días' },
  { value: 'weekdays', label: 'De lunes a viernes' }
]

const repeatLabel = (repeat: Repeat) => REPEATS.find((option) => option.value === repeat)?.label ?? ''

interface EditorProps {
  alarm: Alarm
  existing: boolean
  onSave: (alarm: Alarm) => void
  onDelete: () => void
  onClose: () => void
}

function AlarmEditor({ alarm, existing, onSave, onDelete, onClose }: EditorProps) {
  const [time, setTime] = useState(alarm.time)
  const [label, setLabel] = useState(alarm.label)
  const [repeat, setRepeat] = useState<Repeat>(alarm.repeat)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError('Elige una hora válida.')
      return
    }
    onSave({ ...alarm, time, label: label.trim(), repeat })
  }

  return (
    <aside
      className="clock__panel"
      aria-label={existing ? 'Editar alarma' : 'Nueva alarma'}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <header className="clock__panel-header">
        <h2 className="clock__panel-title">{existing ? 'Editar alarma' : 'Nueva alarma'}</h2>
        <IconButton label="Cerrar" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      <form
        className="clock__panel-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <TextField label="Hora" type="time" autoFocus value={time} onChange={(event) => setTime(event.target.value)} error={error} />
        <TextField label="Etiqueta" placeholder="Alarma" value={label} onChange={(event) => setLabel(event.target.value)} />
        <Select label="Repetir" value={repeat} options={REPEATS} onChange={(value) => setRepeat(value as Repeat)} />
        <div className="clock__panel-actions">
          {existing ? (
            <Button variant="danger" onClick={onDelete}>
              Eliminar
            </Button>
          ) : null}
          <span className="clock__panel-spacer" />
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit">
            Guardar
          </Button>
        </div>
      </form>
    </aside>
  )
}

export function Alarms() {
  const os = useOS()
  const { storage, scheduler, dialogs } = os
  const hour24 = useSetting('datetime.hour24')
  const [snapshot, setSnapshot] = useState<{ alarms: Alarm[]; activeJobs: ReadonlySet<string> } | null>(null)
  const [editing, setEditing] = useState<{ alarm: Alarm; existing: boolean } | null>(null)

  const read = useCallback(async () => {
    const [records, jobs] = await Promise.all([storage.list<Alarm>(ALARM_PREFIX), scheduler.list()])
    return {
      alarms: records.map((record) => record.value).sort((a, b) => a.time.localeCompare(b.time)),
      activeJobs: new Set(jobs.map((job) => job.id)) as ReadonlySet<string>
    }
  }, [storage, scheduler])

  useEffect(() => {
    let active = true
    const refresh = () => {
      void read().then((next) => active && setSnapshot(next))
    }
    refresh()
    // Una alarma de una sola vez se apaga sola al sonar: se vuelve a leer qué avisos siguen pendientes.
    const stop = os.events.on('scheduler:fired', refresh)
    return () => {
      active = false
      stop()
    }
  }, [read, os.events])

  const reload = async () => setSnapshot(await read())
  const alarms = snapshot?.alarms ?? null
  const isEnabled = (alarm: Alarm) => alarm.jobId !== null && snapshot !== null && snapshot.activeJobs.has(alarm.jobId)

  async function persist(alarm: Alarm, enabled: boolean) {
    try {
      if (alarm.jobId !== null) await scheduler.cancel(alarm.jobId)
      const jobId = enabled
        ? await scheduler.schedule({
            fireAt: nextOccurrence(alarm.time, alarm.repeat),
            title: alarm.label === '' ? 'Alarma' : alarm.label,
            body: formatHm(alarm.time, hour24),
            sound: true,
            repeat: alarm.repeat,
            payload: { kind: 'alarm', alarmId: alarm.id }
          })
        : null
      await storage.set(alarmKey(alarm.id), { ...alarm, jobId })
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo guardar la alarma', message: error instanceof Error ? error.message : String(error) })
    }
    await reload()
  }

  async function remove(alarm: Alarm) {
    const confirmed = await dialogs.confirm({
      title: `¿Eliminar la alarma de las ${formatHm(alarm.time, hour24)}?`,
      confirmLabel: 'Eliminar',
      destructive: true
    })
    if (!confirmed) return
    if (alarm.jobId !== null) await scheduler.cancel(alarm.jobId)
    await storage.delete(alarmKey(alarm.id))
    setEditing(null)
    await reload()
  }

  function create() {
    const next = new Date(Date.now() + 60 * 60_000)
    const time = `${String(next.getHours()).padStart(2, '0')}:00`
    setEditing({ alarm: { id: crypto.randomUUID(), time, label: '', repeat: 'none', jobId: null }, existing: false })
  }

  return (
    <div className="clock__alarms">
      <div className="clock__section-header">
        <h2 className="clock__section-title">Alarmas</h2>
        <Button onClick={create}>
          <Plus size={14} /> Nueva alarma
        </Button>
      </div>

      {alarms === null ? null : alarms.length === 0 ? (
        <EmptyState title="Sin alarmas" description="Crea una alarma y sonará aunque cierres esta app." />
      ) : (
        <ul className="clock__alarm-list">
          {alarms.map((alarm) => (
            <li key={alarm.id} className={`clock__alarm${isEnabled(alarm) ? '' : ' clock__alarm--off'}`}>
              <button type="button" className="clock__alarm-main" onClick={() => setEditing({ alarm, existing: true })}>
                <span className="clock__alarm-time">{formatHm(alarm.time, hour24)}</span>
                <span className="clock__alarm-label">
                  {alarm.label === '' ? 'Alarma' : alarm.label} · {repeatLabel(alarm.repeat)}
                </span>
              </button>
              <Toggle
                checked={isEnabled(alarm)}
                aria-label={`Alarma de las ${formatHm(alarm.time, hour24)}`}
                onChange={(checked) => void persist(alarm, checked)}
              />
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <AlarmEditor
          key={editing.alarm.id}
          alarm={editing.alarm}
          existing={editing.existing}
          // Guardar una alarma la deja activa: es lo que se espera al crearla o cambiarla.
          onSave={(alarm) => {
            setEditing(null)
            void persist(alarm, true)
          }}
          onDelete={() => void remove(editing.alarm)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}
