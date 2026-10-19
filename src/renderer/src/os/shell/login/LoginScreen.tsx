import { useEffect, useState, type FormEvent } from 'react'
import { Avatar, Button, TextField } from '@os/ui'
import { session } from '../../kernel/session'
import { useSession } from '../../kernel/session/hooks'
import { settings } from '../../kernel/settings'
import { useSettingValue } from '../../kernel/settings/hooks'
import { sound } from '../../kernel/sound'
import { capitalize, formatInTimeZone } from '../common/format-time'
import { useNow } from '../common/useNow'
import { SetupWizard } from '../setup/SetupWizard'
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
  const activeUser = useSession((state) => state.user)
  const users = useSession((state) => state.users)
  const lastUserId = useSession((state) => state.lastUserId)
  const timeZone = useSettingValue('datetime.timezone')
  const hour24 = useSettingValue('datetime.hour24')
  const now = useNow()

  const [revealed, setRevealed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Con la sesión abierta (pantalla de bloqueo) solo se ofrece esa cuenta. Sin sesión, con una sola cuenta
  // se va directo a su contraseña y con varias se elige primero. La última en entrar sale primero.
  const locked = phase === 'locked'
  const choices = [...users].sort((a, b) => Number(b.id === lastUserId) - Number(a.id === lastUserId))
  const user = locked ? activeUser : (users.length === 1 ? users[0] : users.find((candidate) => candidate.id === selectedId)) ?? null

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
    const ok = locked ? await session.unlock(password) : user ? await session.login(user.id, password) : false
    if (ok) return
    sound.play('error')
    setError('Contraseña incorrecta.')
    setShaking(true)
    setPassword('')
    setBusy(false)
  }

  /** Elegir una cuenta muestra su fondo y su tema antes de entrar (solo se leen sus ajustes). */
  function choose(id: string | null) {
    setSelectedId(id)
    setPassword('')
    setError(null)
    void settings.load(id ?? lastUserId)
  }

  /** Al cerrar el asistente se vuelve a mostrar el aspecto de la cuenta elegida, no el de la vista previa. */
  function closeCreating() {
    setCreating(false)
    void settings.load(user?.id ?? lastUserId)
  }

  const { time, date } = formatClock(now, timeZone, hour24)

  return (
    <div
      className="login"
      onClick={() => setRevealed(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && revealed && !creating) {
          setRevealed(false)
          setPassword('')
          setError(null)
          if (!locked && users.length > 1) choose(null)
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

      {revealed && user === null ? (
        <div className="login__picker" onClick={(event) => event.stopPropagation()}>
          <h1 className="login__picker-title">¿Quién eres?</h1>
          <div className="login__users" role="list">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                role="listitem"
                className="login__user"
                autoFocus={choice.id === lastUserId}
                onClick={() => choose(choice.id)}
              >
                <Avatar avatar={choice.avatar} size={80} />
                <span className="login__user-name">{choice.name}</span>
              </button>
            ))}
          </div>
          <button type="button" className="login__link" onClick={() => setCreating(true)}>
            Nuevo usuario
          </button>
        </div>
      ) : null}

      {revealed && user !== null ? (
        <form
          className={`login__panel${shaking ? ' login__panel--shake' : ''}`}
          onSubmit={submit}
          onClick={(event) => event.stopPropagation()}
          onAnimationEnd={() => setShaking(false)}
        >
          <Avatar avatar={user.avatar} size={96} />
          <h1 className="login__name">{user.name}</h1>
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
            {locked ? 'Desbloquear' : 'Iniciar sesión'}
          </Button>
          {!locked ? (
            <div className="login__links">
              {users.length > 1 ? (
                <button type="button" className="login__link" onClick={() => choose(null)}>
                  Otro usuario
                </button>
              ) : null}
              <button type="button" className="login__link" onClick={() => setCreating(true)}>
                Nuevo usuario
              </button>
            </div>
          ) : null}
        </form>
      ) : null}

      {creating ? <SetupWizard mode="additional" onClose={closeCreating} /> : null}
    </div>
  )
}
