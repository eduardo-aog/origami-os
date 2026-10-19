import { Volume2 } from 'lucide-react'
import { Button, Slider, Toggle } from '@os/ui'
import { useOS } from '@os/sdk'
import { Group, Row } from '../Layout'
import { useWritable } from '../useWritable'

export function SoundSection() {
  const os = useOS()
  const [volume, setVolume] = useWritable('sound.volume')
  const [muted, setMuted] = useWritable('sound.muted')
  const [systemSounds, setSystemSounds] = useWritable('sound.systemSounds')

  return (
    <>
      <Group>
        <Row label="Volumen">
          <div className="settings__row-control--wide" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Slider aria-label="Volumen" value={volume} onChange={setVolume} disabled={muted} />
            <span className="settings__value">{muted ? 'Silencio' : `${volume} %`}</span>
          </div>
        </Row>
        <Row label="Silenciar" description="Apaga todo el sonido del sistema.">
          <Toggle aria-label="Silenciar" checked={muted} onChange={setMuted} />
        </Row>
      </Group>
      <Group>
        <Row label="Sonidos del sistema" description="Arranque, notificaciones, papelera… Las alarmas y el obturador suenan siempre.">
          <Toggle aria-label="Sonidos del sistema" checked={systemSounds} onChange={setSystemSounds} />
        </Row>
        <Row label="Probar el sonido" description="Reproduce el sonido de las notificaciones.">
          <Button onClick={() => os.sound.playSystem('notification')}>
            <Volume2 size={14} />
            Reproducir
          </Button>
        </Row>
      </Group>
    </>
  )
}
