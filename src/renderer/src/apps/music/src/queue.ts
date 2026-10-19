export type RepeatMode = 'off' | 'all' | 'one'

export interface PlaybackMode {
  shuffle: boolean
  repeat: RepeatMode
}

/**
 * Posición de la pista que sigue, o `null` si la reproducción debe terminar.
 *
 * `auto` indica que la pista anterior acabó sola; con "siguiente" manual siempre se pasa a otra
 * pista aunque no haya repetición. Con aleatorio se reparten todas las pistas una vez por vuelta
 * (`played` guarda las ya sonadas) y la vuelta se reinicia si hay repetición o si se pidió a mano.
 */
export function nextPosition(
  length: number,
  current: number,
  mode: PlaybackMode,
  auto: boolean,
  played: ReadonlySet<number>,
  random: () => number = Math.random
): number | null {
  if (length === 0) return null
  if (auto && mode.repeat === 'one') return current

  if (mode.shuffle) {
    let pool = indices(length).filter((position) => position !== current && !played.has(position))
    if (pool.length === 0) {
      if (auto && mode.repeat === 'off') return null
      pool = indices(length).filter((position) => position !== current)
      if (pool.length === 0) return auto && mode.repeat === 'off' ? null : current
    }
    return pool[Math.floor(random() * pool.length)] ?? null
  }

  if (current + 1 < length) return current + 1
  return auto && mode.repeat !== 'all' ? null : 0
}

const indices = (length: number) => Array.from({ length }, (_, position) => position)
