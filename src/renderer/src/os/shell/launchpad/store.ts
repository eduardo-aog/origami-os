import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

const store = createStore<{ open: boolean }>(() => ({ open: false }))

export const launchpad = {
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,
  open: () => store.setState({ open: true }),
  close: () => store.setState({ open: false }),
  toggle: () => store.setState((state) => ({ open: !state.open }))
}

export function useLaunchpadOpen(): boolean {
  return useStore(launchpad, (state) => state.open)
}
