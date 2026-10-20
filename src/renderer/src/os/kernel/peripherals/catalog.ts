export type PeripheralKind =
  | 'keyboard'
  | 'mouse'
  | 'headphones'
  | 'speaker'
  | 'microphone'
  | 'webcam'
  | 'storage'
  | 'printer'
  | 'gamepad'
  | 'monitor'

export type PeripheralConnection = 'usb' | 'bluetooth' | 'jack' | 'hdmi'

export interface PeripheralModel {
  id: string
  kind: PeripheralKind
  name: string
  connection: PeripheralConnection
  /** Solo en dispositivos de almacenamiento, en MB. */
  capacityMB?: number
  /** Los dispositivos inalámbricos con batería la reportan. */
  hasBattery: boolean
}

/** Dispositivos ficticios que se pueden "enchufar" desde el Administrador de tareas. */
export const PERIPHERAL_CATALOG: readonly PeripheralModel[] = [
  { id: 'keyboard-usb', kind: 'keyboard', name: 'Teclado USB', connection: 'usb', hasBattery: false },
  { id: 'keyboard-bt', kind: 'keyboard', name: 'Teclado Bluetooth', connection: 'bluetooth', hasBattery: true },
  { id: 'mouse-usb', kind: 'mouse', name: 'Mouse USB', connection: 'usb', hasBattery: false },
  { id: 'mouse-bt', kind: 'mouse', name: 'Mouse inalámbrico', connection: 'bluetooth', hasBattery: true },
  { id: 'headphones-bt', kind: 'headphones', name: 'Audífonos Bluetooth', connection: 'bluetooth', hasBattery: true },
  { id: 'headphones-jack', kind: 'headphones', name: 'Audífonos con cable', connection: 'jack', hasBattery: false },
  { id: 'speaker-bt', kind: 'speaker', name: 'Altavoz Bluetooth', connection: 'bluetooth', hasBattery: true },
  { id: 'microphone-usb', kind: 'microphone', name: 'Micrófono USB', connection: 'usb', hasBattery: false },
  { id: 'webcam-usb', kind: 'webcam', name: 'Cámara web HD', connection: 'usb', hasBattery: false },
  { id: 'flash-drive', kind: 'storage', name: 'Memoria USB 64 GB', connection: 'usb', capacityMB: 65536, hasBattery: false },
  { id: 'external-disk', kind: 'storage', name: 'Disco externo 1 TB', connection: 'usb', capacityMB: 1048576, hasBattery: false },
  { id: 'printer-usb', kind: 'printer', name: 'Impresora USB', connection: 'usb', hasBattery: false },
  { id: 'gamepad-bt', kind: 'gamepad', name: 'Control de juego', connection: 'bluetooth', hasBattery: true },
  { id: 'monitor-hdmi', kind: 'monitor', name: 'Monitor externo', connection: 'hdmi', hasBattery: false }
]

export const KIND_LABELS: Record<PeripheralKind, string> = {
  keyboard: 'Teclado',
  mouse: 'Mouse',
  headphones: 'Audífonos',
  speaker: 'Altavoz',
  microphone: 'Micrófono',
  webcam: 'Cámara',
  storage: 'Almacenamiento',
  printer: 'Impresora',
  gamepad: 'Control de juego',
  monitor: 'Pantalla'
}
