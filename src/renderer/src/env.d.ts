/// <reference types="vite/client" />

import type { NativeApi } from '../../shared/native-api'

declare global {
  interface Window {
    /** Puente nativo expuesto por el preload. Solo `os/kernel` puede usarlo. */
    native: NativeApi
  }
}
