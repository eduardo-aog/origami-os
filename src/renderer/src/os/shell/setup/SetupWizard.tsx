import { useState, type FormEvent } from 'react'
import logoUrl from '@system/boot/logo.svg'
import { Button, TextField } from '@os/ui'
import { listBuiltinAvatars } from '../../kernel/appearance'
import { getApp, SETTINGS_APP_ID } from '../../kernel/apps'
import { osConfig } from '../../kernel/config'
import { validateNodeName } from '../../kernel/fs'
import { MIN_PASSWORD_LENGTH, session } from '../../kernel/session'
import { settings, type SettingValue } from '../../kernel/settings'
import { Wallpaper } from '../wallpaper/Wallpaper'
import './SetupWizard.css'

type Step = 'welcome' | 'name' | 'password' | 'avatar' | 'theme' | 'creating'
type Theme = Exclude<SettingValue<'appearance.theme'>, 'auto'>

const STEPS: Step[] = ['welcome', 'name', 'password', 'avatar', 'theme']
const MAX_NAME_LENGTH = 32

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' }
]

function validateName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length > MAX_NAME_LENGTH) return `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`
  return validateNodeName(trimmed)
}

function validatePassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  return password === confirmation ? null : 'Las contraseñas no coinciden.'
}

export function SetupWizard() {
  const avatars = listBuiltinAvatars()
  const settingsName = getApp(SETTINGS_APP_ID)?.manifest.name
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [avatarId, setAvatarId] = useState(avatars[0]?.id ?? '')
  const [theme, setTheme] = useState<Theme>(() => (settings.get('appearance.theme') === 'dark' ? 'dark' : 'light'))
  const [error, setError] = useState<string | null>(null)

  const stepIndex = STEPS.indexOf(step)

  function goTo(next: Step) {
    setError(null)
    setStep(next)
  }

  function chooseTheme(next: Theme) {
    setTheme(next)
    // Se aplica al instante para que se vea cómo queda.
    void settings.set('appearance.theme', next)
  }

  async function finish() {
    goTo('creating')
    try {
      await session.completeSetup({ name, password, avatar: { type: 'builtin', id: avatarId }, theme })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
      setStep('theme')
    }
  }

  function next(event: FormEvent) {
    event.preventDefault()
    const problem =
      step === 'name' ? validateName(name) : step === 'password' ? validatePassword(password, confirmation) : null
    if (problem) {
      setError(problem)
      return
    }
    if (step === 'theme') void finish()
    else goTo(STEPS[stepIndex + 1] ?? 'theme')
  }

  return (
    <div className="setup">
      <Wallpaper />
      <div className="setup__card">
        {step === 'creating' ? (
          <div className="setup__creating" role="status">
            <div className="setup__spinner" aria-hidden="true" />
            <p>Preparando tu escritorio…</p>
          </div>
        ) : (
          <form className="setup__form" onSubmit={next} noValidate>
            {step === 'welcome' ? (
              <>
                <img className="setup__logo" src={logoUrl} alt="" width={88} height={88} />
                <h1 className="setup__title">Te damos la bienvenida a {osConfig.name}</h1>
                <p className="setup__text">Vamos a crear tu cuenta en unos pocos pasos.</p>
              </>
            ) : null}

            {step === 'name' ? (
              <>
                <h1 className="setup__title">¿Cómo te llamas?</h1>
                <p className="setup__text">Este nombre aparecerá al iniciar sesión y en tu carpeta personal.</p>
                <TextField
                  label="Nombre"
                  autoFocus
                  autoComplete="off"
                  value={name}
                  error={error}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError(null)
                  }}
                />
              </>
            ) : null}

            {step === 'password' ? (
              <>
                <h1 className="setup__title">Crea una contraseña</h1>
                <p className="setup__text">La necesitarás para iniciar sesión y desbloquear la pantalla.</p>
                <TextField
                  label="Contraseña"
                  type="password"
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError(null)
                  }}
                />
                <TextField
                  label="Confirmar contraseña"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  error={error}
                  onChange={(event) => {
                    setConfirmation(event.target.value)
                    setError(null)
                  }}
                />
              </>
            ) : null}

            {step === 'avatar' ? (
              <>
                <h1 className="setup__title">Elige un avatar</h1>
                <div className="setup__avatars" role="radiogroup" aria-label="Avatar">
                  {avatars.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      role="radio"
                      aria-checked={avatar.id === avatarId}
                      aria-label={avatar.id}
                      className="setup__avatar"
                      onClick={() => setAvatarId(avatar.id)}
                    >
                      <img src={avatar.url} alt="" width={56} height={56} draggable={false} />
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 'theme' ? (
              <>
                <h1 className="setup__title">Elige la apariencia</h1>
                <p className="setup__text">
                  {settingsName ? `Podrás cambiarla después en ${settingsName}.` : 'Podrás cambiarla más adelante.'}
                </p>
                <div className="setup__themes" role="radiogroup" aria-label="Apariencia">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={option.value === theme}
                      className="setup__theme"
                      onClick={() => chooseTheme(option.value)}
                    >
                      <span className="setup__preview" style={{ colorScheme: option.value }}>
                        <span className="setup__preview-bar" />
                        <span className="setup__preview-body" />
                      </span>
                      {option.label}
                    </button>
                  ))}
                </div>
                {error ? (
                  <p className="setup__error" role="alert">
                    {error}
                  </p>
                ) : null}
              </>
            ) : null}

            <div className="setup__actions">
              {stepIndex > 0 ? (
                <Button onClick={() => goTo(STEPS[stepIndex - 1] ?? 'welcome')}>Atrás</Button>
              ) : null}
              <Button type="submit" variant="primary" autoFocus={step === 'welcome' || step === 'avatar' || step === 'theme'}>
                {step === 'theme' ? 'Terminar' : 'Continuar'}
              </Button>
            </div>

            <div className="setup__dots" aria-hidden="true">
              {STEPS.map((item, index) => (
                <span key={item} className={`setup__dot${index === stepIndex ? ' setup__dot--active' : ''}`} />
              ))}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
