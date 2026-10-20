import {
  Bluetooth,
  Cable,
  Gamepad2,
  Headphones,
  HardDrive,
  Keyboard,
  Monitor,
  Mic,
  Mouse,
  Printer,
  Speaker,
  Usb,
  Webcam,
  type LucideIcon
} from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Button, EmptyState } from '@os/ui'
import {
  KIND_LABELS,
  USB_PORTS,
  useOS,
  usePeripherals,
  type PeripheralConnection,
  type PeripheralKind
} from '@os/sdk'
import { formatSize, useTimeFormatter } from './format'

const KIND_ICONS: Record<PeripheralKind, LucideIcon> = {
  keyboard: Keyboard,
  mouse: Mouse,
  headphones: Headphones,
  speaker: Speaker,
  microphone: Mic,
  webcam: Webcam,
  storage: HardDrive,
  printer: Printer,
  gamepad: Gamepad2,
  monitor: Monitor
}

const CONNECTION_ICONS: Record<PeripheralConnection, LucideIcon> = {
  usb: Usb,
  bluetooth: Bluetooth,
  jack: Cable,
  hdmi: Cable
}

const CONNECTION_LABELS: Record<PeripheralConnection, string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  jack: 'Jack 3,5 mm',
  hdmi: 'HDMI'
}

export function PeripheralsTab() {
  const os = useOS()
  const { catalog, getSnapshot, subscribe, connect, disconnect } = usePeripherals()
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  const formatTime = useTimeFormatter()

  const available = catalog().filter((model) => !snapshot.connected.some((device) => device.id === model.id))

  function tryConnect(modelId: string) {
    try {
      connect(modelId)
    } catch (error) {
      void os.dialogs.alert({
        title: 'No se pudo conectar el dispositivo',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return (
    <div className="task-manager__panel">
      <div className="task-manager__bar">
        <div className="task-manager__summary">
          <span>
            Conectados <strong>{snapshot.connected.length}</strong>
          </span>
          <span>
            Puertos USB{' '}
            <strong>
              {snapshot.usbPortsUsed} de {USB_PORTS} en uso
            </strong>
          </span>
        </div>
      </div>
      <div className="task-manager__scroll task-manager__sections">
        <section className="task-manager__section">
          <h3 className="task-manager__heading">Conectados</h3>
          {snapshot.connected.length === 0 ? (
            <EmptyState
              title="Ningún periférico externo conectado"
              description="Conecta uno de la lista de abajo para simular que lo enchufas."
            />
          ) : (
            <ul className="task-manager__devices">
              {snapshot.connected.map((device) => {
                const Icon = KIND_ICONS[device.kind]
                const ConnectionIcon = CONNECTION_ICONS[device.connection]
                return (
                  <li key={device.id} className="task-manager__device">
                    <span className="task-manager__device-icon">
                      <Icon size={20} />
                    </span>
                    <span className="task-manager__device-text">
                      <strong>{device.name}</strong>
                      <span className="task-manager__muted">
                        {KIND_LABELS[device.kind]}
                        {device.capacityMB ? ` · ${formatSize(device.capacityMB)}` : ''}
                        {device.battery !== null ? ` · Batería ${device.battery} %` : ''}
                      </span>
                    </span>
                    <span className="task-manager__tag">
                      <ConnectionIcon size={12} />
                      {device.port}
                    </span>
                    <span className="task-manager__muted">desde las {formatTime(device.connectedAt)}</span>
                    <Button onClick={() => disconnect(device.id)}>Desconectar</Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="task-manager__section">
          <h3 className="task-manager__heading">Disponibles para conectar</h3>
          {available.length === 0 ? (
            <p className="task-manager__muted">Ya conectaste todos los dispositivos del catálogo.</p>
          ) : (
            <ul className="task-manager__devices">
              {available.map((model) => {
                const Icon = KIND_ICONS[model.kind]
                return (
                  <li key={model.id} className="task-manager__device">
                    <span className="task-manager__device-icon">
                      <Icon size={20} />
                    </span>
                    <span className="task-manager__device-text">
                      <strong>{model.name}</strong>
                      <span className="task-manager__muted">
                        {KIND_LABELS[model.kind]} · {CONNECTION_LABELS[model.connection]}
                      </span>
                    </span>
                    <Button variant="primary" onClick={() => tryConnect(model.id)}>
                      Conectar
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="task-manager__section">
          <h3 className="task-manager__heading">Actividad reciente</h3>
          {snapshot.events.length === 0 ? (
            <p className="task-manager__muted">Aún no se ha conectado ni desconectado nada.</p>
          ) : (
            <ul className="task-manager__events">
              {snapshot.events.map((event) => (
                <li key={event.id} className="task-manager__event">
                  <span className="task-manager__muted">{formatTime(event.at)}</span>
                  <span className={`task-manager__event-type task-manager__event-type--${event.type}`}>
                    {event.type === 'connected' ? 'Conectado' : 'Desconectado'}
                  </span>
                  <span>{event.name}</span>
                  <span className="task-manager__muted">{event.port}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
