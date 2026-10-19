import { Battery, BatteryCharging, HardDrive } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatBytes, useBattery } from '@os/ui'
import { useWidgetOS } from '@os/sdk'
import './system-status.css'

function useUsage(): { bytes: number; files: number } | null {
  const { fs, events } = useWidgetOS()
  const [usage, setUsage] = useState<{ bytes: number; files: number } | null>(null)
  useEffect(() => {
    let active = true
    const refresh = () => {
      fs.usage()
        .then((value) => active && setUsage(value))
        .catch(() => undefined)
    }
    refresh()
    const stop = events.on('fs:changed', refresh)
    return () => {
      active = false
      stop()
    }
  }, [fs, events])
  return usage
}

export default function SystemStatusWidget() {
  const { widget } = useWidgetOS()
  const { level, charging } = useBattery()
  const usage = useUsage()

  const BatteryIcon = charging ? BatteryCharging : Battery
  const rows = [
    { icon: <BatteryIcon size={18} />, label: 'Batería', value: `${Math.round(level * 100)} %`, detail: charging ? 'Conectada' : 'Con batería' },
    {
      icon: <HardDrive size={18} />,
      label: 'Espacio usado',
      value: usage ? formatBytes(usage.bytes) : '—',
      detail: usage ? `${usage.files} ${usage.files === 1 ? 'archivo' : 'archivos'}` : ''
    }
  ]

  return (
    <ul className={`status-widget status-widget--${widget.size}`}>
      {rows.map((row) => (
        <li key={row.label} className="status-widget__row">
          <span className="status-widget__icon">{row.icon}</span>
          <span className="status-widget__text">
            <span className="status-widget__label">{row.label}</span>
            <span className="status-widget__value">{row.value}</span>
            {widget.size !== 'small' && row.detail ? <span className="status-widget__detail">{row.detail}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}
