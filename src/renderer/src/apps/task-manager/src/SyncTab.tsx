import { TriangleAlert } from 'lucide-react'
import { Button } from '@os/ui'
import { useProcesses, type SyncResourceInfo, type SystemSnapshot } from '@os/sdk'

function ResourceCard({ resource }: { resource: SyncResourceInfo }) {
  return (
    <article className="task-manager__resource">
      <header className="task-manager__resource-header">
        <h4 className="task-manager__resource-name">{resource.name}</h4>
        <span className="task-manager__tag">
          {resource.kind === 'mutex' ? 'Mutex' : `Semáforo (${resource.capacity})`}
        </span>
      </header>
      <div
        className="task-manager__permits"
        role="img"
        aria-label={`${resource.available} de ${resource.capacity} disponibles`}
      >
        {Array.from({ length: resource.capacity }, (_, index) => (
          <span key={index} className="task-manager__permit" data-taken={index < resource.holders.length} />
        ))}
        <span className="task-manager__muted">
          {resource.available} de {resource.capacity} libres
        </span>
      </div>
      <dl className="task-manager__resource-lists">
        <div>
          <dt>En la sección crítica</dt>
          <dd>
            {resource.holders.length === 0 ? (
              <span className="task-manager__muted">nadie</span>
            ) : (
              resource.holders.map((holder) => (
                <span key={holder.pid} className="task-manager__chip task-manager__chip--holder">
                  {holder.name}
                </span>
              ))
            )}
          </dd>
        </div>
        <div>
          <dt>Cola de espera</dt>
          <dd>
            {resource.queue.length === 0 ? (
              <span className="task-manager__muted">vacía</span>
            ) : (
              resource.queue.map((waiter, index) => (
                <span key={waiter.pid} className="task-manager__chip task-manager__chip--waiter">
                  {index + 1}. {waiter.name}
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>
    </article>
  )
}

export function SyncTab({ snapshot }: { snapshot: SystemSnapshot }) {
  const { startDeadlockLab, stopDeadlockLab, resolveDeadlock } = useProcesses()
  const shared = snapshot.resources.filter((resource) => !resource.lab)
  const lab = snapshot.resources.filter((resource) => resource.lab)

  return (
    <div className="task-manager__panel">
      <div className="task-manager__scroll task-manager__sections">
        <section className="task-manager__section">
          <h3 className="task-manager__heading">Recursos compartidos</h3>
          <p className="task-manager__text task-manager__note">
            Solo un proceso a la vez puede usar un <strong>mutex</strong>; un <strong>semáforo</strong> deja pasar a tantos
            como permisos tenga. Quien no consigue el recurso pasa a <em>En espera</em> y entra en su cola, y cuando alguien lo
            libera el primero de la cola lo recibe y vuelve a la cola de listos.
          </p>
          <div className="task-manager__resources">
            {shared.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </section>

        <section className="task-manager__section">
          <h3 className="task-manager__heading">Laboratorio de interbloqueo</h3>
          <p className="task-manager__text task-manager__note">
            El <em>Hilo A</em> pide el recurso A y después el B; el <em>Hilo B</em> los pide al revés. Si cada uno se queda con
            el primero mientras espera el segundo, ninguno puede avanzar: es un interbloqueo.
          </p>
          <div className="task-manager__controls">
            {snapshot.labActive ? (
              <Button onClick={stopDeadlockLab}>Detener laboratorio</Button>
            ) : (
              <Button variant="primary" onClick={startDeadlockLab}>
                Iniciar laboratorio
              </Button>
            )}
            <Button variant="danger" disabled={snapshot.deadlock === null} onClick={resolveDeadlock}>
              Romper el interbloqueo
            </Button>
          </div>
          {snapshot.deadlock ? (
            <div className="task-manager__alert" role="alert">
              <TriangleAlert size={16} />
              <span>
                Interbloqueo detectado: {snapshot.deadlock.names.join(' y ')} se esperan mutuamente. “Romper el interbloqueo”
                termina a uno para que el otro reciba su recurso.
              </span>
            </div>
          ) : null}
          {snapshot.labActive ? (
            <div className="task-manager__resources">
              {lab.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
