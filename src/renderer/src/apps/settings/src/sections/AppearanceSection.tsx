import { ImagePlus, Moon, Sun, SunMoon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, FsImage, SegmentedControl } from '@os/ui'
import { useAppearance, useOS, type FsNode } from '@os/sdk'
import { Group, Row } from '../Layout'
import { useWritable } from '../useWritable'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
const MAX_USER_IMAGES = 60

/** Imágenes de cualquier carpeta del usuario, para usarlas como fondo; se actualiza al cambiar el sistema de archivos. */
function useUserImages(): FsNode[] {
  const { fs, events } = useOS()
  const [images, setImages] = useState<FsNode[]>([])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function scan() {
      const found: FsNode[] = []
      const pending = ['~']
      for (let folder = pending.shift(); folder !== undefined && found.length < MAX_USER_IMAGES; folder = pending.shift()) {
        let children: FsNode[]
        try {
          children = await fs.list(folder)
        } catch {
          continue
        }
        for (const child of children) {
          if (child.kind === 'folder') pending.push(`${folder}/${child.name}`)
          else if (child.mime.startsWith('image/')) found.push(child)
        }
      }
      if (active) setImages(found)
    }

    void scan()
    const stop = events.on('fs:changed', () => {
      clearTimeout(timer)
      timer = setTimeout(() => void scan(), 300)
    })
    return () => {
      active = false
      clearTimeout(timer)
      stop()
    }
  }, [fs, events])

  return images
}

export function AppearanceSection() {
  const os = useOS()
  const { wallpapers, accentColors } = useAppearance()
  const [theme, setTheme] = useWritable('appearance.theme')
  const [accent, setAccent] = useWritable('appearance.accent')
  const [wallpaper, setWallpaper] = useWritable('appearance.wallpaper')
  const images = useUserImages()

  async function chooseImage() {
    const chosen = await os.dialogs.openFile({ extensions: IMAGE_EXTENSIONS })
    const path = chosen?.[0]
    if (path === undefined) return
    try {
      const node = await os.fs.stat(path)
      setWallpaper({ type: 'file', nodeId: node.id })
    } catch (error) {
      await os.dialogs.alert({ title: 'No se pudo usar la imagen', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <>
      <Group>
        <Row label="Tema">
          <SegmentedControl
            aria-label="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Claro', icon: <Sun size={13} /> },
              { value: 'dark', label: 'Oscuro', icon: <Moon size={13} /> },
              { value: 'auto', label: 'Automático', icon: <SunMoon size={13} /> }
            ]}
          />
        </Row>
        <Row label="Color de acento">
          <div className="settings__swatches" role="group" aria-label="Color de acento">
            {accentColors.map((color) => (
              <button
                key={color.value}
                type="button"
                className="settings__swatch"
                title={color.name}
                aria-label={color.name}
                aria-pressed={accent.toLowerCase() === color.value.toLowerCase()}
                style={{ background: color.value }}
                onClick={() => setAccent(color.value)}
              />
            ))}
          </div>
        </Row>
      </Group>

      <Group title="Fondo de pantalla">
        <div className="settings__thumbs">
          {wallpapers.map((item) => (
            <button
              key={item.id}
              type="button"
              className="settings__thumb"
              aria-pressed={wallpaper.type === 'builtin' && wallpaper.id === item.id}
              onClick={() => setWallpaper({ type: 'builtin', id: item.id })}
            >
              <img className="settings__thumb-image" src={item.url} alt="" draggable={false} />
              <span className="settings__thumb-name">{item.id}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Tus imágenes">
        {images.length > 0 ? (
          <div className="settings__thumbs">
            {images.map((node) => (
              <button
                key={node.id}
                type="button"
                className="settings__thumb"
                aria-pressed={wallpaper.type === 'file' && wallpaper.nodeId === node.id}
                onClick={() => setWallpaper({ type: 'file', nodeId: node.id })}
              >
                <FsImage className="settings__thumb-image" nodeId={node.id} />
                <span className="settings__thumb-name">{node.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="settings__message" style={{ padding: 'var(--space-3)' }}>
            Aún no hay imágenes en tus carpetas.
          </p>
        )}
        <div className="settings__actions">
          <Button onClick={() => void chooseImage()}>
            <ImagePlus size={14} />
            Elegir otra imagen…
          </Button>
        </div>
      </Group>
    </>
  )
}
