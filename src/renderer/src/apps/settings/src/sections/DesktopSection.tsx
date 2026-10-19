import { useState } from 'react'
import { Button, Slider } from '@os/ui'
import { useOS } from '@os/sdk'
import { Group, Message, Row } from '../Layout'
import { useWritable } from '../useWritable'

export function DesktopSection() {
  const os = useOS()
  const [iconSize, setIconSize] = useWritable('dock.iconSize')
  const [gap, setGap] = useWritable('dock.gap')
  const [done, setDone] = useState<string | null>(null)

  async function resetIcons() {
    const confirmed = await os.dialogs.confirm({
      title: '¿Restablecer el orden de los íconos?',
      message: 'Se quitarán los accesos a apps del escritorio y los archivos volverán a su orden de origen.',
      confirmLabel: 'Restablecer'
    })
    if (!confirmed) return
    await os.settings.set('desktop.items', os.settings.getDefault('desktop.items'))
    setDone('Se restableció el orden de los íconos del escritorio.')
  }

  async function resetPinned() {
    await os.settings.set('dock.pinned', os.settings.getDefault('dock.pinned'))
    setDone('Se restablecieron las apps ancladas al Dock.')
  }

  return (
    <>
      <Group title="Dock">
        <Row label="Tamaño de los íconos">
          <div className="settings__row-control--wide" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Slider aria-label="Tamaño de los íconos del Dock" min={32} max={128} value={iconSize} onChange={setIconSize} />
            <span className="settings__value">{iconSize}</span>
          </div>
        </Row>
        <Row label="Espaciado entre íconos">
          <div className="settings__row-control--wide" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Slider aria-label="Espaciado entre los íconos del Dock" min={0} max={24} value={gap} onChange={setGap} />
            <span className="settings__value">{gap}</span>
          </div>
        </Row>
        <Row label="Apps ancladas" description="Vuelve a las apps ancladas de fábrica.">
          <Button onClick={() => void resetPinned()}>Restablecer apps ancladas</Button>
        </Row>
      </Group>
      <Group title="Escritorio">
        <Row label="Orden de los íconos" description="Quita los accesos a apps y reordena los archivos.">
          <Button onClick={() => void resetIcons()}>Restablecer orden de íconos</Button>
        </Row>
      </Group>
      {done ? <Message tone="success">{done}</Message> : null}
    </>
  )
}
