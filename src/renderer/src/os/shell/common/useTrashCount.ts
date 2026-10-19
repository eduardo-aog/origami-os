import { useEffect, useState } from 'react'
import { on } from '../../kernel/events'
import { fs } from '../../kernel/fs'

/** Cuántos elementos hay en la papelera (en vivo). */
export function useTrashCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = () => {
      fs.listTrash()
        .then((items) => active && setCount(items.length))
        .catch(() => undefined)
    }
    refresh()
    const stop = on('fs:changed', refresh)
    return () => {
      active = false
      stop()
    }
  }, [])
  return count
}
