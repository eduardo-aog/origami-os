import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const rendererSrc = resolve(__dirname, 'src/renderer/src')

const PYODIDE_DIR = resolve(__dirname, 'node_modules/pyodide')
const PYODIDE_FILES: Record<string, string> = {
  'pyodide.mjs': 'text/javascript',
  'pyodide.asm.mjs': 'text/javascript',
  'pyodide.asm.wasm': 'application/wasm',
  'python_stdlib.zip': 'application/zip',
  'pyodide-lock.json': 'application/json'
}

/**
 * Pyodide busca sus archivos por nombre dentro de una carpeta, así que no pueden pasar por el
 * empaquetado con hashes: se sirven tal cual en `/pyodide/` (desarrollo) y se copian a `pyodide/` (build).
 */
function pyodideAssets(): Plugin {
  return {
    name: 'simos-pyodide-assets',
    configureServer(server) {
      server.middlewares.use('/pyodide', (request, response, next) => {
        const name = (request.url ?? '').split('?')[0]?.replace(/^\//, '') ?? ''
        const type = PYODIDE_FILES[name]
        if (type === undefined) return next()
        response.setHeader('Content-Type', type)
        response.end(readFileSync(join(PYODIDE_DIR, name)))
      })
    },
    generateBundle() {
      for (const name of Object.keys(PYODIDE_FILES)) {
        this.emitFile({ type: 'asset', fileName: `pyodide/${name}`, source: readFileSync(join(PYODIDE_DIR, name)) })
      }
    }
  }
}

export default defineConfig({
  main: {},
  preload: {
    build: {
      // El preload corre con sandbox: solo admite CommonJS.
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } }
    }
  },
  renderer: {
    resolve: {
      alias: [
        { find: /^@os\/sdk$/, replacement: resolve(rendererSrc, 'os/sdk/index.ts') },
        { find: /^@os\/ui$/, replacement: resolve(rendererSrc, 'os/ui/index.ts') },
        { find: /^@system\//, replacement: `${resolve(rendererSrc, 'system')}/` }
      ]
    },
    plugins: [react(), pyodideAssets()],
    // El worker de Python carga Pyodide con un `import()` dinámico: necesita módulos ES.
    worker: { format: 'es' },
    build: {
      // La CSP no permite `data:` en font-src: ningún recurso debe quedar incrustado.
      assetsInlineLimit: 0
    }
  }
})
