import { useEffect, useState } from 'react'
import { Select, Toggle } from '@os/ui'
import { useWritable } from '../useWritable'
import { Group, Row } from '../Layout'

function listTimeZones(current: string): string[] {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return zones.includes(current) ? zones : [current, ...zones]
}

export function DateTimeSection() {
  const [timeZone, setTimeZone] = useWritable('datetime.timezone')
  const [hour24, setHour24] = useWritable('datetime.hour24')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const preview = new Intl.DateTimeFormat('es', {
    dateStyle: 'full',
    timeStyle: 'medium',
    hour12: !hour24,
    timeZone
  }).format(now)

  return (
    <>
      <Group>
        <Row label="Hora actual">
          <span className="settings__value">{preview}</span>
        </Row>
      </Group>
      <Group>
        <Row label="Zona horaria" wide>
          <Select
            aria-label="Zona horaria"
            value={timeZone}
            onChange={setTimeZone}
            options={listTimeZones(timeZone).map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))}
          />
        </Row>
        <Row label="Formato de 24 horas" description="Muestra las 15:00 en lugar de las 3:00 p. m.">
          <Toggle aria-label="Formato de 24 horas" checked={hour24} onChange={setHour24} />
        </Row>
      </Group>
    </>
  )
}
