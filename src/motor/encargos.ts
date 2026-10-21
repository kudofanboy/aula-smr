import type { Encargo, Unidad } from '../contenido/esquema'
import { hoy, type Progreso } from './progreso'
import { MAX_INVENTARIO_OFICINA } from './inventario-oficina'

export interface EncargoDisponible { encargo: Encargo; unidad: Unidad }

export function catalogoEncargos(unidades: Unidad[]): EncargoDisponible[] {
  return unidades.flatMap((unidad) => unidad.encargos
    .filter((e) => e.verificado && e.pasos.every((p) => p.verificado && p.conceptos.every((id) => unidad.conceptos.some((c) => c.id === id && c.verificado))))
    .map((encargo) => ({ encargo, unidad })))
}

/**
 * Formaciones que quedan por hacer para poder atender un encargo. El camino de cada unidad es lineal, así que incluye
 * todas las anteriores al último concepto que el encargo necesita, no solo los que menciona.
 */
export function pendientesParaEncargo(ficha: EncargoDisponible, p: Progreso): string[] {
  const requeridos = new Set(ficha.encargo.pasos.flatMap((paso) => paso.conceptos))
  const conceptos = ficha.unidad.conceptos.filter((c) => c.verificado)
  const ultimo = conceptos.reduce((n, c, i) => (requeridos.has(c.id) ? i : n), -1)
  return conceptos.slice(0, ultimo + 1).filter((c) => !p.conceptos[c.id]?.descubierto).map((c) => c.id)
}

/** Otra versión del mismo caso (la anterior o la revisada), si la hay. */
export const otraVersion = (e: Encargo): string | undefined => e.sustituye ?? e.sustituido_por

/** Un caso sustituido solo se ofrece a quien ya lo había empezado o entregado: su historial conserva su significado. */
export function encargoVisible(e: Encargo, p: Progreso): boolean {
  return !e.sustituido_por || Boolean(p.encargos[e.id])
}

/** Las dos versiones de un caso comparten un único premio. */
export function premioYaCobrado(e: Encargo, p: Progreso): boolean {
  const otra = otraVersion(e)
  return Boolean(otra && p.encargos[otra]?.completado && !p.encargos[otra]?.sinPremio)
}

export function conoceEncargo(e: Encargo, p: Progreso): boolean {
  return e.pasos.every((paso) => paso.conceptos.every((id) => Boolean(p.conceptos[id]?.descubierto)))
}

/** Misma recomendación para panel y lista de casos: preparado primero, después el camino más corto. */
export function siguienteEncargo(unidades: Unidad[], p: Progreso): EncargoDisponible | undefined {
  return catalogoEncargos(unidades).filter(({ encargo }) => !p.encargos[encargo.id] && encargoVisible(encargo, p)).map((ficha) => {
    const requeridos = new Set(ficha.encargo.pasos.flatMap((paso) => paso.conceptos))
    const conceptos = ficha.unidad.conceptos.filter((c) => c.verificado)
    const ultimo = conceptos.reduce((n, c, i) => requeridos.has(c.id) ? i : n, -1)
    // Se estudia de uno en uno: llegar a un concepto exige recorrer los anteriores de su unidad.
    const formaciones = conoceEncargo(ficha.encargo, p) ? 0 : conceptos.slice(0, ultimo + 1).filter((c) => !p.conceptos[c.id]?.descubierto).length
    return { ficha, formaciones, taller: Number(ficha.encargo.pasos.some((paso) => paso.taller)) }
  }).sort((a, b) => a.formaciones - b.formaciones || b.taller - a.taller || a.ficha.encargo.id.localeCompare(b.ficha.encargo.id))[0]?.ficha
}

/** Abre un caso preparado una sola vez y conserva intacto cualquier estado que ya tuviera. */
export function iniciarEncargo(p: Progreso, encargo: Encargo, dia = hoy()): Progreso {
  if (p.encargos[encargo.id] || !encargoVisible(encargo, p) || !conoceEncargo(encargo, p)) return p
  return { ...p, encargos: { ...p.encargos, [encargo.id]: { recibido: dia, leido: true, respuestas: [] } } }
}

