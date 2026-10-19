import { useSettingValue } from '../../kernel/settings/hooks'
import { useViewport } from '../common/useViewport'
import { WidgetFrame } from './WidgetFrame'
import './WidgetsHost.css'

/** Capa de widgets: entre el fondo de pantalla y los íconos del escritorio. */
export function WidgetsHost() {
  const entries = useSettingValue('desktop.widgets')
  const viewport = useViewport()
  return (
    <div className="widgets-host">
      {entries.map((entry) => (
        <WidgetFrame key={entry.id} entry={entry} viewport={viewport} />
      ))}
    </div>
  )
}
