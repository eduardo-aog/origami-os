import { useState, type KeyboardEvent } from 'react'
import { FolderOpen } from 'lucide-react'
import { Button, TextField } from '@os/ui'
import { MAX_SIDE, validateSize } from './engine'

const PRESETS: { label: string; width: number; height: number }[] = [
  { label: '640 × 480', width: 640, height: 480 },
  { label: '800 × 600', width: 800, height: 600 },
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1920 × 1080', width: 1920, height: 1080 }
]

export interface NewCanvasProps {
  /** Con un dibujo ya abierto el panel se puede cancelar. */
  canCancel: boolean
  onCreate: (width: number, height: number) => void
  onOpen: () => void
  onCancel: () => void
}

/** Panel para elegir el tamaño de un lienzo nuevo (o abrir una imagen). */
export function NewCanvas({ canCancel, onCreate, onOpen, onCancel }: NewCanvasProps) {
  const [width, setWidth] = useState('800')
  const [height, setHeight] = useState('600')
  const [error, setError] = useState<string | null>(null)

  function create() {
    const w = Number(width)
    const h = Number(height)
    const problem = validateSize(w, h)
    setError(problem)
    if (problem === null) onCreate(w, h)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      create()
    } else if (event.key === 'Escape' && canCancel) {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <div className="paint__panel-scrim">
      <form className="paint__panel" aria-label="Nuevo lienzo" onSubmit={(event) => event.preventDefault()} onKeyDown={onKeyDown}>
        <h2 className="paint__panel-title">Nuevo lienzo</h2>
        <div className="paint__presets" role="group" aria-label="Tamaños predefinidos">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              onClick={() => {
                setWidth(String(preset.width))
                setHeight(String(preset.height))
                setError(null)
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="paint__fields">
          <TextField
            label="Ancho (px)"
            type="number"
            min={1}
            max={MAX_SIDE}
            autoFocus
            value={width}
            onChange={(event) => setWidth(event.target.value)}
          />
          <TextField
            label="Alto (px)"
            type="number"
            min={1}
            max={MAX_SIDE}
            value={height}
            onChange={(event) => setHeight(event.target.value)}
          />
        </div>
        {error !== null ? (
          <p className="paint__panel-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="paint__panel-actions">
          <Button onClick={onOpen}>
            <FolderOpen size={14} />
            Abrir imagen…
          </Button>
          <span className="paint__spacer" />
          {canCancel ? <Button onClick={onCancel}>Cancelar</Button> : null}
          <Button variant="primary" onClick={create}>
            Crear lienzo
          </Button>
        </div>
      </form>
    </div>
  )
}
