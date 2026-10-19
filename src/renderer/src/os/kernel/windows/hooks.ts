import { useStore } from 'zustand'
import { windowsStore, type WindowRecord } from './store'

export function useWindows<T>(selector: (state: { windows: readonly WindowRecord[] }) => T): T {
  return useStore(windowsStore, selector)
}
