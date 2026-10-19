import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, EmptyState, IconButton, Popover, TextField } from '@os/ui'
import { useSetting } from '@os/sdk'
import { formatInZone, offsetMinutes, useNow } from './time'
import { usePersisted } from './usePersisted'

const FALLBACK_ZONES = [
  'America/Caracas',
  'America/Bogota',
  'America/Mexico_City',
  'America/New_York',
  'America/Los_Angeles',
  'America/Argentina/Buenos_Aires',
  'Europe/Madrid',
  'Europe/London',
  'Asia/Tokyo',
  'Australia/Sydney'
]

const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : FALLBACK_ZONES

const cityName = (zone: string) => (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
const regionName = (zone: string) => zone.split('/').slice(0, -1).join(' · ').replace(/_/g, ' ')
const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function describeOffset(now: number, zone: string, home: string): string {
  const difference = offsetMinutes(now, zone) - offsetMinutes(now, home)
  const day = formatInZone(now, zone, { dateStyle: 'short' }) === formatInZone(now, home, { dateStyle: 'short' })
    ? 'Hoy'
    : difference > 0
      ? 'Mañana'
      : 'Ayer'
  if (difference === 0) return `${day} · Mismo horario`
  const sign = difference > 0 ? '+' : '−'
  const hours = Math.floor(Math.abs(difference) / 60)
  const minutes = Math.abs(difference) % 60
  return `${day} · ${sign}${hours}${minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''} h`
}

export function WorldClock() {
  const timeZone = useSetting('datetime.timezone')
  const hour24 = useSetting('datetime.hour24')
  const now = useNow(1000)
  const cities = usePersisted<string[]>('cities', [])
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const needle = plain(query.trim().replace(/\s+/g, '_'))
    return zones
      .filter((zone) => !cities.value.includes(zone) && (needle === '' || plain(zone).includes(needle)))
      .slice(0, 40)
  }, [cities.value, query])

  const time = (zone: string) => formatInZone(now, zone, { hour: 'numeric', minute: '2-digit', hour12: !hour24 })

  function close() {
    setAnchor(null)
    setQuery('')
  }

  return (
    <div className="clock__world">
      <section className="clock__local">
        <span className="clock__local-label">{cityName(timeZone)}</span>
        <span className="clock__local-time">
          {formatInZone(now, timeZone, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: !hour24 })}
        </span>
        <span className="clock__local-date">{formatInZone(now, timeZone, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </section>

      <div className="clock__section-header">
        <h2 className="clock__section-title">Ciudades</h2>
        <Button onClick={(event) => setAnchor(event.currentTarget)}>
          <Plus size={14} /> Añadir ciudad
        </Button>
      </div>

      {cities.value.length === 0 ? (
        <EmptyState title="Sin ciudades" description="Añade ciudades para comparar su hora con la tuya." />
      ) : (
        <ul className="clock__cities">
          {cities.value.map((zone) => (
            <li key={zone} className="clock__city">
              <div className="clock__city-text">
                <span className="clock__city-name">{cityName(zone)}</span>
                <span className="clock__city-offset">{describeOffset(now, zone, timeZone)}</span>
              </div>
              <span className="clock__city-time">{time(zone)}</span>
              <IconButton label={`Quitar ${cityName(zone)}`} onClick={() => void cities.save(cities.value.filter((candidate) => candidate !== zone))}>
                <X size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <Popover anchor={anchor} open={anchor !== null} onClose={close} align="end" className="clock__picker">
        <TextField
          aria-label="Buscar ciudad"
          placeholder="Buscar ciudad o zona horaria"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {results.length === 0 ? (
          <p className="clock__picker-empty">Sin resultados</p>
        ) : (
          <ul className="clock__picker-list">
            {results.map((zone) => (
              <li key={zone}>
                <button
                  type="button"
                  className="clock__picker-item"
                  onClick={() => {
                    void cities.save([...cities.value, zone])
                    close()
                  }}
                >
                  <span>{cityName(zone)}</span>
                  <span className="clock__picker-region">{regionName(zone)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </div>
  )
}
