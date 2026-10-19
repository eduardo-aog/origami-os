import { useMemo, useState } from 'react'
import { AppIcon, Button, EmptyState, List, ListItem, Sidebar, TextField, type SidebarItem } from '@os/ui'
import { useLaunchArgs, useOS, type AppCategory } from '@os/sdk'
import { Search } from 'lucide-react'
import { Markdown } from './Markdown'
import { HOME_ID, START_ID, appTopicId, buildTopics, search, type Topic } from './content'
import './help.css'

const CATEGORY_LABELS: Record<AppCategory, string> = {
  sistema: 'Sistema',
  productividad: 'Productividad',
  multimedia: 'Multimedia',
  utilidades: 'Utilidades'
}

const GETTING_STARTED_TITLE = 'Primeros pasos'

function requestedTopic(topics: readonly Topic[], value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value === START_ID || value === HOME_ID ? value : appTopicId(value)
  return id === HOME_ID || topics.some((topic) => topic.id === id) ? id : null
}

export default function App() {
  const os = useOS()
  const args = useLaunchArgs()
  const { list: listApps, getHelp, getIconUrl, getCoverUrl } = os.apps

  const topics = useMemo(
    () =>
      buildTopics({
        osName: os.system.name,
        gettingStartedTitle: GETTING_STARTED_TITLE,
        apps: listApps(),
        getHelp
      }),
    [os.system.name, listApps, getHelp]
  )

  const [topicId, setTopicId] = useState(() => requestedTopic(topics, args.topic) ?? HOME_ID)
  const [seenArgs, setSeenArgs] = useState(args)
  const [query, setQuery] = useState('')

  // La Ayuda es de instancia única: cada lanzamiento entrega argumentos nuevos a la ventana ya abierta.
  if (seenArgs !== args) {
    setSeenArgs(args)
    const requested = requestedTopic(topics, args.topic)
    if (requested) {
      setTopicId(requested)
      setQuery('')
    }
  }

  const topic = topics.find((candidate) => candidate.id === topicId) ?? null
  const results = useMemo(() => search(topics, query), [topics, query])
  const searching = query.trim() !== ''

  const select = (id: string) => {
    setTopicId(id)
    setQuery('')
  }

  const items: SidebarItem[] = [
    { id: HOME_ID, label: os.app.manifest.name },
    ...topics.map((candidate) => ({
      id: candidate.id,
      label: candidate.title,
      icon: candidate.app ? <AppIcon src={getIconUrl(candidate.app.id) ?? ''} size={18} /> : undefined
    }))
  ]

  return (
    <div className="help">
      <div className="help__side">
        <div className="help__search">
          <Search size={14} aria-hidden="true" />
          <TextField
            className="help__search-input"
            type="search"
            aria-label="Buscar en la ayuda"
            placeholder="Buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </div>
        <div className="help__nav">
          <Sidebar aria-label="Temas de ayuda" items={items} selected={searching ? '' : topicId} onSelect={select} />
        </div>
      </div>

      <main className="help__main">
        {searching ? (
          results.length === 0 ? (
            <EmptyState title="Sin resultados" description={`No hay temas que mencionen “${query.trim()}”.`} />
          ) : (
            <div className="help__page">
              <h1 className="help__title">Resultados</h1>
              <div className="help__results">
                <List aria-label="Resultados de la búsqueda">
                  {results.map(({ topic: result, snippet }) => (
                    <ListItem
                      key={result.id}
                      title={result.title}
                      subtitle={snippet}
                      leading={result.app ? <AppIcon src={getIconUrl(result.app.id) ?? ''} size={32} /> : undefined}
                      onClick={() => select(result.id)}
                    />
                  ))}
                </List>
              </div>
            </div>
          )
        ) : topic === null ? (
          <div className="help__page">
            <header className="help__hero">
              <AppIcon src={getIconUrl(os.app.id) ?? ''} size={72} />
              <h1 className="help__title">{`${os.app.manifest.name} de ${os.system.name}`}</h1>
              <p className="help__lead">{os.app.manifest.description}</p>
            </header>
            <Button variant="primary" onClick={() => select(START_ID)}>
              {GETTING_STARTED_TITLE}
            </Button>
            <h2 className="help__section">Aplicaciones</h2>
            <div className="help__grid">
              {topics
                .filter((candidate) => candidate.app)
                .map((candidate) => (
                  <button key={candidate.id} type="button" className="help__card" onClick={() => select(candidate.id)}>
                    <AppIcon src={getIconUrl(candidate.app?.id ?? '') ?? ''} size={40} />
                    <span className="help__card-name">{candidate.title}</span>
                    <span className="help__card-description">{candidate.description}</span>
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <TopicPage
            topic={topic}
            coverUrl={topic.app ? getCoverUrl(topic.app.id) : undefined}
            iconUrl={topic.app ? getIconUrl(topic.app.id) : undefined}
            onOpenApp={() => topic.app && os.apps.launch(topic.app.id)}
          />
        )}
      </main>
    </div>
  )
}

function TopicPage({
  topic,
  coverUrl,
  iconUrl,
  onOpenApp
}: {
  topic: Topic
  coverUrl: string | undefined
  iconUrl: string | undefined
  onOpenApp: () => void
}) {
  const { app } = topic
  const extensions = app ? [...new Set(app.fileAssociations.flatMap((association) => association.extensions))] : []
  return (
    <article className="help__page" key={topic.id}>
      {coverUrl ? <img className="help__cover" src={coverUrl} alt="" draggable={false} /> : null}
      <header className="help__header">
        {iconUrl ? <AppIcon src={iconUrl} size={56} /> : null}
        <div className="help__header-text">
          <h1 className="help__title">{topic.title}</h1>
          <p className="help__lead">{topic.description}</p>
          {app ? (
            <p className="help__meta">
              {CATEGORY_LABELS[app.category]} · Versión {app.version}
            </p>
          ) : null}
        </div>
        {app ? (
          <Button variant="primary" onClick={onOpenApp}>
            {`Abrir ${app.name}`}
          </Button>
        ) : null}
      </header>
      {topic.blocks.length > 0 ? (
        <Markdown blocks={topic.blocks} />
      ) : (
        <p className="help__empty">Esta aplicación todavía no tiene una guía.</p>
      )}
      {extensions.length > 0 ? (
        <p className="help__meta">Abre archivos: {extensions.map((extension) => `.${extension}`).join(', ')}</p>
      ) : null}
    </article>
  )
}
