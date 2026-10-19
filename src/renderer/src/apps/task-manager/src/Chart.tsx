const WIDTH = 300
const HEIGHT = 100

export interface ChartProps {
  title: string
  /** Texto con el valor actual, a la derecha del título. */
  valueLabel: string
  /** Muestras de la más antigua a la más reciente. */
  values: number[]
  /** Valor que corresponde a la parte alta de la gráfica. */
  max: number
  tone: 'cpu' | 'memory'
  /** Cuántos segundos abarca la gráfica. */
  seconds: number
}

/** Gráfica de línea dibujada en SVG, sin librerías. */
export function Chart({ title, valueLabel, values, max, tone, seconds }: ChartProps) {
  const step = values.length > 1 ? WIDTH / (values.length - 1) : WIDTH
  const points = values.map((value, index) => {
    const y = HEIGHT - (Math.min(Math.max(value, 0), max) / max) * HEIGHT
    return `${(index * step).toFixed(2)},${y.toFixed(2)}`
  })
  const last = values.length > 0 ? (values.length - 1) * step : 0

  return (
    <figure className={`task-manager__chart task-manager__chart--${tone}`} style={{ margin: 0 }}>
      <figcaption className="task-manager__chart-header">
        <span className="task-manager__chart-title">{title}</span>
        <span className="task-manager__chart-value">{valueLabel}</span>
      </figcaption>
      <div className="task-manager__plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${title}: ${valueLabel}`}>
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line
              key={fraction}
              className="task-manager__grid-line"
              x1={0}
              x2={WIDTH}
              y1={HEIGHT * fraction}
              y2={HEIGHT * fraction}
            />
          ))}
          {points.length > 1 ? (
            <>
              <polygon className="task-manager__area" points={`0,${HEIGHT} ${points.join(' ')} ${last.toFixed(2)},${HEIGHT}`} />
              <polyline className="task-manager__line" points={points.join(' ')} />
            </>
          ) : null}
        </svg>
      </div>
      <div className="task-manager__axis" aria-hidden="true">
        <span>hace {seconds} s</span>
        <span>ahora</span>
      </div>
    </figure>
  )
}
