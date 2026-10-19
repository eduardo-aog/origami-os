import { useEffect, useState } from 'react'

export interface BatteryStatus {
  /** Nivel entre 0 y 1. */
  level: number
  charging: boolean
}

interface BatteryManagerLike extends EventTarget {
  level: number
  charging: boolean
}

type NavigatorWithBattery = Navigator & { getBattery?: () => Promise<BatteryManagerLike> }

/** Batería real si el sistema la expone; si no, 100 % y conectada. */
export function useBattery(): BatteryStatus {
  const [status, setStatus] = useState<BatteryStatus>({ level: 1, charging: true })

  useEffect(() => {
    const getBattery = (navigator as NavigatorWithBattery).getBattery
    if (typeof getBattery !== 'function') return
    let active = true
    let cleanup = () => {}
    getBattery
      .call(navigator)
      .then((battery) => {
        if (!active) return
        const update = () => setStatus({ level: battery.level, charging: battery.charging })
        update()
        battery.addEventListener('levelchange', update)
        battery.addEventListener('chargingchange', update)
        cleanup = () => {
          battery.removeEventListener('levelchange', update)
          battery.removeEventListener('chargingchange', update)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
      cleanup()
    }
  }, [])

  return status
}
