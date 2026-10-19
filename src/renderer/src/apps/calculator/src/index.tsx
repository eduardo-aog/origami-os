import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Delete, History, X } from 'lucide-react'
import { Button, EmptyState, IconButton } from '@os/ui'
import { useOS } from '@os/sdk'
import { INITIAL_STATE, SYMBOLS, formatDisplay, press, type CalcState, type HistoryEntry, type Key, type Operator } from './engine'
import './calculator.css'

const HISTORY_KEY = 'history'
const MAX_HISTORY = 50

const digit = (value: string): Key => ({ type: 'digit', digit: value })
const operator = (value: Operator): Key => ({ type: 'operator', operator: value })

interface KeyButton {
  label: string
  aria: string
  key: Key
  kind: 'digit' | 'function' | 'operator'
  wide?: boolean
}

const KEYPAD: KeyButton[] = [
  { label: 'AC', aria: 'Borrar todo', key: { type: 'clear' }, kind: 'function' },
  { label: '±', aria: 'Cambiar signo', key: { type: 'negate' }, kind: 'function' },
  { label: '%', aria: 'Porcentaje', key: { type: 'percent' }, kind: 'function' },
  { label: SYMBOLS.divide, aria: 'Dividir', key: operator('divide'), kind: 'operator' },
  { label: '7', aria: '7', key: digit('7'), kind: 'digit' },
  { label: '8', aria: '8', key: digit('8'), kind: 'digit' },
  { label: '9', aria: '9', key: digit('9'), kind: 'digit' },
  { label: SYMBOLS.multiply, aria: 'Multiplicar', key: operator('multiply'), kind: 'operator' },
  { label: '4', aria: '4', key: digit('4'), kind: 'digit' },
  { label: '5', aria: '5', key: digit('5'), kind: 'digit' },
  { label: '6', aria: '6', key: digit('6'), kind: 'digit' },
  { label: SYMBOLS.subtract, aria: 'Restar', key: operator('subtract'), kind: 'operator' },
  { label: '1', aria: '1', key: digit('1'), kind: 'digit' },
  { label: '2', aria: '2', key: digit('2'), kind: 'digit' },
  { label: '3', aria: '3', key: digit('3'), kind: 'digit' },
  { label: SYMBOLS.add, aria: 'Sumar', key: operator('add'), kind: 'operator' },
  { label: '0', aria: '0', key: digit('0'), kind: 'digit', wide: true },
  { label: ',', aria: 'Coma decimal', key: { type: 'decimal' }, kind: 'digit' },
  { label: '=', aria: 'Igual', key: { type: 'equals' }, kind: 'operator' }
]

const OPERATOR_KEYS: Record<string, Operator> = { '+': 'add', '-': 'subtract', '*': 'multiply', x: 'multiply', '/': 'divide' }

function keyFromEvent(event: KeyboardEvent): Key | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (/^[0-9]$/.test(event.key)) return digit(event.key)
  const mapped = OPERATOR_KEYS[event.key]
  if (mapped !== undefined) return operator(mapped)
  switch (event.key) {
    case '.':
    case ',':
      return { type: 'decimal' }
    case 'Enter':
    case '=':
      return { type: 'equals' }
    case '%':
      return { type: 'percent' }
    case 'Backspace':
      return { type: 'backspace' }
    case 'Escape':
    case 'Delete':
      return { type: 'clear' }
    default:
      return null
  }
}

export default function App() {
  const os = useOS()
  const [calc, setCalc] = useState<CalcState>(INITIAL_STATE)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // Al abrirse, la calculadora toma el foco para que el teclado funcione sin tener que hacer clic.
  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    let active = true
    os.storage.get<HistoryEntry[]>(HISTORY_KEY).then((saved) => {
      if (active && Array.isArray(saved)) setHistory(saved)
    })
    return () => {
      active = false
    }
  }, [os.storage])

  function saveHistory(next: HistoryEntry[]) {
    setHistory(next)
    void os.storage.set(HISTORY_KEY, next)
  }

  async function record(entry: Omit<HistoryEntry, 'id'>) {
    // Se parte de lo guardado, no de lo que ve esta ventana: otra ventana de la calculadora pudo añadir operaciones.
    const stored = (await os.storage.get<HistoryEntry[]>(HISTORY_KEY)) ?? []
    saveHistory([{ id: crypto.randomUUID(), ...entry }, ...stored].slice(0, MAX_HISTORY))
  }

  function handle(key: Key) {
    const { state, entry } = press(calc, key)
    setCalc(state)
    if (entry) void record(entry)
  }

  function recall(entry: HistoryEntry) {
    setCalc({ ...INITIAL_STATE, display: entry.raw, overwrite: true })
    setShowHistory(false)
    root.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (showHistory) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowHistory(false)
      }
      return
    }
    const key = keyFromEvent(event)
    if (key === null) return
    event.preventDefault()
    handle(key)
  }

  const shown = calc.error ? calc.display : formatDisplay(calc.display)
  const sizeClass = shown.length > 14 ? ' calculator__value--xs' : shown.length > 10 ? ' calculator__value--small' : ''

  return (
    <div ref={root} className="calculator" tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="calculator__display">
        <div className="calculator__tools">
          <IconButton label="Historial" active={showHistory} onClick={() => setShowHistory((value) => !value)}>
            <History size={16} />
          </IconButton>
          <IconButton label="Borrar la última cifra" onClick={() => handle({ type: 'backspace' })}>
            <Delete size={16} />
          </IconButton>
        </div>
        <div className="calculator__expression" aria-hidden={calc.expression === ''}>
          {calc.expression}
        </div>
        <output className={`calculator__value${sizeClass}${calc.error ? ' calculator__value--error' : ''}`} aria-live="polite">
          {shown}
        </output>
      </div>

      <div className="calculator__keypad">
        {KEYPAD.map((button) => (
          <Button
            key={button.aria}
            className={`calculator__key calculator__key--${button.kind}${button.wide ? ' calculator__key--wide' : ''}${
              button.key.type === 'operator' && calc.operator === button.key.operator && calc.awaitingOperand
                ? ' calculator__key--active'
                : ''
            }`}
            aria-label={button.aria}
            // Los botones no roban el foco: el teclado sigue llegando a la calculadora.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handle(button.key)}
          >
            {button.label}
          </Button>
        ))}
      </div>

      <aside className={`calculator__history${showHistory ? ' calculator__history--open' : ''}`} aria-hidden={!showHistory} inert={!showHistory}>
        <header className="calculator__history-header">
          <h2 className="calculator__history-title">Historial</h2>
          <IconButton label="Cerrar historial" onClick={() => setShowHistory(false)}>
            <X size={16} />
          </IconButton>
        </header>
        {history.length === 0 ? (
          <EmptyState title="Sin operaciones" description="Los resultados que calcules aparecerán aquí." />
        ) : (
          <>
            <ul className="calculator__history-list">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button type="button" className="calculator__history-item" onClick={() => recall(entry)}>
                    <span className="calculator__history-expression">{entry.expression} =</span>
                    <span className="calculator__history-result">{entry.result}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="calculator__history-footer">
              <Button onClick={() => saveHistory([])}>Borrar historial</Button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
