import { useEffect, useState, type FormEvent } from 'react'
import { Avatar, Button, TextField } from '@os/ui'
import { session } from '../../kernel/session'
import { useSession } from '../../kernel/session/hooks'
import { useSettingValue } from '../../kernel/settings/hooks'
import { sound } from '../../kernel/sound'
import { capitalize, formatInTimeZone } from '../common/format-time'
import { useNow } from '../common/useNow'
import { Wallpaper } from '../wallpaper/Wallpaper'
import './LoginScreen.css'

function formatClock(now: Date, timeZone: string, hour24: boolean): { time: string; date: string } {
  return {
    time: formatInTimeZone(now, timeZone, { hour: 'numeric', minute: '2-digit', hour12: !hour24 }),
    date: capitalize(formatInTimeZone(now, timeZone, { weekday: 'long', day: 'numeric', month: 'long' }))
  }
}

/** Pantalla de inicio de sesión (sin sesión) y de bloqueo (con la sesión abierta). */
export function LoginScreen() {
  const phase = useSession((state) => state.phase)
  const user = useSession((state) => state.user)
  const timeZone = useSettingValue('datetime.timezone')
  const hour24 = useSettingValue('datetime.hour24')
  const now = useNow()

  const [revealed, setRevealed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [busy, setBusy] = useState(false)

  // Pulsar cualquier tecla muestra el campo de contraseña; si es un carácter, se conserva.
  useEffect(() => {
    if (revealed) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab' || event.key === 'Shift') return
      setRevealed(true)
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Se cancela el evento para que el navegador no inserte también el carácter en el campo recién enfocado.
        event.preventDefault()
        setPassword(event.key)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [revealed])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || password === '') return
    setBusy(true)
    const ok = phase === 'locked' ? await session.unlock(password) : await session.login(password)
    if (ok) return
    sound.play('error')
    setError('Contraseña incorrecta.')
    setShaking(true)
    setPassword('')
    setBusy(false)
  }

  const { time, date } = formatClock(now, timeZone, hour24)

  return (
    <div
      className="login"
      onClick={() => setRevealed(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && revealed) {
          setRevealed(false)
          setPassword('')
          setError(null)
        }
      }}
    >
      <Wallpaper />
      <div className="login__scrim" />

      <div className={`login__clock${revealed ? ' login__clock--hidden' : ''}`}>
        <div className="login__time">{time}</div>
        <div className="login__date">{date}</div>
        {!revealed ? <p className="login__hint">Haz clic o pulsa una tecla para continuar</p> : null}
      </div>

      {revealed ? (
        <form
          className={`login__panel${shaking ? ' login__panel--shake' : ''}`}
          onSubmit={submit}
          onClick={(event) => event.stopPropagation()}
          onAnimationEnd={() => setShaking(false)}
        >
          <Avatar avatar={user?.avatar ?? null} size={96} />
          <h1 className="login__name">{user?.name}</h1>
          <TextField
            className="login__field"
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Contraseña"
            aria-label="Contraseña"
            value={password}
            error={error}
            disabled={busy}
            onChange={(event) => {
              setPassword(event.target.value)
              setError(null)
            }}
          />
          <Button type="submit" variant="primary" disabled={busy || password === ''}>
            {phase === 'locked' ? 'Desbloquear' : 'Iniciar sesión'}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
