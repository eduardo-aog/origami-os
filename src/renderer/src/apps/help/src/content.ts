import type { AppManifest } from '@os/sdk'
import gettingStarted from '../meta/getting-started.md?raw'
import { blocksText, parseMarkdown, type Block } from './markdown'

export interface Topic {
  id: string
  title: string
  description: string
  blocks: Block[]
  /** Texto sin formato, ya normalizado, sobre el que busca el buscador. */
  haystack: string
  /** Texto sin formato para mostrar fragmentos de resultados. */
  plain: string
  app: AppManifest | null
}

export const HOME_ID = 'home'
export const START_ID = 'start'
export const appTopicId = (appId: string) => `app:${appId}`

/** Minúsculas y sin tildes, para que "camara" encuentre "Cámara". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Sustituye `{{os}}` por el nombre del sistema y `{{app:<id>}}` por el nombre de la app,
 * para que renombrarlos en la configuración o en un manifiesto también cambie la ayuda.
 */
export function fillPlaceholders(source: string, osName: string, apps: readonly AppManifest[]): string {
  return source.replace(/\{\{\s*(os|app:[a-z0-9-]+)\s*\}\}/g, (_, key: string) => {
    if (key === 'os') return osName
    const id = key.slice('app:'.length)
    return apps.find((app) => app.id === id)?.name ?? id
  })
}

function makeTopic(id: string, title: string, description: string, source: string, app: AppManifest | null): Topic {
  const blocks = parseMarkdown(source)
  const plain = blocksText(blocks)
  return { id, title, description, blocks, plain, haystack: normalize(`${title} ${description} ${plain}`), app }
}

export interface HelpSource {
  osName: string
  gettingStartedTitle: string
  apps: readonly AppManifest[]
  getHelp(appId: string): string | undefined
}

/** Primeros pasos y una sección por app, generados desde el registro. */
export function buildTopics({ osName, gettingStartedTitle, apps, getHelp }: HelpSource): Topic[] {
  const sorted = [...apps].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return [
    makeTopic(
      START_ID,
      gettingStartedTitle,
      `Lo básico para moverte por ${osName}.`,
      fillPlaceholders(gettingStarted, osName, apps),
      null
    ),
    ...sorted.map((app) =>
      makeTopic(
        appTopicId(app.id),
        app.name,
        app.description,
        fillPlaceholders(getHelp(app.id) ?? '', osName, apps),
        app
      )
    )
  ]
}

export interface SearchResult {
  topic: Topic
  snippet: string
}

function snippetOf(topic: Topic, terms: string[]): string {
  const normalized = normalize(topic.plain)
  const index = terms
    .map((term) => normalized.indexOf(term))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0]
  if (index === undefined) return topic.description
  let start = Math.max(0, index - 50)
  // Empieza en una palabra entera, no a mitad de una.
  if (start > 0) start = topic.plain.indexOf(' ', start) + 1 || start
  const end = Math.min(topic.plain.length, index + 90)
  return `${start > 0 ? '…' : ''}${topic.plain.slice(start, end).trim()}${end < topic.plain.length ? '…' : ''}`
}

/** Todas las palabras de la consulta deben aparecer; las coincidencias en el título van primero. */
export function search(topics: readonly Topic[], query: string): SearchResult[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  return topics
    .filter((topic) => terms.every((term) => topic.haystack.includes(term)))
    .map((topic) => ({
      topic,
      snippet: snippetOf(topic, terms),
      rank: terms.every((term) => normalize(topic.title).includes(term)) ? 0 : 1
    }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ topic, snippet }) => ({ topic, snippet }))
}
