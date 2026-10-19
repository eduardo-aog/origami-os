import './Slider.css'

export interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  'aria-label'?: string
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, disabled, 'aria-label': ariaLabel }: SliderProps) {
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      className="os-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{ '--os-slider-fill': `${fill}%` } as React.CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  )
}
