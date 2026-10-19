import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { ZodType } from 'zod'
import { formatIssues } from '../validation'
import {
  appManifestSchema,
  widgetManifestSchema,
  type AppManifest,
  type WidgetManifest
} from './manifest.schema'

type PackageKind = 'apps' | 'widgets'
type EntryLoader = () => Promise<{ default: ComponentType }>

export interface AppDefinition {
  manifest: AppManifest
  iconUrl: string
  coverUrl: string | null
  helpText: string | null
  Component: LazyExoticComponent<ComponentType>
}

export interface WidgetDefinition {
  manifest: WidgetManifest
  iconUrl: string
  Component: LazyExoticComponent<ComponentType>
}

/*
 * Descubrimiento automático: agregar una carpeta en apps/ o widgets/ basta para
 * que exista en el sistema. No hay listas escritas a mano en ningún otro lado.
 * Las rutas son relativas a la raíz de Vite (src/renderer).
 */
const appManifests = import.meta.glob<unknown>('/src/apps/*/meta/manifest.json', {
  eager: true,
  import: 'default'
})
const appAssets = import.meta.glob<string>('/src/apps/*/meta/*.{svg,png,jpg,webp}', {
  eager: true,
  import: 'default',
  query: '?url'
})
const appHelp = import.meta.glob<string>('/src/apps/*/meta/help.md', {
  eager: true,
  import: 'default',
  query: '?raw'
})
const appEntries = import.meta.glob<{ default: ComponentType }>('/src/apps/*/src/index.tsx')
// theme.css solo define variables bajo [data-app-id="<id>"], así que cargarlo siempre es inofensivo.
import.meta.glob('/src/apps/*/meta/theme.css', { eager: true })

const widgetManifests = import.meta.glob<unknown>('/src/widgets/*/meta/manifest.json', {
  eager: true,
  import: 'default'
})
const widgetAssets = import.meta.glob<string>('/src/widgets/*/meta/*.{svg,png,jpg,webp}', {
  eager: true,
  import: 'default',
  query: '?url'
})
const widgetEntries = import.meta.glob<{ default: ComponentType }>('/src/widgets/*/src/index.tsx')
import.meta.glob('/src/widgets/*/meta/theme.css', { eager: true })

/** Agrupa las rutas de un glob por carpeta del paquete: carpeta → (archivo → valor). */
function groupByFolder<V>(kind: PackageKind, files: Record<string, V>): Map<string, Map<string, V>> {
  const pattern = new RegExp(`^/src/${kind}/([^/]+)/(?:meta|src)/(.+)$`)
  const folders = new Map<string, Map<string, V>>()
  for (const [path, value] of Object.entries(files)) {
    const match = pattern.exec(path)
    if (!match) continue
    const [, folder, file] = match as unknown as [string, string, string]
    const entries = folders.get(folder) ?? new Map<string, V>()
    entries.set(file, value)
    folders.set(folder, entries)
  }
  return folders
}

interface DiscoveredPackage<TManifest> {
  manifest: TManifest
  iconUrl: string
  coverUrl: string | null
  helpText: string | null
  Component: LazyExoticComponent<ComponentType>
}

interface PackageSources {
  manifests: Record<string, unknown>
  assets: Record<string, string>
  help: Record<string, string>
  entries: Record<string, EntryLoader>
}

function reportSkipped(kind: PackageKind, folder: string, title: string, details: string[] = []): void {
  const lines = details.map((detail) => `\n  • ${detail}`).join('')
  console.error(`[registro] Se omitió "${kind}/${folder}": ${title}${lines}`)
}

function discover<TManifest extends { id: string; icon: string; cover?: string | undefined }>(
  kind: PackageKind,
  schema: ZodType<TManifest>,
  sources: PackageSources
): DiscoveredPackage<TManifest>[] {
  const manifests = groupByFolder(kind, sources.manifests)
  const assets = groupByFolder(kind, sources.assets)
  const help = groupByFolder(kind, sources.help)
  const entries = groupByFolder(kind, sources.entries)

  const folders = new Set([...manifests.keys(), ...assets.keys(), ...help.keys(), ...entries.keys()])
  const found: DiscoveredPackage<TManifest>[] = []

  for (const folder of [...folders].sort()) {
    const raw = manifests.get(folder)?.get('manifest.json')
    if (raw === undefined) {
      reportSkipped(kind, folder, 'falta meta/manifest.json')
      continue
    }

    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      reportSkipped(kind, folder, 'meta/manifest.json es inválido', formatIssues(parsed.error))
      continue
    }
    const manifest = parsed.data

    const problems: string[] = []
    if (manifest.id !== folder) {
      problems.push(`el campo "id" (${manifest.id}) debe coincidir con el nombre de la carpeta (${folder})`)
    }
    const iconUrl = assets.get(folder)?.get(manifest.icon)
    if (iconUrl === undefined) {
      problems.push(`el ícono "${manifest.icon}" no existe en meta/`)
    }
    const loader = entries.get(folder)?.get('index.tsx')
    if (loader === undefined) {
      problems.push(`falta src/index.tsx`)
    }
    if (problems.length > 0 || iconUrl === undefined || loader === undefined) {
      reportSkipped(kind, folder, 'revisa el contenido de su carpeta', problems)
      continue
    }

    let coverUrl: string | null = null
    if (manifest.cover !== undefined) {
      coverUrl = assets.get(folder)?.get(manifest.cover) ?? null
      if (coverUrl === null) {
        console.warn(
          `[registro] "${kind}/${folder}" declara la portada "${manifest.cover}" pero no existe en meta/; se ignora.`
        )
      }
    }

    found.push({
      manifest,
      iconUrl,
      coverUrl,
      helpText: help.get(folder)?.get('help.md') ?? null,
      Component: lazy(loader)
    })
  }

  return found
}

export const apps: readonly AppDefinition[] = discover<AppManifest>('apps', appManifestSchema, {
  manifests: appManifests,
  assets: appAssets,
  help: appHelp,
  entries: appEntries
})

export const widgets: readonly WidgetDefinition[] = discover<WidgetManifest>(
  'widgets',
  widgetManifestSchema,
  { manifests: widgetManifests, assets: widgetAssets, help: {}, entries: widgetEntries }
).map(({ manifest, iconUrl, Component }) => ({ manifest, iconUrl, Component }))

export function getApp(id: string): AppDefinition | undefined {
  return apps.find((app) => app.manifest.id === id)
}

export function getWidget(id: string): WidgetDefinition | undefined {
  return widgets.find((widget) => widget.manifest.id === id)
}
