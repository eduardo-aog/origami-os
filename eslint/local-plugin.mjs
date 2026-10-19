import path from 'node:path'

/*
 * Regla local `local/layer-boundaries`: hace cumplir la dirección de dependencias
 * de la sección 3.2 de la especificación comparando la carpeta (zona) del archivo
 * que importa con la zona del archivo importado.
 *
 * `no-restricted-imports` no puede hacerlo por sí sola: una app puede importar
 * "../otra-carpeta" sin que el texto revele si sale de su propia carpeta. Aquí las
 * rutas relativas se resuelven antes de compararlas.
 *
 * Los imports de paquetes externos de apps y widgets los controla `no-restricted-imports`
 * en eslint.config.mjs; esta regla no los repite.
 */

const RENDERER_SRC = '/src/renderer/src/'

const ZONE_LABELS = {
  app: 'una app',
  widget: 'un widget',
  kernel: 'os/kernel',
  shell: 'os/shell',
  sdk: '@os/sdk',
  ui: '@os/ui',
  system: 'system (@system)',
  shared: 'src/shared',
  root: 'el arranque del renderer'
}

// Qué zonas puede importar cada zona (aparte de sí misma).
const ALLOWED_TARGETS = {
  app: ['sdk', 'ui'],
  widget: ['sdk', 'ui'],
  kernel: ['system', 'shared'],
  shell: ['kernel', 'ui', 'system'],
  sdk: ['kernel', 'system'],
  ui: ['kernel', 'system'],
  system: [],
  shared: [],
  root: ['kernel', 'shell', 'ui', 'sdk', 'system', 'shared']
}

function toPosix(file) {
  return file.split(path.sep).join('/')
}

function zoneOf(posixFile) {
  const marker = posixFile.indexOf(RENDERER_SRC)
  if (marker === -1) {
    return posixFile.includes('/src/shared/') ? { name: 'shared' } : { name: 'other' }
  }
  const rel = `${posixFile.slice(marker + RENDERER_SRC.length)}/`
  let match = /^apps\/([^/]+)\//.exec(rel)
  if (match) return { name: 'app', id: match[1] }
  match = /^widgets\/([^/]+)\//.exec(rel)
  if (match) return { name: 'widget', id: match[1] }
  if (rel.startsWith('os/kernel/storage/')) return { name: 'kernel', storage: true }
  if (rel.startsWith('os/kernel/')) return { name: 'kernel' }
  if (rel.startsWith('os/shell/')) return { name: 'shell' }
  if (rel.startsWith('os/sdk/')) return { name: 'sdk' }
  if (rel.startsWith('os/ui/')) return { name: 'ui' }
  if (rel.startsWith('system/')) return { name: 'system' }
  return { name: 'root' }
}

const ALIASES = [
  { test: (source) => source === '@os/sdk', zone: { name: 'sdk' } },
  { test: (source) => source === '@os/ui', zone: { name: 'ui' } },
  { test: (source) => source.startsWith('@system/'), zone: { name: 'system' } }
]

const layerBoundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      forbidden:
        'Desde {{from}} no se puede importar {{to}} ("{{source}}"). Revisa la sección 3.2 de ESPECIFICACION.md.',
      ownFolder:
        'Desde {{from}} solo se pueden importar archivos de su propia carpeta ("{{source}}" apunta fuera).',
      dexie: 'Solo os/kernel/storage puede usar Dexie/IndexedDB; el resto usa el servicio de storage.'
    }
  },
  create(context) {
    const filename = toPosix(context.filename)
    const importer = zoneOf(filename)
    if (importer.name === 'other') return {}

    const isPackage = importer.name === 'app' || importer.name === 'widget'
    const rendererRoot = filename.slice(0, filename.indexOf(RENDERER_SRC) + '/src/renderer'.length)

    function describe(zone) {
      const label = ZONE_LABELS[zone.name] ?? zone.name
      return zone.id ? `${label} "${zone.id}"` : label
    }

    function check(node, source) {
      if (typeof source !== 'string') return

      if (source === 'dexie' || source.startsWith('dexie/')) {
        // En apps y widgets los paquetes externos ya los restringe no-restricted-imports.
        if (!isPackage && !importer.storage) context.report({ node, messageId: 'dexie' })
        return
      }

      let target = null
      if (source.startsWith('.')) {
        target = zoneOf(toPosix(path.resolve(path.dirname(filename), source)))
      } else if (source.startsWith('/')) {
        target = zoneOf(toPosix(path.join(rendererRoot, source)))
      } else if (!isPackage) {
        target = ALIASES.find((alias) => alias.test(source))?.zone ?? null
      }
      if (target === null || target.name === 'other') return

      const sameZone =
        target.name === importer.name && (importer.id === undefined || target.id === importer.id)
      if (sameZone || ALLOWED_TARGETS[importer.name]?.includes(target.name)) return

      const entersAnotherPackage = isPackage && (target.name === 'app' || target.name === 'widget')
      context.report({
        node,
        messageId: entersAnotherPackage ? 'ownFolder' : 'forbidden',
        data: { from: describe(importer), to: describe(target), source }
      })
    }

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => node.source.type === 'Literal' && check(node, node.source.value)
    }
  }
}

export default { rules: { 'layer-boundaries': layerBoundaries } }
