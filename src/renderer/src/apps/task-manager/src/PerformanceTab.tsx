import { Chart } from './Chart'
import { formatCpu, formatMemory } from './format'
import { HISTORY_SECONDS, type Snapshot } from './useSnapshots'

export function PerformanceTab({ snapshot }: { snapshot: Snapshot }) {
  const { stats } = snapshot
  const memoryPercent = Math.round((stats.memoryUsedMB / stats.memoryTotalMB) * 100)
  return (
    <div className="task-manager__charts">
      <Chart
        title="CPU"
        tone="cpu"
        valueLabel={formatCpu(stats.cpu)}
        values={snapshot.cpuHistory}
        max={100}
        seconds={HISTORY_SECONDS}
      />
      <Chart
        title="Memoria"
        tone="memory"
        valueLabel={`${formatMemory(stats.memoryUsedMB)} de ${formatMemory(stats.memoryTotalMB)} (${memoryPercent} %)`}
        values={snapshot.memoryHistory}
        max={stats.memoryTotalMB}
        seconds={HISTORY_SECONDS}
      />
    </div>
  )
}
