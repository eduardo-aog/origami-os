import { createStore } from 'zustand/vanilla'

export interface AppMenuItem {
  label?: string
  onSelect?: () => void
  /** Texto del atajo (solo se muestra; la app es quien lo atiende). */
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  destructive?: boolean
  separator?: boolean
  submenu?: AppMenuItem[]
}

export interface AppMenu {
  label: string
  items: AppMenuItem[]
}

const store = createStore<{ byInstance: Readonly<Record<string, readonly AppMenu[]>> }>(() => ({ byInstance: {} }))

export const menus = {
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  set(instanceId: string, appMenus: readonly AppMenu[]): void {
    store.setState((state) => ({ byInstance: { ...state.byInstance, [instanceId]: appMenus } }))
  },

  clear(instanceId: string): void {
    store.setState((state) => ({
      byInstance: Object.fromEntries(Object.entries(state.byInstance).filter(([id]) => id !== instanceId))
    }))
  }
}
