import type { SystemSnapshot } from '@os/sdk'
import { Chart, HISTORY_SECONDS } from './Chart'
import { formatCpu, formatMemory, formatRate, formatSize } from './format'

export function PerformanceTab({ snapshot }: { snapshot: SystemSnapshot }) {
  const { disk } = snapshot
  const memoryPercent = Math.round((snapshot.memoryUsedMB / snapshot.memoryTotalMB) * 100)
  const systemMB = disk.usedMB - disk.filesMB
  const diskPercent = Math.round((disk.usedMB / disk.totalMB) * 100)
  const diskScale = Math.max(100, ...snapshot.history.disk)

  return (
    <div className="task-manager__charts">
      <Chart
        title={`CPU · ${snapshot.cores} ${snapshot.cores === 1 ? 'núcleo' : 'núcleos'}`}
        tone="cpu"
        valueLabel={formatCpu(snapshot.cpu)}
        values={snapshot.history.cpu}
        max={100}
        seconds={HISTORY_SECONDS}
      />
      <Chart
        title="Memoria"
        tone="memory"
        valueLabel={`${formatMemory(snapshot.memoryUsedMB)} de ${formatMemory(snapshot.memoryTotalMB)} (${memoryPercent} %)`}
        values={snapshot.history.memory}
        max={snapshot.memoryTotalMB}
        seconds={HISTORY_SECONDS}
      />
      <Chart
        title="Actividad del disco"
        tone="disk"
        valueLabel={`Lectura ${formatRate(disk.readMBps)} · Escritura ${formatRate(disk.writeMBps)}`}
        values={snapshot.history.disk}
        max={diskScale}
        seconds={HISTORY_SECONDS}
      />
      <div className="task-manager__disk">
        <div className="task-manager__chart-header">
          <span className="task-manager__chart-title">Espacio en disco</span>
          <span className="task-manager__chart-value">
            {formatSize(disk.usedMB)} de {formatSize(disk.totalMB)} ({diskPercent} %)
          </span>
        </div>
        <div
          className="task-manager__bar-track"
          role="img"
          aria-label={`${diskPercent} % del disco usado`}
        >
          <span className="task-manager__bar-fill task-manager__bar-fill--system" style={{ width: `${(systemMB / disk.totalMB) * 100}%` }} />
          <span className="task-manager__bar-fill task-manager__bar-fill--files" style={{ width: `${(disk.filesMB / disk.totalMB) * 100}%` }} />
        </div>
        <div className="task-manager__legend">
          <span>
            <i className="task-manager__swatch task-manager__swatch--system" /> Sistema {formatSize(systemMB)}
          </span>
          <span>
            <i className="task-manager__swatch task-manager__swatch--files" /> Tus archivos {formatSize(disk.filesMB)}
          </span>
          <span>
            <i className="task-manager__swatch" /> Libre {formatSize(disk.totalMB - disk.usedMB)}
          </span>
        </div>
      </div>
    </div>
  )
}
