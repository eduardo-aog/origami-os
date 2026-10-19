/** Normaliza una ruta absoluta: resuelve "." y "..", quita barras repetidas. */
export function normalize(path: string): string {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return `/${parts.join('/')}`
}

/** Convierte lo que se escribió en la terminal en una ruta absoluta. */
export function resolvePath(arg: string, cwd: string, home: string): string {
  if (arg === '~' || arg.startsWith('~/')) return normalize(`${home}${arg.slice(1)}`)
  if (arg.startsWith('/')) return normalize(arg)
  return normalize(`${cwd}/${arg}`)
}

export function parentOf(path: string): string {
  const parts = normalize(path).split('/').filter(Boolean)
  parts.pop()
  return `/${parts.join('/')}`
}

export function baseNameOf(path: string): string {
  return normalize(path).split('/').filter(Boolean).pop() ?? ''
}

export function joinPath(folder: string, name: string): string {
  return normalize(`${folder}/${name}`)
}

/** La ruta como se enseña en el prompt: la carpeta de inicio se abrevia como "~". */
export function shortPath(path: string, home: string): string {
  if (path === home) return '~'
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}
