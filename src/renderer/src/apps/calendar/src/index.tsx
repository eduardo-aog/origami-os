import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button, IconButton, SegmentedControl, Toolbar, ToolbarSpacer } from '@os/ui'
import { useAppMenus, useLaunchArgs, useOS, useSetting, type AppMenu, type LaunchArgs } from '@os/sdk'
import { DayView } from './DayView'
import { EventPanel } from './EventPanel'
import { MonthView } from './MonthView'
import { addDays, addMonths, dateKey, formatDay, formatMonth, minutesOf, timeOf } from './dates'
import { EVENT_PREFIX, cancelReminder, eventKey, sortEvents, syncReminder, type CalendarEvent } from './events'
import './calendar.css'

type View = 'month' | 'day'

interface Editing {
  event: CalendarEvent
  existing: boolean
}

/** Id del evento al que apunta una notificación de recordatorio, si la app se abrió desde una. */
function eventIdFromArgs(args: LaunchArgs): string | null {
  const payload = args.payload as { kind?: unknown; eventId?: unknown } | null | undefined
  return payload?.kind === 'event' && typeof payload.eventId === 'string' ? payload.eventId : null
}

function draftEvent(date: string, start?: string): CalendarEvent {
  const now = new Date()
  const from = start ?? (date === dateKey(now) ? timeOf(Math.min((now.getHours() + 1) * 60, 23 * 60)) : '09:00')
  return {
    id: crypto.randomUUID(),
    title: '',
    date,
    start: from,
    end: timeOf(Math.min(minutesOf(from) + 60, 23 * 60 + 59)),
    reminder: null
  }
}

export default function App() {
  const os = useOS()
  const { storage, dialogs, scheduler } = os
  const args = useLaunchArgs()
  const hour24 = useSetting('datetime.hour24')
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => dateKey(new Date()))
  const [editing, setEditing] = useState<Editing | null>(null)
  const [handledArgs, setHandledArgs] = useState<LaunchArgs | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // Al abrirse, la app toma el foco para que sus atajos funcionen sin tener que hacer clic.
  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    let active = true
    storage.list<CalendarEvent>(EVENT_PREFIX).then((records) => {
      if (active) setEvents(records.map((record) => record.value))
    })
    return () => {
      active = false
    }
  }, [storage])

  // Una notificación de recordatorio abre el día del evento y su ficha.
  const targetId = eventIdFromArgs(args)
  if (events !== null && targetId !== null && handledArgs !== args) {
    setHandledArgs(args)
    const target = events.find((event) => event.id === targetId)
    if (target) {
      setCursor(target.date)
      setView('day')
      setEditing({ event: target, existing: true })
    }
  }

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events ?? []) map.set(event.date, [...(map.get(event.date) ?? []), event])
    return map
  }, [events])

  const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

  async function save(event: CalendarEvent) {
    try {
      await storage.set(eventKey(event.id), event)
      await syncReminder(scheduler, event)
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo guardar el evento', message: describe(error) })
      return
    }
    setEvents((previous) => [...(previous ?? []).filter((candidate) => candidate.id !== event.id), event])
    setCursor(event.date)
    setEditing(null)
  }

  async function remove(event: CalendarEvent) {
    const confirmed = await dialogs.confirm({
      title: `¿Eliminar "${event.title}"?`,
      message: 'El evento y su recordatorio se eliminarán definitivamente.',
      confirmLabel: 'Eliminar',
      destructive: true
    })
    if (!confirmed) return
    try {
      await storage.delete(eventKey(event.id))
      await cancelReminder(scheduler, event.id)
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo eliminar el evento', message: describe(error) })
      return
    }
    setEvents((previous) => previous?.filter((candidate) => candidate.id !== event.id) ?? previous)
    setEditing(null)
  }

  const createEvent = (date = cursor, start?: string) => setEditing({ event: draftEvent(date, start), existing: false })
  const step = (direction: 1 | -1) => setCursor((key) => (view === 'month' ? addMonths(key, direction) : addDays(key, direction)))
  const goToday = () => setCursor(dateKey(new Date()))

  const menus: AppMenu[] = [
    { label: 'Evento', items: [{ label: 'Nuevo evento…', shortcut: 'Ctrl+N', onSelect: () => createEvent() }] },
    {
      label: 'Visualización',
      items: [
        { label: 'Mes', checked: view === 'month', onSelect: () => setView('month') },
        { label: 'Día', checked: view === 'day', onSelect: () => setView('day') },
        { separator: true },
        { label: 'Ir a hoy', onSelect: goToday },
        { label: view === 'month' ? 'Mes anterior' : 'Día anterior', onSelect: () => step(-1) },
        { label: view === 'month' ? 'Mes siguiente' : 'Día siguiente', onSelect: () => step(1) }
      ]
    }
  ]
  useAppMenus(menus)

  function onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'n') {
      event.preventDefault()
      createEvent()
    }
  }

  return (
    <div ref={root} className="calendar" tabIndex={-1} onKeyDown={onKeyDown}>
      <Toolbar aria-label="Navegación">
        <IconButton label={view === 'month' ? 'Mes anterior' : 'Día anterior'} onClick={() => step(-1)}>
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton label={view === 'month' ? 'Mes siguiente' : 'Día siguiente'} onClick={() => step(1)}>
          <ChevronRight size={16} />
        </IconButton>
        <Button onClick={goToday}>Hoy</Button>
        <h2 className="calendar__title">{view === 'month' ? formatMonth(cursor) : formatDay(cursor)}</h2>
        <ToolbarSpacer />
        <SegmentedControl
          aria-label="Vista"
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'Mes' },
            { value: 'day', label: 'Día' }
          ]}
        />
        <Button variant="primary" onClick={() => createEvent()}>
          <Plus size={14} /> Nuevo evento
        </Button>
      </Toolbar>

      <div className="calendar__content">
        {view === 'month' ? (
          <MonthView
            month={cursor}
            selected={cursor}
            eventsByDate={eventsByDate}
            hour24={hour24}
            onSelect={setCursor}
            onOpenDay={(date) => {
              setCursor(date)
              setView('day')
            }}
            onOpenEvent={(event) => setEditing({ event, existing: true })}
          />
        ) : (
          <DayView
            key={cursor}
            date={cursor}
            events={sortEvents(eventsByDate.get(cursor) ?? [])}
            hour24={hour24}
            onCreate={(start) => createEvent(cursor, start)}
            onOpenEvent={(event) => setEditing({ event, existing: true })}
          />
        )}
        {editing ? (
          <EventPanel
            key={editing.event.id}
            event={editing.event}
            existing={editing.existing}
            onSave={(event) => void save(event)}
            onDelete={() => void remove(editing.event)}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
