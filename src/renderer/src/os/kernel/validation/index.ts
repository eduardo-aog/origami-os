import { z } from 'zod'

// Los mensajes de validación se muestran en español en toda la aplicación.
z.config(z.locales.es())

/** Convierte los problemas de Zod en líneas legibles: `window.width: <mensaje>`. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })
}
