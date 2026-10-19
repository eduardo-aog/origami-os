import { useStore } from 'zustand'
import { menus, type AppMenu } from '.'

const NONE: readonly AppMenu[] = []

/** Menús que declaró una instancia de app con `useAppMenus`. */
export function useAppMenusOf(instanceId: string | null): readonly AppMenu[] {
  return useStore(menus, (state) => (instanceId === null ? NONE : (state.byInstance[instanceId] ?? NONE)))
}
