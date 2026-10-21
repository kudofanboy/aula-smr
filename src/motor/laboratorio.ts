import { z } from 'zod'
import type { Tablero } from '../contenido/esquema'
import { causaReal, pilotos, pruebaComunicacion } from './tableros'

export const ID_LABORATORIO = 'redes-dos-plantas'
const equipo = z.enum(['PC1', 'PC2', 'PC3', 'PC4', 'PC5'])
export const EstadoLaboratorioSchema = z.object({
  variante: z.enum(['rama', 'raiz', 'cable']),
  fase: z.enum(['investigar', 'actuar', 'verificar', 'completado']),
  pruebas: z.array(z.object({ a: equipo, b: equipo, ok: z.boolean(), despues: z.boolean() }).refine((p) => p.a !== p.b)).max(12),
  pilotos: z.boolean(),
  causa: z.enum(['switch-S2', 'switch-R', 'cable-PC4', 'switch-S1']).optional(),
  justificacion: z.enum(['rama', 'raiz', 'cable']).optional(),
  ayudas: z.number().int().min(0).max(2),
  intentos: z.number().int().nonnegative(),
  completado: z.iso.datetime({ offset: true }).optional(),
}).superRefine((s, ctx) => {
  for (const despues of [false, true]) {
    const fase = s.pruebas.filter((p) => p.despues === despues)
    const parejas = new Set(fase.map((p) => [p.a, p.b].sort().join()))
    if (parejas.size !== fase.length || fase.length > 6) ctx.addIssue({ code: 'custom', message: 'Pruebas duplicadas o demasiadas en una fase' })
  }
  if (s.pruebas.some((p) => p.ok !== resultadoPrueba(s.variante, p.a, p.b, p.despues))) ctx.addIssue({ code: 'custom', message: 'Resultados incoherentes con el modelo' })
  if (s.fase !== 'investigar' && !diagnosticoSostenido(s)) ctx.addIssue({ code: 'custom', message: 'Diagnóstico sin evidencia suficiente' })
  if ((s.fase === 'investigar' || s.fase === 'actuar') && s.pruebas.some((p) => p.despues)) ctx.addIssue({ code: 'custom', message: 'Verificación antes de actuar' })
  if ((s.fase === 'completado') !== Boolean(s.completado) || (s.fase === 'completado' && !verificacionCompleta(s))) ctx.addIssue({ code: 'custom', message: 'Cierre sin verificación' })
})
export type EstadoLaboratorio = z.infer<typeof EstadoLaboratorioSchema>
export type VarianteLaboratorio = EstadoLaboratorio['variante']
type Diagnostico = Extract<Tablero, { tipo: 'diagnostico' }>
export const CAUSAS = [
  { id: 'switch-S2', etiqueta: 'Switch B · planta alta' },
  { id: 'switch-R', etiqueta: 'Switch raíz · une las plantas' },
  { id: 'cable-PC4', etiqueta: 'Cable de PC4' },
  { id: 'switch-S1', etiqueta: 'Switch A · planta baja' },
] as const
export const RAZONES = {
  rama: 'La planta baja se comunica; en la alta fallan incluso las pruebas entre sus equipos.',
  raiz: 'Cada planta se comunica internamente, pero falla la comunicación entre plantas.',
  cable: 'PC4 falla, mientras PC5 puede comunicarse con equipos de la otra planta.',
} as const
const causaVariante = { rama: 'switch-S2', raiz: 'switch-R', cable: 'cable-PC4' } as const
export function tableroLaboratorio(variante: VarianteLaboratorio, causa = causaVariante[variante] as string): Diagnostico {
  return { tipo: 'diagnostico', instruccion: 'Compara comunicación dentro y entre plantas.', escenario: { topologia: 'arbol', equipos: 5 },
    averia: causa === 'cable-PC4' ? { tipo: 'cable-pc', pc: 'PC4' } : { tipo: 'switch', sw: causa === 'switch-R' ? 'R' : causa === 'switch-S1' ? 'S1' : 'S2' },
    pruebas: 6, sospechosos: [...CAUSAS] }
}
export function nuevoLaboratorio(anterior?: EstadoLaboratorio): EstadoLaboratorio {
  const orden: VarianteLaboratorio[] = ['rama', 'raiz', 'cable']
  return { variante: orden[anterior ? (orden.indexOf(anterior.variante) + 1) % orden.length : 0], fase: 'investigar', pruebas: [], pilotos: false, ayudas: 0, intentos: 0 }
}
export function resultadoPrueba(variante: VarianteLaboratorio, a: string, b: string, reparado = false): boolean {
  if (a === b || !['PC1', 'PC2', 'PC3', 'PC4', 'PC5'].includes(a) || !['PC1', 'PC2', 'PC3', 'PC4', 'PC5'].includes(b)) throw new Error('Elige dos equipos distintos de esta red.')
  return reparado || pruebaComunicacion(tableroLaboratorio(variante), a, b)
}
export function agregarPrueba(s: EstadoLaboratorio, a: string, b: string): EstadoLaboratorio {
  if (s.fase !== 'investigar' && s.fase !== 'verificar') return s
  const despues = s.fase === 'verificar'
  if (s.pruebas.filter((p) => p.despues === despues).length >= 6 || s.pruebas.some((p) => p.despues === despues && [p.a, p.b].sort().join() === [a, b].sort().join())) return s
  return { ...s, pruebas: [...s.pruebas, { a: equipo.parse(a), b: equipo.parse(b), ok: resultadoPrueba(s.variante, a, b, despues), despues }] }
}
export function pilotosLaboratorio(s: EstadoLaboratorio): Record<string, boolean> {
  return s.fase === 'verificar' || s.fase === 'completado' ? Object.fromEntries(['PC1','PC2','PC3','PC4','PC5'].map((pc) => [pc, true])) : pilotos(tableroLaboratorio(s.variante))
}
/** Se comparan hipótesis con las pruebas reales; no basta hacer dos pruebas irrelevantes. */
export function hipotesisCompatibles(s: EstadoLaboratorio): string[] {
  const observaciones = s.pruebas.filter((p) => !p.despues)
  return CAUSAS.filter((c) => {
    const t = tableroLaboratorio(s.variante, c.id)
    const leds = pilotos(t)
    const reales = pilotos(tableroLaboratorio(s.variante))
    return observaciones.every((p) => pruebaComunicacion(t, p.a, p.b) === p.ok)
      && (!s.pilotos || Object.keys(reales).every((id) => reales[id] === leds[id]))
  }).map((c) => c.id)
}
export function diagnosticoSostenido(s: EstadoLaboratorio): boolean {
  const compatibles = hipotesisCompatibles(s)
  const antes = s.pruebas.filter((p) => !p.despues)
  return new Set(antes.map((p) => [p.a, p.b].sort().join())).size >= 2 && antes.some((p) => !p.ok) && compatibles.length === 1 && compatibles[0] === s.causa
    && s.causa === causaReal(tableroLaboratorio(s.variante)) && s.justificacion === s.variante
}
export function confirmarDiagnostico(s: EstadoLaboratorio): EstadoLaboratorio {
  if (s.fase !== 'investigar') return s
  return { ...s, fase: diagnosticoSostenido(s) ? 'actuar' : 'investigar', intentos: s.intentos + 1 }
}
/** En este modelo se representa restablecer el componente confirmado, sin manipular equipos reales. */
export function actuarLaboratorio(s: EstadoLaboratorio): EstadoLaboratorio {
  return s.fase === 'actuar' && diagnosticoSostenido(s) ? { ...s, fase: 'verificar' } : s
}
export function verificacionCompleta(s: EstadoLaboratorio): boolean {
  const pruebas = s.pruebas.filter((p) => p.despues && p.ok)
  // Repetir una prueba que fallaba, más una comprobación entre plantas.
  return new Set(pruebas.map((p) => [p.a, p.b].sort().join())).size >= 2 && pruebas.some((p) => s.pruebas.some((antes) => !antes.despues && !antes.ok && [antes.a, antes.b].sort().join() === [p.a, p.b].sort().join()))
    && pruebas.some((p) => (Number(p.a.slice(2)) <= 3) !== (Number(p.b.slice(2)) <= 3))
}
export function cerrarLaboratorio(s: EstadoLaboratorio, ahora = new Date()): EstadoLaboratorio {
  return s.fase === 'verificar' && verificacionCompleta(s) ? { ...s, fase: 'completado', completado: ahora.toISOString() } : s
}
export function reiniciarVerificacion(s: EstadoLaboratorio): EstadoLaboratorio {
  return s.fase === 'verificar' ? { ...s, pruebas: s.pruebas.filter((p) => !p.despues) } : s
}
export function reiniciarInvestigacion(s: EstadoLaboratorio): EstadoLaboratorio {
  return s.fase === 'investigar' ? { ...s, pruebas: [], causa: undefined, justificacion: undefined } : s
}
export function evidenciaLaboratorio(s: EstadoLaboratorio): string {
  return `Modelo de dos plantas. Diagnóstico: ${CAUSAS.find((c) => c.id === s.causa)?.etiqueta ?? 'pendiente'}. Justificación: ${s.justificacion ? RAZONES[s.justificacion] : 'pendiente'}. Pruebas: ${s.pruebas.map((p) => `${p.despues ? 'después' : 'antes'} ${p.a}→${p.b} ${p.ok ? 'funciona' : 'falla'}`).join('; ')}. Actuación: restablecer el componente en el modelo. Verificación: ${s.fase === 'completado' ? 'completada' : 'pendiente'}; intentos de diagnóstico: ${s.intentos}.`
}
