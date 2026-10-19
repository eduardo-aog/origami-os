export type LaunchArgs = { filePath?: string; [key: string]: unknown }

/** Identifica a la app (y a la instancia concreta) que llama a un servicio del kernel. */
export interface AppContext {
  appId: string
  instanceId: string
}
