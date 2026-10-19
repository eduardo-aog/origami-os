import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { Button, EmptyState, IconButton, List, ListItem, TextArea, TextField, Toolbar, ToolbarSpacer } from '@os/ui'
import { useAppMenus, useOS, type AppMenu } from '@os/sdk'
import { NOTE_PREFIX, formatNoteDate, matchesQuery, newNote, noteKey, notePreview, noteTitle, sortNotes, type Note } from './notes'
import './notes.css'

const SAVE_DELAY_MS = 400

export default function App() {
  const os = useOS()
  const { storage, dialogs } = os
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const latest = useRef<Note[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Al abrirse, la app toma el foco para que sus atajos funcionen sin tener que hacer clic.
  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    latest.current = notes ?? []
  }, [notes])

  useEffect(() => {
    let active = true
    storage.list<Note>(NOTE_PREFIX).then((records) => {
      if (!active) return
      const loaded = records.map((record) => record.value)
      setNotes(loaded)
      setSelectedId(sortNotes(loaded)[0]?.id ?? null)
    })
    return () => {
      active = false
    }
  }, [storage])

  // Al cerrar la ventana no se pierde lo último escrito: los guardados pendientes se hacen de inmediato.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const [id, timer] of pending) {
        clearTimeout(timer)
        const note = latest.current.find((candidate) => candidate.id === id)
        if (note && note.content.trim() !== '') void storage.set(noteKey(id), note)
      }
      pending.clear()
    }
  }, [storage])

  const visible = useMemo(() => sortNotes(notes ?? []).filter((note) => matchesQuery(note, query)), [notes, query])
  const selected = notes?.find((note) => note.id === selectedId) ?? null

  function persist(note: Note) {
    void (note.content.trim() === '' ? storage.delete(noteKey(note.id)) : storage.set(noteKey(note.id), note))
  }

  /** Una nota nueva sin texto solo existe en pantalla: si se abandona vacía, desaparece sin haberse guardado. */
  function dropIfEmpty(list: Note[], id: string | null): Note[] {
    const candidate = list.find((note) => note.id === id)
    return candidate && candidate.content.trim() === '' ? list.filter((note) => note.id !== id) : list
  }

  function select(id: string) {
    setNotes((previous) => (previous ? dropIfEmpty(previous, selectedId) : previous))
    setSelectedId(id)
  }

  function edit(id: string, content: string) {
    setNotes((previous) => previous?.map((note) => (note.id === id ? { ...note, content, updatedAt: Date.now() } : note)) ?? previous)
    const pending = timers.current.get(id)
    if (pending !== undefined) clearTimeout(pending)
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id)
        const note = latest.current.find((candidate) => candidate.id === id)
        if (note) persist(note)
      }, SAVE_DELAY_MS)
    )
  }

  function create() {
    const note = newNote()
    setNotes((previous) => [...dropIfEmpty(previous ?? [], selectedId), note])
    setQuery('')
    setSelectedId(note.id)
    setCreatedId(note.id)
  }

  function togglePin(note: Note) {
    const next = { ...note, pinned: !note.pinned }
    setNotes((previous) => previous?.map((candidate) => (candidate.id === note.id ? next : candidate)) ?? previous)
    persist(next)
  }

  async function remove(note: Note) {
    const confirmed = await dialogs.confirm({
      title: `¿Eliminar "${noteTitle(note)}"?`,
      message: 'La nota se eliminará definitivamente. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true
    })
    if (!confirmed) return
    const pending = timers.current.get(note.id)
    if (pending !== undefined) {
      clearTimeout(pending)
      timers.current.delete(note.id)
    }
    const order = visible
    const index = order.findIndex((candidate) => candidate.id === note.id)
    const neighbour = order[index + 1] ?? order[index - 1] ?? null
    setNotes((previous) => previous?.filter((candidate) => candidate.id !== note.id) ?? previous)
    setSelectedId(neighbour?.id ?? null)
    await storage.delete(noteKey(note.id))
  }

  const menus: AppMenu[] = [
    {
      label: 'Nota',
      items: [
        { label: 'Nueva nota', shortcut: 'Ctrl+N', onSelect: create },
        { separator: true },
        {
          label: selected?.pinned ? 'Desfijar nota' : 'Fijar nota',
          disabled: !selected,
          onSelect: () => selected && togglePin(selected)
        },
        { label: 'Eliminar nota…', destructive: true, disabled: !selected, onSelect: () => selected && void remove(selected) }
      ]
    }
  ]
  useAppMenus(menus)

  function onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'n') {
      event.preventDefault()
      create()
    }
  }

  const rows = (items: Note[]) =>
    items.map((note) => (
      <ListItem
        key={note.id}
        title={noteTitle(note)}
        subtitle={`${formatNoteDate(note.updatedAt)} · ${notePreview(note)}`}
        leading={note.pinned ? <Pin size={13} aria-label="Fijada" /> : undefined}
        selected={note.id === selectedId}
        onClick={() => select(note.id)}
      />
    ))
  const pinned = visible.filter((note) => note.pinned)
  const others = visible.filter((note) => !note.pinned)

  return (
    <div ref={root} className="notes" tabIndex={-1} onKeyDown={onKeyDown}>
      <aside className="notes__sidebar">
        <div className="notes__search">
          <Search size={14} aria-hidden="true" />
          <TextField
            className="notes__search-input"
            aria-label="Buscar en las notas"
            placeholder="Buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="notes__list">
          {notes === null ? null : visible.length === 0 ? (
            <EmptyState
              title={query.trim() === '' ? 'Sin notas' : 'Sin resultados'}
              description={query.trim() === '' ? 'Crea tu primera nota.' : 'Prueba con otra búsqueda.'}
            />
          ) : (
            <>
              {pinned.length > 0 ? (
                <section>
                  <h3 className="notes__group">Fijadas</h3>
                  <List aria-label="Notas fijadas">{rows(pinned)}</List>
                </section>
              ) : null}
              {others.length > 0 ? (
                <section>
                  {pinned.length > 0 ? <h3 className="notes__group">Notas</h3> : null}
                  <List aria-label="Notas">{rows(others)}</List>
                </section>
              ) : null}
            </>
          )}
        </div>
      </aside>

      <section className="notes__main">
        <Toolbar aria-label="Herramientas de la nota">
          <IconButton label="Nueva nota" onClick={create}>
            <Plus size={16} />
          </IconButton>
          <ToolbarSpacer />
          <IconButton
            label={selected?.pinned ? 'Desfijar nota' : 'Fijar nota'}
            active={selected?.pinned ?? false}
            disabled={!selected}
            onClick={() => selected && togglePin(selected)}
          >
            {selected?.pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </IconButton>
          <IconButton label="Eliminar nota" disabled={!selected} onClick={() => selected && void remove(selected)}>
            <Trash2 size={16} />
          </IconButton>
        </Toolbar>
        {selected ? (
          <>
            <p className="notes__date">{formatNoteDate(selected.updatedAt)}</p>
            <TextArea
              key={selected.id}
              className="notes__editor"
              autoFocus={selected.id === createdId}
              aria-label="Contenido de la nota"
              placeholder="Escribe una nota…"
              spellCheck={false}
              value={selected.content}
              onChange={(event) => edit(selected.id, event.target.value)}
            />
          </>
        ) : (
          <EmptyState title="Ninguna nota seleccionada" description="Elige una nota de la lista o crea una nueva.">
            <Button variant="primary" onClick={create}>
              Nueva nota
            </Button>
          </EmptyState>
        )}
      </section>
    </div>
  )
}
