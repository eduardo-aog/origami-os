import { useState } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton, Select, TextArea, TextField } from '@os/ui'
import { REMINDERS, validateEvent, type CalendarEvent } from './events'

export interface EventPanelProps {
  /** Evento que se edita; si es nuevo, `existing` es `false`. */
  event: CalendarEvent
  existing: boolean
  onSave: (event: CalendarEvent) => void
  onDelete: () => void
  onClose: () => void
}

export function EventPanel({ event, existing, onSave, onDelete, onClose }: EventPanelProps) {
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.date)
  const [start, setStart] = useState(event.start)
  const [end, setEnd] = useState(event.end)
  const [note, setNote] = useState(event.note ?? '')
  const [reminder, setReminder] = useState(event.reminder === null || event.reminder === undefined ? 'none' : String(event.reminder))
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const message = validateEvent({ title, date, start, end })
    setError(message)
    if (message !== null) return
    onSave({
      id: event.id,
      title: title.trim(),
      date,
      start,
      end,
      ...(note.trim() !== '' ? { note: note.trim() } : {}),
      reminder: reminder === 'none' ? null : Number(reminder)
    })
  }

  return (
    <aside
      className="calendar__panel"
      aria-label={existing ? 'Editar evento' : 'Nuevo evento'}
      onKeyDown={(keyboard) => {
        if (keyboard.key === 'Escape') {
          keyboard.stopPropagation()
          onClose()
        }
      }}
    >
      <header className="calendar__panel-header">
        <h2 className="calendar__panel-title">{existing ? 'Editar evento' : 'Nuevo evento'}</h2>
        <IconButton label="Cerrar" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      <form
        className="calendar__panel-form"
        onSubmit={(submitted) => {
          submitted.preventDefault()
          submit()
        }}
      >
        <TextField label="Título" autoFocus value={title} onChange={(change) => setTitle(change.target.value)} />
        <TextField label="Fecha" type="date" value={date} onChange={(change) => setDate(change.target.value)} />
        <div className="calendar__panel-times">
          <TextField label="Inicio" type="time" value={start} onChange={(change) => setStart(change.target.value)} />
          <TextField label="Fin" type="time" value={end} onChange={(change) => setEnd(change.target.value)} />
        </div>
        <Select label="Recordatorio" value={reminder} options={REMINDERS} onChange={setReminder} />
        <TextArea label="Nota" value={note} onChange={(change) => setNote(change.target.value)} />
        {error ? (
          <p className="calendar__panel-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="calendar__panel-actions">
          {existing ? (
            <Button variant="danger" onClick={onDelete}>
              Eliminar
            </Button>
          ) : null}
          <span className="calendar__panel-spacer" />
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit">
            Guardar
          </Button>
        </div>
      </form>
    </aside>
  )
}
