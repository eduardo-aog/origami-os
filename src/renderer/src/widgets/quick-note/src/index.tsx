import { useEffect, useRef, useState } from 'react'
import { useWidgetOS } from '@os/sdk'
import './quick-note.css'

const KEY = 'text'
const SAVE_DELAY_MS = 400

export default function QuickNoteWidget() {
  const { storage } = useWidgetOS()
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    storage
      .get<string>(KEY)
      .then((saved) => {
        if (!active) return
        setText(saved ?? '')
        setLoaded(true)
      })
      .catch(() => active && setLoaded(true))
    return () => {
      active = false
    }
  }, [storage])

  // Si el widget se quita o se cambia de tamaño con un guardado pendiente, se guarda al salir.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
      if (pending.current !== null) void storage.set(KEY, pending.current)
    },
    [storage]
  )

  function change(value: string) {
    setText(value)
    pending.current = value
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      pending.current = null
      void storage.set(KEY, value)
    }, SAVE_DELAY_MS)
  }

  return (
    <div className="quick-note">
      <textarea
        className="quick-note__text"
        aria-label="Nota rápida"
        placeholder="Escribe una nota…"
        spellCheck={false}
        disabled={!loaded}
        value={text}
        onChange={(event) => change(event.target.value)}
      />
    </div>
  )
}
