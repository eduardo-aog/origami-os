// API pública para apps y widgets (sección 4.8 de la especificación).
export { useOS, useWidgetOS } from './use-os'
export type { OSApi, WidgetOSApi } from './use-os'
export {
  useAccount,
  useAppMenus,
  useFsWatch,
  useLaunchArgs,
  useOpenFileHandler,
  usePeripherals,
  useProcesses,
  useSetting,
  useSystemVolume,
  useUnsavedChanges
} from './hooks'
export type { AccountApi, PeripheralsApi, ProcessesApi } from './hooks'
export { useAppearance } from './appearance'
export type { AppearanceApi } from './appearance'

export type {
  AppCategory,
  AppManifest,
  AppPermission,
  LaunchArgs,
  WidgetManifest,
  WidgetSize
} from '../kernel/apps'
export type { AppMenu, AppMenuItem } from '../kernel/menus'
export type { DialogsApi } from '../kernel/dialogs'
export type { EventData, EventName } from '../kernel/events'
export type { FsApi, FsNode } from '../kernel/fs'
export type {
  DeadlockInfo,
  DiskInfo,
  ProcessInfo,
  ProcessKind,
  ProcessState,
  SyncResourceInfo,
  SystemSnapshot,
  TestProfile,
  Transition
} from '../kernel/processes'
export { TEST_LABELS } from '../kernel/processes'
export type {
  ConnectedPeripheral,
  PeripheralConnection,
  PeripheralEvent,
  PeripheralKind,
  PeripheralModel,
  PeripheralsSnapshot
} from '../kernel/peripherals'
export { KIND_LABELS, USB_PORTS } from '../kernel/peripherals'
export type { Avatar } from '../kernel/storage'
export { FsError } from '../kernel/fs'
export type { NewJob as ScheduleJob, ScheduledJob } from '../kernel/scheduler'
export type { PythonIo, PythonJob, PythonResult, PythonRun } from '../kernel/python'
export type { SettingKey, SettingValue } from '../kernel/settings'
export type { SystemSound } from '../kernel/sound'
