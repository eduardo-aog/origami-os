import { createContext } from 'react'

/** Lo que el marco de ventana le dice a la app que está dentro de él. Lo lee `@os/sdk`. */
export interface AppInstanceInfo {
  appId: string
  instanceId: string
  windowId: string
}

export const AppInstanceContext = createContext<AppInstanceInfo | null>(null)

/** Lo mismo para un widget del escritorio. */
export interface WidgetInstanceInfo {
  widgetId: string
  /** App cuyo `appData` lee y escribe el widget; `null` si usa el suyo propio. */
  ownerApp: string | null
  size: 'small' | 'medium' | 'large'
}

export const WidgetInstanceContext = createContext<WidgetInstanceInfo | null>(null)
