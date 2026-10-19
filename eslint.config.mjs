import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import local from './eslint/local-plugin.mjs'

const RENDERER = 'src/renderer/src'

const PACKAGE_IMPORT_MESSAGE =
  'Las apps y los widgets solo pueden importar @os/sdk, @os/ui, react y las dependencias permitidas ' +
  '(react-dom, lucide-react, zustand), además de su propia carpeta. Revisa la sección 3.2 de ESPECIFICACION.md.'

export default defineConfig([
  globalIgnores(['out/**', 'dist/**', 'node_modules/**']),

  {
    files: ['**/*.{ts,tsx,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } }
  },

  {
    files: [`${RENDERER}/**/*.{ts,tsx}`],
    extends: [reactHooks.configs.flat.recommended],
    plugins: { local },
    rules: { 'local/layer-boundaries': 'error' }
  },

  // Sección 3.2, regla 4: solo os/kernel usa window.native.
  {
    files: [`${RENDERER}/**/*.{ts,tsx}`],
    ignores: [`${RENDERER}/os/kernel/**`],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ":matches(MemberExpression[object.name='window'], MemberExpression[object.name='globalThis'], MemberExpression[object.name='self'])[property.name='native']",
          message: 'Solo os/kernel puede usar window.native. Usa los servicios del kernel (o @os/sdk en apps).'
        }
      ]
    }
  },

  // Sección 3.3: apps y widgets no pueden importar nada fuera de la lista permitida.
  // Los imports relativos que salen de su carpeta los detecta local/layer-boundaries.
  {
    files: [`${RENDERER}/apps/**/*.{ts,tsx}`, `${RENDERER}/widgets/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!(?:react|react-dom|lucide-react|zustand)(?:/|$)|@os/(?:sdk|ui)$|\\.{1,2}(?:/|$)|/)',
              message: PACKAGE_IMPORT_MESSAGE
            }
          ]
        }
      ]
    }
  }
])