export function valorarEncargo(e: Encargo, respuestas: number[]) {
  const aciertos = e.pasos.filter((p, i) => p.opciones[respuestas[i]]?.correcta).length
  const estado = aciertos === e.pasos.length ? 'satisfecho' : aciertos >= Math.ceil(e.pasos.length / 2) ? 'parcial' : 'insatisfecho'
  return { aciertos, total: e.pasos.length, estado, mensaje: e.valoracion[estado], xp: aciertos * 12, sueldo: aciertos * 20 } as const
}

/** Traduce la preparación visual a una opción del mismo encargo, sin otra puntuación. */
export function opcionTaller(paso: Encargo['pasos'][number], valor: number): number | undefined {
  if (!paso.taller || !Number.isInteger(valor) || valor < 0 || valor > (paso.taller === 'inventario' ? MAX_INVENTARIO_OFICINA : 2)) return undefined
  let i = paso.opciones.findIndex((o) => o.valor_taller === valor)
  if (i < 0 && paso.taller === 'inventario') i = paso.opciones.findIndex((o) => o.valor_taller === -1)
  return i >= 0 ? i : undefined
}

/** Traduce el resultado de un tablero (cableado o diagnóstico) a la opción del paso que lo describe. */
export function opcionTablero(paso: Encargo['pasos'][number], valor: number | undefined): number | undefined {
  if (!paso.tablero || valor === undefined) return undefined
  const i = paso.opciones.findIndex((o) => o.valor_taller === valor)
  return i >= 0 ? i : undefined
}

/** Guardar herramientas o nodos no descubre conceptos ni confirma la solución. */
export function prepararEncargo(p: Progreso, e: Encargo, paso: number, valor: number): Progreso {
  const actual = p.encargos[e.id]
  if (!actual || actual.completado || !e.verificado || !conoceEncargo(e, p)
    || paso !== actual.respuestas.length || !e.pasos[paso]?.verificado
    || opcionTaller(e.pasos[paso], valor) === undefined || actual.borradores?.[paso] === valor) return p
  return { ...p, encargos: { ...p.encargos, [e.id]: { ...actual,
    borradores: { ...actual.borradores, [paso]: valor } } } }
}

/** Cada decisión se confirma una vez. Recargar o pulsar dos veces no duplica respuestas/recompensas. */
export function decidirEncargo(p: Progreso, e: Encargo, paso: number, opcion: number, dia = hoy()): Progreso {
  const actual = p.encargos[e.id]
  if (!actual || actual.completado || !e.verificado || !conoceEncargo(e, p)
    || paso !== actual.respuestas.length || !e.pasos[paso]?.verificado
    || !Number.isInteger(opcion) || !e.pasos[paso]?.opciones[opcion]) return p
  const borrador = actual.borradores?.[paso]
  if (borrador !== undefined && e.pasos[paso].taller && opcionTaller(e.pasos[paso], borrador) !== opcion) return p
  const respuestas = [...actual.respuestas, opcion]
  return { ...p, encargos: { ...p.encargos, [e.id]: { ...actual, leido: true, respuestas } },
    // La fecha de respuesta se contabiliza en tienda; el premio se concede al entregar.
    ultimoEncargoDia: p.ultimoEncargoDia ?? dia }
}

export function entregarEncargo(p: Progreso, e: Encargo, dia = hoy()): Progreso {
  const actual = p.encargos[e.id]
  if (!actual || actual.completado || actual.respuestas.length !== e.pasos.length
    || !e.verificado || !e.pasos.every((paso, i) => paso.verificado && Number.isInteger(actual.respuestas[i]) && paso.opciones[actual.respuestas[i]])) return p
  if (premioYaCobrado(e, p)) return { ...p, encargos: { ...p.encargos, [e.id]: { ...actual, leido: true, completado: dia, sinPremio: true } } }
  const premio = valorarEncargo(e, actual.respuestas)
  return { ...p, xp: p.xp + premio.xp, sueldo: p.sueldo + premio.sueldo,
    xpDia: { ...p.xpDia, [dia]: (p.xpDia[dia] ?? 0) + premio.xp },
    encargos: { ...p.encargos, [e.id]: { ...actual, leido: true, completado: dia } } }
}
