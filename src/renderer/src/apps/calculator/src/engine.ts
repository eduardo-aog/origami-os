export type Operator = 'add' | 'subtract' | 'multiply' | 'divide'

export type Key =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'operator'; operator: Operator }
  | { type: 'equals' }
  | { type: 'percent' }
  | { type: 'negate' }
  | { type: 'backspace' }
  | { type: 'clear' }

export interface CalcState {
  /** Número que se está escribiendo o el último resultado, con punto decimal (no es lo que se muestra). */
  display: string
  accumulator: number | null
  operator: Operator | null
  /** Se acaba de pulsar un operador: todavía falta el segundo operando. */
  awaitingOperand: boolean
  /** La siguiente cifra reemplaza lo que hay en pantalla en lugar de añadirse. */
  overwrite: boolean
  /** Operación de la última igualdad, para repetirla al pulsar "=" de nuevo. */
  repeat: { operator: Operator; operand: number } | null
  expression: string
  error: boolean
}

export interface HistoryEntry {
  id: string
  expression: string
  /** Resultado tal como se muestra. */
  result: string
  /** Resultado en la forma interna, para volver a usarlo. */
  raw: string
}

export const INITIAL_STATE: CalcState = {
  display: '0',
  accumulator: null,
  operator: null,
  awaitingOperand: false,
  overwrite: true,
  repeat: null,
  expression: '',
  error: false
}

const MAX_DIGITS = 15

export const SYMBOLS: Record<Operator, string> = { add: '+', subtract: '−', multiply: '×', divide: '÷' }

/** Redondea a 12 cifras significativas para ocultar el error de la coma flotante (0,1 + 0,2). */
const clean = (value: number) => Number(value.toPrecision(12))

function apply(left: number, operator: Operator, right: number): number | null {
  switch (operator) {
    case 'add':
      return clean(left + right)
    case 'subtract':
      return clean(left - right)
    case 'multiply':
      return clean(left * right)
    case 'divide':
      return right === 0 ? null : clean(left / right)
  }
}

/** Pasa un número a la forma interna (con punto decimal). */
function toRaw(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const text = String(clean(value))
  if (!text.includes('e')) return text
  const [mantissa = '0', exponent = '0'] = text.split('e')
  return `${mantissa}e${exponent}`
}

/** Texto para mostrar: coma decimal y puntos como separador de millares. */
export function formatDisplay(raw: string): string {
  const [integer = '0', fraction, ...rest] = raw.split('.')
  if (rest.length > 0 || raw.includes('e')) return raw.replace('.', ',').replace('e', ' × 10^').replace('^+', '^')
  const sign = integer.startsWith('-') ? '-' : ''
  const digits = integer.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${digits}${fraction !== undefined ? `,${fraction}` : ''}`
}

const fail = (state: CalcState): CalcState => ({
  ...INITIAL_STATE,
  display: 'No definido',
  repeat: null,
  expression: state.expression,
  error: true
})

export interface PressResult {
  state: CalcState
  entry?: Omit<HistoryEntry, 'id'>
}

export function press(previous: CalcState, key: Key): PressResult {
  // Tras un error, cualquier tecla empieza de cero.
  const state = previous.error ? INITIAL_STATE : previous
  const value = Number(state.display)

  switch (key.type) {
    case 'digit': {
      if (state.overwrite) {
        return { state: { ...state, display: key.digit, awaitingOperand: false, overwrite: false } }
      }
      const digits = state.display.replace(/[-.]/g, '')
      if (digits.length >= MAX_DIGITS) return { state }
      return { state: { ...state, display: state.display === '0' ? key.digit : state.display + key.digit } }
    }

    case 'decimal': {
      if (state.overwrite) return { state: { ...state, display: '0.', awaitingOperand: false, overwrite: false } }
      if (state.display.includes('.')) return { state }
      return { state: { ...state, display: `${state.display}.` } }
    }

    case 'operator': {
      const symbol = SYMBOLS[key.operator]
      if (state.operator !== null && state.accumulator !== null && !state.awaitingOperand) {
        const result = apply(state.accumulator, state.operator, value)
        if (result === null) return { state: fail(state) }
        return {
          state: {
            ...state,
            display: toRaw(result),
            accumulator: result,
            operator: key.operator,
            awaitingOperand: true,
            overwrite: true,
            repeat: null,
            expression: `${formatDisplay(toRaw(result))} ${symbol}`
          }
        }
      }
      const base = state.operator !== null && state.accumulator !== null ? state.accumulator : value
      return {
        state: {
          ...state,
          accumulator: base,
          operator: key.operator,
          awaitingOperand: true,
          overwrite: true,
          repeat: null,
          expression: `${formatDisplay(toRaw(base))} ${symbol}`
        }
      }
    }

    case 'equals': {
      const step =
        state.operator !== null && state.accumulator !== null
          ? { left: state.accumulator, operator: state.operator, right: value }
          : state.repeat !== null
            ? { left: value, operator: state.repeat.operator, right: state.repeat.operand }
            : null
      if (step === null) return { state }
      const result = apply(step.left, step.operator, step.right)
      const expression = `${formatDisplay(toRaw(step.left))} ${SYMBOLS[step.operator]} ${formatDisplay(toRaw(step.right))}`
      if (result === null) return { state: fail({ ...state, expression: `${expression} =` }) }
      return {
        state: {
          display: toRaw(result),
          accumulator: null,
          operator: null,
          awaitingOperand: false,
          overwrite: true,
          repeat: { operator: step.operator, operand: step.right },
          expression: `${expression} =`,
          error: false
        },
        entry: { expression, result: formatDisplay(toRaw(result)), raw: toRaw(result) }
      }
    }

    case 'percent': {
      const relative =
        state.operator !== null && state.accumulator !== null && (state.operator === 'add' || state.operator === 'subtract')
      const percent = relative ? clean((state.accumulator ?? 0) * value / 100) : clean(value / 100)
      return { state: { ...state, display: toRaw(percent), awaitingOperand: false, overwrite: true } }
    }

    case 'negate': {
      if (state.display === '0') return { state }
      const display = state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`
      return { state: { ...state, display, awaitingOperand: false } }
    }

    case 'backspace': {
      if (state.overwrite) return { state }
      const trimmed = state.display.slice(0, -1)
      return { state: { ...state, display: trimmed === '' || trimmed === '-' ? '0' : trimmed } }
    }

    case 'clear':
      return { state: INITIAL_STATE }
  }
}
