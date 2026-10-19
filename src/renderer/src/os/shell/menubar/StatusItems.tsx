import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Volume1,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Popover, Slider, Toggle, useBattery } from '@os/ui'
import { on } from '../../kernel/events'
import { media } from '../../kernel/media'
import { settings } from '../../kernel/settings'
import { useSettingValue } from '../../kernel/settings/hooks'
import { capitalize, formatInTimeZone } from '../common/format-time'
import { useNow } from '../common/useNow'

function MediaIndicators() {
  const [active, setActive] = useState(() => media.active())
  useEffect(() => on('media:active', setActive), [])
  return (
    <>
      {active.camera ? <span className="menubar__dot menubar__dot--camera" role="img" aria-label="Cámara en uso" title="Cámara en uso" /> : null}
      {active.microphone ? (
        <span className="menubar__dot menubar__dot--microphone" role="img" aria-label="Micrófono en uso" title="Micrófono en uso" />
      ) : null}
    </>
  )
}

function VolumeItem() {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const volume = useSettingValue('sound.volume')
  const muted = useSettingValue('sound.muted')
  const Icon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className="menubar__item menubar__item--icon"
        aria-label={muted ? 'Volumen: silenciado' : `Volumen: ${volume} %`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon size={15} />
      </button>
      <Popover anchor={anchor} open={open} align="end" onClose={() => setOpen(false)}>
        <div className="status-panel">
          <div className="status-panel__header">
            <strong>Sonido</strong>
            <Toggle checked={!muted} aria-label="Sonido activado" onChange={(on) => void settings.set('sound.muted', !on)} />
          </div>
          <div className="status-panel__slider">
            <VolumeX size={14} />
            <Slider value={volume} aria-label="Volumen" disabled={muted} onChange={(value) => void settings.set('sound.volume', value)} />
            <Volume2 size={14} />
          </div>
        </div>
      </Popover>
    </>
  )
}

function BatteryItem() {
  const { level, charging } = useBattery()
  const percent = Math.round(level * 100)
  const Icon = charging ? BatteryCharging : percent > 66 ? BatteryFull : percent > 25 ? BatteryMedium : BatteryLow
  return (
    <span className="menubar__item menubar__item--static" title={charging ? 'Conectada a la corriente' : 'Con batería'}>
      <Icon size={17} aria-hidden="true" />
      <span className="menubar__battery-level">{percent} %</span>
    </span>
  )
}

function ClockItem() {
  const now = useNow()
  const timeZone = useSettingValue('datetime.timezone')
  const hour24 = useSettingValue('datetime.hour24')
  const date = capitalize(formatInTimeZone(now, timeZone, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''))
  const time = formatInTimeZone(now, timeZone, { hour: 'numeric', minute: '2-digit', hour12: !hour24 })
  return (
    <span className="menubar__item menubar__item--static menubar__clock">
      {date} {time}
    </span>
  )
}

export function StatusItems() {
  return (
    <div className="menubar__right">
      <MediaIndicators />
      <VolumeItem />
      <BatteryItem />
      <ClockItem />
    </div>
  )
}
