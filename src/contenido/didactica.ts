import type { Paso } from './esquema'

export type IdeaFormacion = Extract<Paso, { tipo: 'idea' }> & { explicacionPrevia?: string }
export type PasoFormacion = Exclude<Paso, { tipo: 'idea' }> | IdeaFormacion

/**
 * Orden en que se muestran los pasos de una lección.
 * - Formato v2: tal como están escritos. La lección ya separa adivinar (antes de explicar) y comprobar (después).
 * - Formato v1 (unidades sin migrar): se adelanta la revelación para enseñar antes de comprobar. Tiene el defecto
 *   de dar la respuesta antes de la pregunta; desaparece al migrar cada unidad (docs/PLAN-DIDACTICO.md).
 */
export function pasosDeFormacion(originales: Paso[], formato: 1 | 2 = 1): PasoFormacion[] {
  if (formato === 2) return [...originales]
  const pasos: PasoFormacion[] = []
  for (let i = 0; i < originales.length; i++) {
    const paso = originales[i]
    if (paso.tipo !== 'prediccion') {
      pasos.push(paso)
      continue
    }
    const siguiente = originales[i + 1]
    if (siguiente?.tipo === 'idea') {
      // La idea puede ser un consejo de examen: también enseñar la definición
      // que antes solo se mostraba al corregir, sin inventar texto ni duplicar pasos.
      pasos.push({ ...siguiente, explicacionPrevia: paso.revelacion })
      i++
    } else if (pasos.at(-1)?.tipo === 'idea') {
      pasos[pasos.length - 1] = { ...(pasos.at(-1) as IdeaFormacion), explicacionPrevia: paso.revelacion }
    } else {
      // Algunas lecciones solo tenían la explicación al corregir. Presentarla antes,
      // con el contexto del ejemplo, evita exigir un término todavía desconocido.
      pasos.push({ tipo: 'idea', texto: `${paso.pregunta} ${paso.revelacion}`, visual: paso.visual })
    }
    pasos.push(paso)
  }
  return pasos
}
