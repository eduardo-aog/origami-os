import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronUp, FilePlus2, FolderOpen, Minus, Plus, Save, Search, X } from 'lucide-react'
import { IconButton, TextField, Toolbar, ToolbarSeparator, ToolbarSpacer } from '@os/ui'
import { useAppMenus, useLaunchArgs, useOS, useUnsavedChanges, type AppMenu } from '@os/sdk'
import { countWords, findMatches } from './find'
import { backspaceEdit, enterEdit, tabEdit, type Edit } from './indent'
import './text-editor.css'

const FONT_KEY = 'fontSize'
const DEFAULT_FONT_SIZE = 14
const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 32
const UNTITLED = 'Sin título'
const EXTENSIONS = ['txt', 'md', 'py']

interface Document {
  path: string | null
  text: string
  /** Último contenido guardado; si difiere de `text`, hay cambios sin guardar. */
  saved: string
}

const EMPTY: Document = { path: null, text: '', saved: '' }

const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path
const folderOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/'
const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))
const clampSize = (size: number) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size))

export default function App() {
  const os = useOS()
  const { fs, dialogs } = os
  const args = useLaunchArgs()
  const filePath = typeof args.filePath === 'string' ? args.filePath : null

  const [doc, setDoc] = useState<Document>(EMPTY)
  const [loading, setLoading] = useState(filePath !== null)
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)
  const [find, setFind] = useState({ open: false, query: '', index: 0 })
  const [reveal, setReveal] = useState(0)
  const editor = useRef<HTMLTextAreaElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  const findInput = useRef<HTMLInputElement>(null)

  const name = doc.path === null ? UNTITLED : baseName(doc.path)
  const isDirty = doc.text !== doc.saved
  const matches = useMemo(() => findMatches(doc.text, find.query), [doc.text, find.query])
  const current = matches.length === 0 ? -1 : find.index % matches.length

  useEffect(() => {
    let active = true
    os.storage.get<number>(FONT_KEY).then((saved) => {
      if (active && typeof saved === 'number') setFontSize(clampSize(saved))
    })
    return () => {
      active = false
    }
  }, [os.storage])

  useEffect(() => {
    if (filePath === null) return
    let active = true
    fs.readText(filePath)
      .then((text) => {
        if (!active) return
        setDoc({ path: filePath, text, saved: text })
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoading(false)
        void dialogs.alert({ title: 'No se pudo abrir el archivo', message: describeError(error) })
      })
    return () => {
      active = false
    }
  }, [filePath, fs, dialogs])

  useEffect(() => {
    os.window.setTitle(`${isDirty ? '● ' : ''}${name} — ${os.app.manifest.name}`)
  }, [os.window, os.app.manifest.name, name, isDirty])

  // El texto se enfoca al terminar de cargar y después de cada diálogo, para que los atajos sigan llegando.
  const focusEditor = () => editor.current?.focus()
  useEffect(() => {
    if (!loading) editor.current?.focus()
  }, [loading])

  // Lleva la coincidencia actual a la vista cuando el usuario navega o cambia la búsqueda (no al escribir en el texto).
  useEffect(() => {
    const textarea = editor.current
    const mark = mirror.current?.querySelector<HTMLElement>('mark[data-current]')
    if (!textarea || !mark) return
    const top = mark.offsetTop
    const bottom = top + mark.offsetHeight
    if (top < textarea.scrollTop || bottom > textarea.scrollTop + textarea.clientHeight) {
      textarea.scrollTop = Math.max(0, top - textarea.clientHeight / 3)
    }
  }, [reveal])

  async function write(path: string, text: string): Promise<boolean> {
    try {
      await fs.writeFile(path, text, { overwrite: true })
      setDoc((previous) => ({ ...previous, path, saved: text }))
      return true
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo guardar', message: describeError(error) })
      return false
    }
  }

  async function saveAs(): Promise<boolean> {
    const target = await dialogs.saveFile({
      startPath: doc.path === null ? '~/Documentos' : folderOf(doc.path),
      defaultName: doc.path === null ? `${UNTITLED}.txt` : baseName(doc.path),
      extensions: EXTENSIONS
    })
    focusEditor()
    if (target === null) return false
    return write(target, doc.text)
  }

  async function save(): Promise<boolean> {
    const saved = doc.path === null ? await saveAs() : await write(doc.path, doc.text)
    focusEditor()
    return saved
  }

  const { confirmDiscard } = useUnsavedChanges({ isDirty, documentName: name, save })

  async function newDocument() {
    if (!(await confirmDiscard())) return
    setDoc(EMPTY)
    setFind((previous) => ({ ...previous, index: 0 }))
    focusEditor()
  }

  async function openDocument() {
    const picked = await dialogs.openFile({
      startPath: doc.path === null ? '~/Documentos' : folderOf(doc.path),
      extensions: EXTENSIONS
    })
    const target = picked?.[0]
    if (target === undefined) {
      focusEditor()
      return
    }
    if (!(await confirmDiscard())) {
      focusEditor()
      return
    }
    try {
      const text = await fs.readText(target)
      setDoc({ path: target, text, saved: text })
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo abrir el archivo', message: describeError(error) })
    }
    focusEditor()
  }

  function changeFontSize(next: number) {
    const size = clampSize(next)
    setFontSize(size)
    void os.storage.set(FONT_KEY, size)
  }

  function openFind() {
    const textarea = editor.current
    const selected = textarea ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) : ''
    if (find.open) {
      findInput.current?.select()
      return
    }
    setFind({ open: true, query: selected !== '' && !selected.includes('\n') ? selected : find.query, index: 0 })
    setReveal((value) => value + 1)
  }

  function closeFind() {
    setFind((previous) => ({ ...previous, open: false }))
    focusEditor()
  }

  function step(direction: 1 | -1) {
    if (matches.length === 0) return
    setFind((previous) => ({ ...previous, index: (current + direction + matches.length) % matches.length }))
    setReveal((value) => value + 1)
  }

  const menus: AppMenu[] = [
    {
      label: 'Archivo',
      items: [
        { label: 'Nuevo', shortcut: 'Ctrl+N', onSelect: () => void newDocument() },
        { label: 'Abrir…', shortcut: 'Ctrl+O', onSelect: () => void openDocument() },
        { separator: true },
        { label: 'Guardar', shortcut: 'Ctrl+S', onSelect: () => void save() },
        { label: 'Guardar como…', shortcut: 'Ctrl+Shift+S', onSelect: () => void saveAs() }
      ]
    },
    {
      label: 'Edición',
      items: [
        { label: 'Seleccionar todo', shortcut: 'Ctrl+A', onSelect: () => editor.current?.select() },
        { separator: true },
        { label: 'Buscar…', shortcut: 'Ctrl+F', onSelect: openFind },
        { label: 'Buscar siguiente', shortcut: 'F3', disabled: matches.length === 0, onSelect: () => step(1) },
        { label: 'Buscar anterior', shortcut: 'Shift+F3', disabled: matches.length === 0, onSelect: () => step(-1) }
      ]
    },
    {
      label: 'Visualización',
      items: [
        { label: 'Aumentar tamaño de letra', shortcut: 'Ctrl++', onSelect: () => changeFontSize(fontSize + 1) },
        { label: 'Reducir tamaño de letra', shortcut: 'Ctrl+-', onSelect: () => changeFontSize(fontSize - 1) },
        { label: 'Tamaño predeterminado', shortcut: 'Ctrl+0', onSelect: () => changeFontSize(DEFAULT_FONT_SIZE) }
      ]
    }
  ]
  useAppMenus(menus)

  /** Aplica una edición como una sola acción del historial (así `Ctrl+Z` la deshace entera). */
  function applyEdit(textarea: HTMLTextAreaElement, edit: Edit) {
    textarea.setSelectionRange(edit.from, edit.to)
    if (!document.execCommand('insertText', false, edit.insert)) {
      textarea.setRangeText(edit.insert, edit.from, edit.to, 'end')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }
    textarea.setSelectionRange(edit.selStart, edit.selEnd)
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return
    const textarea = event.currentTarget
    const { selectionStart: start, selectionEnd: end, value } = textarea
    let edit: Edit | null = null
    if (event.key === 'Tab') edit = tabEdit(value, start, end, event.shiftKey)
    else if (event.key === 'Enter' && !event.shiftKey) edit = enterEdit(value, start, end, doc.path?.toLowerCase().endsWith('.py') ?? false)
    else if (event.key === 'Backspace' && !event.shiftKey) edit = backspaceEdit(value, start, end)
    if (edit === null) return
    event.preventDefault()
    applyEdit(textarea, edit)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'F3') {
      event.preventDefault()
      step(event.shiftKey ? -1 : 1)
      return
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLowerCase()
    const shortcuts: Record<string, () => void> = {
      s: () => void (event.shiftKey ? saveAs() : save()),
      n: () => void newDocument(),
      o: () => void openDocument(),
      f: openFind,
      '+': () => changeFontSize(fontSize + 1),
      '=': () => changeFontSize(fontSize + 1),
      '-': () => changeFontSize(fontSize - 1),
      '0': () => changeFontSize(DEFAULT_FONT_SIZE)
    }
    const action = shortcuts[key]
    if (action === undefined) return
    event.preventDefault()
    action()
  }

  const highlighted = useMemo(() => {
    const parts: (string | { key: number; text: string; current: boolean })[] = []
    let cursor = 0
    matches.forEach((match, index) => {
      parts.push(doc.text.slice(cursor, match.start))
      parts.push({ key: index, text: doc.text.slice(match.start, match.end), current: index === current })
      cursor = match.end
    })
    parts.push(doc.text.slice(cursor))
    return parts
  }, [matches, current, doc.text])

  return (
    <div
      className="text-editor"
      tabIndex={-1}
      style={{ '--editor-font-size': `${fontSize}px` } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <Toolbar aria-label="Herramientas">
        <IconButton label="Nuevo" onClick={() => void newDocument()}>
          <FilePlus2 size={16} />
        </IconButton>
        <IconButton label="Abrir…" onClick={() => void openDocument()}>
          <FolderOpen size={16} />
        </IconButton>
        <IconButton label="Guardar" onClick={() => void save()}>
          <Save size={16} />
        </IconButton>
        <ToolbarSeparator />
        <IconButton label="Buscar…" active={find.open} onClick={openFind}>
          <Search size={16} />
        </IconButton>
        <ToolbarSpacer />
        <span className="text-editor__file" title={doc.path ?? undefined}>
          {name}
          {isDirty ? ' — editado' : ''}
        </span>
      </Toolbar>

      {find.open ? (
        <div className="text-editor__find" role="search">
          <TextField
            ref={findInput}
            className="text-editor__find-input"
            aria-label="Buscar en el documento"
            placeholder="Buscar"
            autoFocus
            value={find.query}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              setFind({ open: true, query: event.target.value, index: 0 })
              setReveal((value) => value + 1)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                step(event.shiftKey ? -1 : 1)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                closeFind()
              }
            }}
          />
          <span className="text-editor__find-count" aria-live="polite">
            {find.query === '' ? '' : matches.length === 0 ? 'Sin resultados' : `${current + 1} de ${matches.length}`}
          </span>
          <IconButton label="Anterior" disabled={matches.length === 0} onClick={() => step(-1)}>
            <ChevronUp size={16} />
          </IconButton>
          <IconButton label="Siguiente" disabled={matches.length === 0} onClick={() => step(1)}>
            <ChevronDown size={16} />
          </IconButton>
          <IconButton label="Cerrar búsqueda" onClick={closeFind}>
            <X size={16} />
          </IconButton>
        </div>
      ) : null}

      <div className="text-editor__surface">
        <div ref={mirror} className="text-editor__layer text-editor__mirror" aria-hidden="true">
          {highlighted.map((part, index) =>
            typeof part === 'string' ? (
              part
            ) : (
              <mark key={index} data-current={part.current ? '' : undefined}>
                {part.text}
              </mark>
            )
          )}
          {' '}
        </div>
        <textarea
          ref={editor}
          className="text-editor__layer text-editor__text"
          aria-label="Contenido del documento"
          spellCheck={false}
          disabled={loading}
          value={doc.text}
          onChange={(event) => setDoc((previous) => ({ ...previous, text: event.target.value }))}
          onKeyDown={onEditorKeyDown}
          onScroll={(event) => {
            if (mirror.current) {
              mirror.current.scrollTop = event.currentTarget.scrollTop
              mirror.current.scrollLeft = event.currentTarget.scrollLeft
            }
          }}
        />
      </div>

      <div className="text-editor__status">
        <span>
          {countWords(doc.text).toLocaleString('es')} palabras · {doc.text.length.toLocaleString('es')} caracteres
        </span>
        <span className="text-editor__size">
          <IconButton label="Reducir tamaño de letra" disabled={fontSize <= MIN_FONT_SIZE} onClick={() => changeFontSize(fontSize - 1)}>
            <Minus size={14} />
          </IconButton>
          <span aria-label="Tamaño de letra">{fontSize} px</span>
          <IconButton label="Aumentar tamaño de letra" disabled={fontSize >= MAX_FONT_SIZE} onClick={() => changeFontSize(fontSize + 1)}>
            <Plus size={14} />
          </IconButton>
        </span>
      </div>
    </div>
  )
}
