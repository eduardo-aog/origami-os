import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ImagePlus, Plus, Search, Trash2, X } from 'lucide-react'
import { Button, EmptyState, FsImage, IconButton, Select, TextArea, TextField, Toolbar, ToolbarSpacer } from '@os/ui'
import { useAppMenus, useOS, type AppMenu } from '@os/sdk'
import {
  CONTACT_PREFIX,
  IMAGE_EXTENSIONS,
  LABELS,
  contactKey,
  displayName,
  initials,
  isEmpty,
  matchesQuery,
  newContact,
  newEntry,
  sectionOf,
  sortContacts,
  type Contact,
  type LabeledValue
} from './contacts'
import './contacts.css'

const SAVE_DELAY_MS = 400

type EntryField = 'phones' | 'emails'

export default function App() {
  const os = useOS()
  const { storage, dialogs, fs } = os
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const latest = useRef<Contact[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Al abrirse, la app toma el foco para que sus atajos funcionen sin tener que hacer clic.
  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    latest.current = contacts ?? []
  }, [contacts])

  useEffect(() => {
    let active = true
    storage.list<Contact>(CONTACT_PREFIX).then((records) => {
      if (!active) return
      const loaded = sortContacts(records.map((record) => record.value))
      setContacts(loaded)
      setSelectedId(loaded[0]?.id ?? null)
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
        const contact = latest.current.find((candidate) => candidate.id === id)
        if (contact && !isEmpty(contact)) void storage.set(contactKey(id), contact)
      }
      pending.clear()
    }
  }, [storage])

  const visible = useMemo(
    () => sortContacts((contacts ?? []).filter((contact) => matchesQuery(contact, query))),
    [contacts, query]
  )
  const selected = contacts?.find((contact) => contact.id === selectedId) ?? null

  /** Un contacto nuevo sin datos solo existe en pantalla: si se abandona vacío, desaparece sin haberse guardado. */
  function dropIfEmpty(list: Contact[], id: string | null): Contact[] {
    const candidate = list.find((contact) => contact.id === id)
    return candidate && isEmpty(candidate) ? list.filter((contact) => contact.id !== id) : list
  }

  function select(id: string | null) {
    setContacts((previous) => (previous ? dropIfEmpty(previous, selectedId) : previous))
    setSelectedId(id)
  }

  function update(id: string, patch: Partial<Contact>) {
    setContacts((previous) =>
      previous?.map((contact) => (contact.id === id ? { ...contact, ...patch, updatedAt: Date.now() } : contact)) ?? previous
    )
    const pending = timers.current.get(id)
    if (pending !== undefined) clearTimeout(pending)
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id)
        const contact = latest.current.find((candidate) => candidate.id === id)
        if (!contact) return
        void (isEmpty(contact) ? storage.delete(contactKey(id)) : storage.set(contactKey(id), contact))
      }, SAVE_DELAY_MS)
    )
  }

  function create() {
    const contact = newContact()
    setContacts((previous) => [...dropIfEmpty(previous ?? [], selectedId), contact])
    setQuery('')
    setSelectedId(contact.id)
    setCreatedId(contact.id)
  }

  async function remove(contact: Contact) {
    const confirmed = await dialogs.confirm({
      title: `¿Eliminar a "${displayName(contact)}"?`,
      message: 'El contacto se eliminará definitivamente. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true
    })
    if (!confirmed) return
    const pending = timers.current.get(contact.id)
    if (pending !== undefined) {
      clearTimeout(pending)
      timers.current.delete(contact.id)
    }
    const index = visible.findIndex((candidate) => candidate.id === contact.id)
    const neighbour = visible[index + 1] ?? visible[index - 1] ?? null
    setContacts((previous) => previous?.filter((candidate) => candidate.id !== contact.id) ?? previous)
    setSelectedId(neighbour?.id ?? null)
    await storage.delete(contactKey(contact.id))
  }

  async function choosePhoto(contact: Contact) {
    const picked = await dialogs.openFile({ startPath: '~/Imágenes', extensions: IMAGE_EXTENSIONS })
    const path = picked?.[0]
    if (path === undefined) return
    try {
      update(contact.id, { photoNodeId: (await fs.stat(path)).id })
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo usar la imagen', message: error instanceof Error ? error.message : String(error) })
    }
  }

  function changeEntry(contact: Contact, field: EntryField, id: string, patch: Partial<LabeledValue>) {
    update(contact.id, { [field]: contact[field].map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) })
  }

  const menus: AppMenu[] = [
    {
      label: 'Contacto',
      items: [
        { label: 'Nuevo contacto', shortcut: 'Ctrl+N', onSelect: create },
        { separator: true },
        { label: 'Eliminar contacto…', destructive: true, disabled: !selected, onSelect: () => selected && void remove(selected) }
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

  function entries(contact: Contact, field: EntryField, title: string, addLabel: string, type: 'tel' | 'email') {
    return (
      <section className="contacts__section">
        <h3 className="contacts__section-title">{title}</h3>
        {contact[field].map((entry) => (
          <div key={entry.id} className="contacts__entry">
            <Select
              aria-label={`Etiqueta de ${title.toLowerCase()}`}
              value={entry.label}
              options={LABELS}
              onChange={(label) => changeEntry(contact, field, entry.id, { label })}
            />
            <TextField
              className="contacts__entry-value"
              aria-label={title}
              type={type}
              value={entry.value}
              onChange={(event) => changeEntry(contact, field, entry.id, { value: event.target.value })}
            />
            <IconButton
              label={`Quitar ${title.toLowerCase()}`}
              onClick={() => update(contact.id, { [field]: contact[field].filter((candidate) => candidate.id !== entry.id) })}
            >
              <X size={14} />
            </IconButton>
          </div>
        ))}
        <Button className="contacts__add" onClick={() => update(contact.id, { [field]: [...contact[field], newEntry()] })}>
          <Plus size={14} /> {addLabel}
        </Button>
      </section>
    )
  }

  return (
    <div ref={root} className="contacts" tabIndex={-1} onKeyDown={onKeyDown}>
      <aside className="contacts__sidebar">
        <div className="contacts__search">
          <Search size={14} aria-hidden="true" />
          <TextField
            className="contacts__search-input"
            aria-label="Buscar contactos"
            placeholder="Buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <IconButton label="Nuevo contacto" onClick={create}>
            <Plus size={16} />
          </IconButton>
        </div>
        <div className="contacts__list">
          {contacts === null ? null : visible.length === 0 ? (
            <EmptyState
              title={query.trim() === '' ? 'Sin contactos' : 'Sin resultados'}
              description={query.trim() === '' ? 'Añade a las personas que conoces.' : 'Prueba con otra búsqueda.'}
            />
          ) : (
            <ul className="contacts__items">
              {visible.map((contact, index) => {
                const section = sectionOf(contact)
                const previous = visible[index - 1]
                const header = previous === undefined || sectionOf(previous) !== section
                return (
                  <li key={contact.id}>
                    {header ? <h3 className="contacts__letter">{section}</h3> : null}
                    <button
                      type="button"
                      className="contacts__item"
                      aria-current={contact.id === selectedId ? 'true' : undefined}
                      onClick={() => select(contact.id)}
                    >
                      <span className="contacts__avatar contacts__avatar--small">
                        {initials(contact)}
                        {contact.photoNodeId !== null ? (
                          <FsImage className="contacts__photo" nodeId={contact.photoNodeId} />
                        ) : null}
                      </span>
                      <span className="contacts__item-name">{displayName(contact)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      <section className="contacts__main">
        {selected ? (
          <>
            <Toolbar aria-label="Herramientas del contacto">
              <ToolbarSpacer />
              <IconButton label="Eliminar contacto" onClick={() => void remove(selected)}>
                <Trash2 size={16} />
              </IconButton>
            </Toolbar>
            <div className="contacts__form" key={selected.id}>
              <div className="contacts__header">
                <div className="contacts__avatar contacts__avatar--large">
                  {initials(selected)}
                  {selected.photoNodeId !== null ? <FsImage className="contacts__photo" nodeId={selected.photoNodeId} /> : null}
                </div>
                <div className="contacts__header-actions">
                  <Button onClick={() => void choosePhoto(selected)}>
                    <ImagePlus size={14} /> {selected.photoNodeId === null ? 'Añadir foto' : 'Cambiar foto'}
                  </Button>
                  {selected.photoNodeId !== null ? (
                    <Button onClick={() => update(selected.id, { photoNodeId: null })}>Quitar foto</Button>
                  ) : null}
                </div>
              </div>
              <div className="contacts__names">
                <TextField
                  label="Nombre"
                  autoFocus={selected.id === createdId}
                  value={selected.firstName}
                  onChange={(event) => update(selected.id, { firstName: event.target.value })}
                />
                <TextField
                  label="Apellido"
                  value={selected.lastName}
                  onChange={(event) => update(selected.id, { lastName: event.target.value })}
                />
              </div>
              {entries(selected, 'phones', 'Teléfonos', 'Añadir teléfono', 'tel')}
              {entries(selected, 'emails', 'Correos', 'Añadir correo', 'email')}
              <TextField
                label="Dirección"
                value={selected.address}
                onChange={(event) => update(selected.id, { address: event.target.value })}
              />
              <TextField
                label="Cumpleaños"
                type="date"
                value={selected.birthday}
                onChange={(event) => update(selected.id, { birthday: event.target.value })}
              />
              <TextArea
                className="contacts__notes"
                label="Notas"
                value={selected.notes}
                onChange={(event) => update(selected.id, { notes: event.target.value })}
              />
            </div>
          </>
        ) : (
          <EmptyState title="Ningún contacto seleccionado" description="Elige un contacto de la lista o añade uno nuevo.">
            <Button variant="primary" onClick={create}>
              Nuevo contacto
            </Button>
          </EmptyState>
        )}
      </section>
    </div>
  )
}
