import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useOS } from '@os/sdk'
import { shortPath } from './paths'
import { complete, execute } from './shell'
import { plain, type Line, type Segment, type ShellEnv } from './types'
import './terminal.css'

interface Entry {
  id: number
  line: Line
}

interface Account {
  user: string
  home: string
}

function Row({ line }: { line: Line }) {
  return (
    <div className="terminal__line">
      {line.map((segment, index) => (
        <span key={index} className={segment.tone ? `terminal__tone-${segment.tone}` : undefined}>
          {segment.text}
        </span>
      ))}
    </div>
  )
}

export default function App() {
  const os = useOS()
  const { fs } = os
  const [account, setAccount] = useState<Account | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [cwd, setCwd] = useState('/')
  const entryId = useRef(0)
  const history = useRef<string[]>([])
  const cursor = useRef<number | null>(null)
  const draft = useRef('')
  const env = useRef<ShellEnv | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const cancelRun = useRef<(() => void) | null>(null)
  const field = useRef<HTMLInputElement>(null)

  // El nombre de la carpeta de inicio es el del usuario.
  useEffect(() => {
    let active = true
    fs.stat('~')
      .then(async (home) => {
        const path = await fs.pathOf(home.id)
        if (!active) return
        setAccount({ user: home.name, home: path })
        setCwd(path)
        setEntries([{ id: entryId.current++, line: plain(`Escribe "help" para ver las órdenes disponibles.`) }])
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [fs])

  // El nombre del equipo es el del sistema, sin espacios.
  const host = os.system.name.trim().replace(/\s+/g, '-')

  useEffect(() => {
    if (!account) return
    env.current = {
      fs,
      openFile: (path) => os.apps.openFile(path),
      python: (job, io) => os.python.run(job, io),
      live: {
        print: (lines) => {
          if (lines.length > 0) setEntries((current) => [...current, ...lines.map((line) => ({ id: entryId.current++, line }))])
        },
        setCancel: (cancel) => {
          cancelRun.current = cancel
        }
      },
      user: account.user,
      home: account.home,
      now: () => {
        const hour24 = os.settings.get('datetime.hour24')
        return new Intl.DateTimeFormat('es', {
          dateStyle: 'full',
          timeStyle: 'long',
          hour12: !hour24,
          timeZone: os.settings.get('datetime.timezone')
        }).format(new Date())
      },
      history: () => history.current,
      cwd
    }
  }, [account, fs, os, cwd])

  useEffect(() => {
    if (account) os.window.setTitle(`${os.app.manifest.name} — ${shortPath(cwd, account.home)}`)
  }, [os.window, os.app.manifest.name, account, cwd])

  useEffect(() => {
    const element = scroller.current
    if (element) element.scrollTop = element.scrollHeight
  }, [entries, input])

  // Mientras una orden corre, el campo está desactivado: el foco pasa al contenedor para que Ctrl+C llegue.
  useEffect(() => {
    if (busy) scroller.current?.focus({ preventScroll: true })
    else field.current?.focus({ preventScroll: true })
  }, [busy, account])

  function promptLine(text: string): Line {
    const where = account ? shortPath(cwd, account.home) : cwd
    const segments: Segment[] = [
      { text: `${account?.user ?? ''}@${host}`, tone: 'user' },
      { text: ':' },
      { text: where, tone: 'path' },
      { text: `$ ${text}` }
    ]
    return segments
  }

  function print(lines: Line[]) {
    if (lines.length === 0) return
    setEntries((current) => [...current, ...lines.map((line) => ({ id: entryId.current++, line }))])
  }

  async function submit() {
    const text = input
    const shell = env.current
    if (!shell || busy) return
    print([promptLine(text)])
    setInput('')
    cursor.current = null
    if (text.trim() === '') return

    if (history.current[history.current.length - 1] !== text) history.current.push(text)
    setBusy(true)
    try {
      const result = await execute(text, shell)
      if (result.clear) setEntries([])
      print([...result.out, ...result.err])
      setCwd(shell.cwd)
    } finally {
      setBusy(false)
    }
  }

  async function autocomplete() {
    const shell = env.current
    if (!shell) return
    const result = await complete(input, shell)
    if (!result) return
    if (result.options.length > 0) {
      print([promptLine(input), [{ text: result.options.join('  ') }]])
    }
    setInput(result.text)
  }

  function recall(direction: -1 | 1) {
    const entriesList = history.current
    if (entriesList.length === 0) return
    if (cursor.current === null) {
      if (direction === 1) return
      draft.current = input
      cursor.current = entriesList.length
    }
    const next = cursor.current + direction
    if (next >= entriesList.length) {
      cursor.current = null
      setInput(draft.current)
      return
    }
    cursor.current = Math.max(0, next)
    setInput(entriesList[cursor.current] ?? '')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void submit()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      recall(event.key === 'ArrowUp' ? -1 : 1)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      void autocomplete()
    } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault()
      setEntries([])
    } else if (event.ctrlKey && event.key.toLowerCase() === 'c') {
      event.preventDefault()
      print([[...promptLine(input), { text: '^C', tone: 'muted' }]])
      setInput('')
      cursor.current = null
    }
  }

  function onRootKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.ctrlKey && event.key.toLowerCase() === 'c') || !cancelRun.current) return
    event.preventDefault()
    cancelRun.current()
    print([[{ text: '^C', tone: 'muted' }]])
  }

  return (
    <div
      ref={scroller}
      className="terminal"
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
      onClick={() => {
        if (window.getSelection()?.toString() === '') field.current?.focus({ preventScroll: true })
      }}
    >
      {entries.map((entry) => (
        <Row key={entry.id} line={entry.line} />
      ))}
      {account ? (
        <div className="terminal__prompt">
          {promptLine('').map((segment, index) => (
            <span key={index} className={segment.tone ? `terminal__tone-${segment.tone}` : undefined}>
              {segment.text}
            </span>
          ))}
          <input
            ref={field}
            className="terminal__input"
            aria-label="Línea de órdenes"
            value={input}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => {
              setInput(event.target.value)
              cursor.current = null
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      ) : null}
    </div>
  )
}
