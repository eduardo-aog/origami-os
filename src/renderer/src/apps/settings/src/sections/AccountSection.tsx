import { ImagePlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Avatar, Button, TextField } from '@os/ui'
import { useAccount, useAppearance, useOS, type Avatar as AvatarSpec } from '@os/sdk'
import { Group, Message } from '../Layout'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

function sameAvatar(a: AvatarSpec | undefined, b: AvatarSpec): boolean {
  if (!a || a.type !== b.type) return false
  return a.type === 'builtin' ? a.id === (b as typeof a).id : a.nodeId === (b as typeof a).nodeId
}

export function AccountSection() {
  const os = useOS()
  const account = useAccount()
  const { avatars } = useAppearance()
  const user = account.user

  const [name, setName] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordDone, setPasswordDone] = useState(false)

  const shownName = name ?? user?.name ?? ''
  const nameChanged = shownName.trim() !== '' && shownName.trim() !== user?.name

  async function saveName(event: FormEvent) {
    event.preventDefault()
    if (!nameChanged) return
    try {
      await account.rename(shownName)
      setName(null)
      setNameError(null)
    } catch (error) {
      setNameError(describe(error))
    }
  }

  async function chooseAvatar(avatar: AvatarSpec) {
    try {
      await account.setAvatar(avatar)
      setAvatarError(null)
    } catch (error) {
      setAvatarError(describe(error))
    }
  }

  async function chooseImage() {
    const chosen = await os.dialogs.openFile({ extensions: IMAGE_EXTENSIONS })
    const path = chosen?.[0]
    if (path === undefined) return
    try {
      await chooseAvatar({ type: 'file', nodeId: (await os.fs.stat(path)).id })
    } catch (error) {
      setAvatarError(describe(error))
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    setPasswordDone(false)
    if (next !== confirm) {
      setPasswordError('La contraseña nueva y su confirmación no coinciden.')
      return
    }
    try {
      await account.changePassword(current, next)
      setPasswordError(null)
      setPasswordDone(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (error) {
      setPasswordError(describe(error))
    }
  }

  return (
    <>
      <div className="settings__profile">
        <Avatar avatar={user?.avatar ?? null} size={72} />
        <span className="settings__profile-name">{user?.name}</span>
      </div>

      <Group title="Nombre">
        <form className="settings__form" onSubmit={(event) => void saveName(event)}>
          <TextField
            aria-label="Nombre de la cuenta"
            value={shownName}
            error={nameError}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value)
              setNameError(null)
            }}
          />
          <p className="settings__message">También cambia el nombre de tu carpeta de inicio.</p>
          <div className="settings__form-actions">
            <Button type="submit" variant="primary" disabled={!nameChanged}>
              Guardar nombre
            </Button>
          </div>
        </form>
      </Group>

      <Group title="Avatar">
        <div className="settings__avatars">
          {avatars.map((item) => (
            <button
              key={item.id}
              type="button"
              className="settings__avatar"
              title={item.id}
              aria-label={item.id}
              aria-pressed={sameAvatar(user?.avatar, { type: 'builtin', id: item.id })}
              onClick={() => void chooseAvatar({ type: 'builtin', id: item.id })}
            >
              <Avatar avatar={{ type: 'builtin', id: item.id }} size={48} />
            </button>
          ))}
        </div>
        <div className="settings__actions">
          <Button onClick={() => void chooseImage()}>
            <ImagePlus size={14} />
            Elegir imagen…
          </Button>
          {avatarError ? <Message tone="error">{avatarError}</Message> : null}
        </div>
      </Group>

      <Group title="Contraseña">
        <form className="settings__form" onSubmit={(event) => void changePassword(event)}>
          <TextField
            type="password"
            label="Contraseña actual"
            value={current}
            autoComplete="current-password"
            onChange={(event) => setCurrent(event.target.value)}
          />
          <TextField
            type="password"
            label="Contraseña nueva"
            value={next}
            autoComplete="new-password"
            onChange={(event) => setNext(event.target.value)}
          />
          <TextField
            type="password"
            label="Confirmar contraseña nueva"
            value={confirm}
            autoComplete="new-password"
            error={passwordError}
            onChange={(event) => {
              setConfirm(event.target.value)
              setPasswordError(null)
            }}
          />
          <div className="settings__form-actions">
            <Button type="submit" variant="primary" disabled={current === '' || next === '' || confirm === ''}>
              Cambiar contraseña
            </Button>
            {passwordDone ? <Message tone="success">Contraseña actualizada.</Message> : null}
          </div>
        </form>
      </Group>
    </>
  )
}
