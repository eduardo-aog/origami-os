import { createStore } from 'zustand/vanilla'
import { emit } from '../events'
import { notifications } from '../notifications'
import { PERIPHERAL_CATALOG, type PeripheralConnection, type PeripheralModel } from './catalog'

export { KIND_LABELS, PERIPHERAL_CATALOG } from './catalog'
export type { PeripheralConnection, PeripheralKind, PeripheralModel } from './catalog'

export interface ConnectedPeripheral extends PeripheralModel {
  /** Puerto simulado al que está conectado ("USB 2", "Bluetooth", "Jack 3,5 mm", "HDMI"). */
  port: string
  connectedAt: number
  /** Porcentaje, o `null` si el dispositivo no tiene batería. */
  battery: number | null
}

export interface PeripheralEvent {
  id: number
  at: number
  type: 'connected' | 'disconnected'
  name: string
  port: string
}

export interface PeripheralsSnapshot {
  connected: readonly ConnectedPeripheral[]
  /** Del más reciente al más antiguo. */
  events: readonly PeripheralEvent[]
  usbPortsTotal: number
  usbPortsUsed: number
}

export const USB_PORTS = 4
const MAX_EVENTS = 50
const NOTIFICATION_APP = 'task-manager'

const FIXED_PORTS: Record<Exclude<PeripheralConnection, 'usb'>, string> = {
  bluetooth: 'Bluetooth',
  jack: 'Jack 3,5 mm',
  hdmi: 'HDMI'
}

let nextEventId = 1
const store = createStore<{ connected: readonly ConnectedPeripheral[]; events: readonly PeripheralEvent[] }>(() => ({
  connected: [],
  events: []
}))
let snapshot: PeripheralsSnapshot = buildSnapshot()

function buildSnapshot(): PeripheralsSnapshot {
  const { connected, events } = store.getState()
  return {
    connected,
    events,
    usbPortsTotal: USB_PORTS,
    usbPortsUsed: connected.filter((device) => device.connection === 'usb').length
  }
}

store.subscribe(() => {
  snapshot = buildSnapshot()
})

function findFreePort(connection: PeripheralConnection, connected: readonly ConnectedPeripheral[]): string | null {
  const taken = new Set(connected.map((device) => device.port))
  if (connection !== 'usb') {
    const port = FIXED_PORTS[connection]
    // Bluetooth admite varios dispositivos a la vez; el jack y el HDMI tienen una sola toma.
    return connection === 'bluetooth' || !taken.has(port) ? port : null
  }
  for (let number = 1; number <= USB_PORTS; number++) {
    if (!taken.has(`USB ${number}`)) return `USB ${number}`
  }
  return null
}

function record(type: PeripheralEvent['type'], device: ConnectedPeripheral): void {
  const event: PeripheralEvent = { id: nextEventId++, at: Date.now(), type, name: device.name, port: device.port }
  store.setState((state) => ({ events: [event, ...state.events].slice(0, MAX_EVENTS) }))
}

export const peripherals = {
  catalog(): readonly PeripheralModel[] {
    return PERIPHERAL_CATALOG
  },

  /** Estado actual; el objeto cambia solo cuando algo se conecta o se desconecta. */
  getSnapshot(): PeripheralsSnapshot {
    return snapshot
  },

  subscribe(listener: () => void): () => void {
    return store.subscribe(() => listener())
  },

  /** Conecta un dispositivo del catálogo. Lanza un error en español si ya está conectado o no hay puerto libre. */
  connect(modelId: string): ConnectedPeripheral {
    const model = PERIPHERAL_CATALOG.find((entry) => entry.id === modelId)
    if (!model) throw new Error('Ese dispositivo no existe.')
    const { connected } = store.getState()
    if (connected.some((device) => device.id === model.id)) throw new Error(`"${model.name}" ya está conectado.`)
    const port = findFreePort(model.connection, connected)
    if (!port) {
      throw new Error(
        model.connection === 'usb'
          ? 'No hay puertos USB libres. Desconecta otro dispositivo primero.'
          : `La toma "${FIXED_PORTS[model.connection as Exclude<PeripheralConnection, 'usb'>]}" ya está ocupada.`
      )
    }
    const device: ConnectedPeripheral = {
      ...model,
      port,
      connectedAt: Date.now(),
      battery: model.hasBattery ? 40 + Math.floor(Math.random() * 61) : null
    }
    store.setState((state) => ({ connected: [...state.connected, device] }))
    record('connected', device)
    emit('peripheral:connected', { id: device.id, name: device.name, kind: device.kind })
    notifications.post({
      appId: NOTIFICATION_APP,
      title: `${device.name} conectado`,
      body: `Puerto: ${device.port}`,
      launchArgs: { section: 'peripherals' }
    })
    return device
  },

  disconnect(id: string): void {
    const device = store.getState().connected.find((entry) => entry.id === id)
    if (!device) return
    store.setState((state) => ({ connected: state.connected.filter((entry) => entry.id !== id) }))
    record('disconnected', device)
    emit('peripheral:disconnected', { id: device.id, name: device.name, kind: device.kind })
    notifications.post({
      appId: NOTIFICATION_APP,
      title: `${device.name} desconectado`,
      launchArgs: { section: 'peripherals' }
    })
  }
}
