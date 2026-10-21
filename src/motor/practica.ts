// Práctica libre, simulacros de examen, preparación para cada examen e informe de progreso.
import { State } from 'ts-fsrs'
import type { Concepto, EventoCalendario } from '../contenido/esquema'
import { barajar } from './azar'
import { motorDe, type Item } from './items'
import { DOMINADO, hoy, nivel, retencion, type Progreso } from './progreso'
import { itemsDeConcepto, type Indice, type PasoSesion, type Sesion } from './sesiones'

export type ModoPractica = 'aprendido' | 'fallos' | 'olvidado'

export interface OpcionesPractica {
  moduloId: string
  /** Una sola unidad; si falta, todas las de la asignatura. */
  unidadId?: string
  modo: ModoPractica
  n: number
}

/** Conceptos de una asignatura (o unidad) que la persona ya ha aprendido. */
function aprendidos(ix: Indice, p: Progreso, moduloId: string, unidadId?: string): Concepto[] {
  return ix.unidades
    .filter((u) => u.modulo === moduloId && (!unidadId || u.id === unidadId))
    .flatMap((u) => u.conceptos)
    .filter((c) => p.conceptos[c.id]?.descubierto)
}

/**
 * Reparte `n` ejercicios entre los conceptos dados, de uno en uno y en orden, sin repetir ejercicio fijo
 * (los generados se pueden repetir porque cambian de datos cada vez) y variando el tipo todo lo posible.
 */
function repartir(ix: Indice, p: Progreso, conceptos: Concepto[], n: number, soloOficiales = false): Item[] {
  const cola = conceptos.map((c) => ({ c, items: barajar(itemsDeConcepto(ix, p, c.id)) }))
    .map(({ c, items }) => ({ c, items: soloOficiales && items.some((i) => i.origen === 'profesor') ? items.filter((i) => i.origen === 'profesor') : items }))
    .filter(({ items }) => items.length > 0)
  const res: Item[] = []
  const usadas = new Set<string>()
  const usosGenerador = new Map<string, number>()
  let vacias = 0
  for (let i = 0; res.length < n && cola.length > 0 && vacias < cola.length * 2; i++) {
    const { items } = cola[i % cola.length]
    const ultimo = res[res.length - 1]
    const candidatos = items.filter((it) => (it.clave.startsWith('gen:') ? (usosGenerador.get(it.clave) ?? 0) < 2 : !usadas.has(it.clave)))
    const mejor = candidatos.find((it) => !ultimo || motorDe(it) !== motorDe(ultimo)) ?? candidatos[0]
    if (!mejor) { vacias++; continue }
    vacias = 0
    if (mejor.clave.startsWith('gen:')) usosGenerador.set(mejor.clave, (usosGenerador.get(mejor.clave) ?? 0) + 1)
    else usadas.add(mejor.clave)
    res.push(mejor)
  }
  return res
}

const comoPasos = (items: Item[]): PasoSesion[] => items.map((item) => ({ tipo: 'item', item, repaso: false }))

/** Práctica libre: sin límite diario, solo con lo aprendido. No toca el calendario de repasos salvo los fallos. */
export function construirPractica(ix: Indice, p: Progreso, o: OpcionesPractica, ahora = new Date()): Sesion | { error: string } {
  const todos = aprendidos(ix, p, o.moduloId, o.unidadId)
  if (todos.length === 0) return { error: 'Aún no has aprendido ninguna lección de esta asignatura. Empieza por la primera y vuelve aquí.' }
  let conceptos: Concepto[]
  let titulo: string
  if (o.modo === 'fallos') {
    conceptos = todos.filter((c) => (p.conceptos[c.id]?.fallos ?? 0) > 0)
      .sort((a, b) => {
        const ea = p.conceptos[a.id]
        const eb = p.conceptos[b.id]
        return (eb.fallos - eb.aciertos) - (ea.fallos - ea.aciertos) || eb.fallos - ea.fallos
      })
    if (conceptos.length === 0) return { error: 'No tienes fallos registrados en esta asignatura. ¡Buena señal! Prueba la práctica de todo lo aprendido.' }
    titulo = 'Práctica de mis fallos'
  } else if (o.modo === 'olvidado') {
    conceptos = [...todos].sort((a, b) => retencion(p.conceptos[a.id], ahora) - retencion(p.conceptos[b.id], ahora)).slice(0, Math.max(3, Math.ceil(o.n / 2)))
    titulo = 'Repaso de lo que más se olvida'
  } else {
    conceptos = barajar(todos)
    titulo = 'Práctica libre'
  }
  const items = repartir(ix, p, conceptos, o.n)
  if (items.length === 0) return { error: 'Estas lecciones aún no tienen ejercicios disponibles.' }
  return { tipo: 'practica', titulo, pasos: comoPasos(items) }
}

/** Segundos por pregunta en un simulacro. */
export const SEGUNDOS_POR_PREGUNTA = 60

/** Simulacro de examen: preguntas de todas las lecciones aprendidas de la asignatura, con tiempo y nota sobre 10. */
export function construirSimulacro(ix: Indice, p: Progreso, moduloId: string, n = 20): Sesion | { error: string } {
  const todos = aprendidos(ix, p, moduloId)
  if (todos.length < 3) return { error: 'Para un simulacro necesitas haber aprendido al menos 3 lecciones de la asignatura.' }
  const items = repartir(ix, p, barajar(todos), n, true)
  if (items.length < 3) return { error: 'Todavía no hay suficientes ejercicios con lo que has aprendido para un simulacro.' }
  return { tipo: 'examen', titulo: 'Simulacro de examen', modulo: moduloId, pasos: barajar(comoPasos(items)), tiempo: items.length * SEGUNDOS_POR_PREGUNTA }
}

export interface Preparacion {
  total: number
  aprendidos: number
  dominados: number
  /** Estimación de 0 a 1: recuerdo medio de lo aprendido sobre el total (lo no aprendido cuenta 0). */
  preparado: number
  restantes: number
}

export function preparacion(ix: Indice, p: Progreso, moduloId: string, ahora = new Date()): Preparacion {
  const conceptos = ix.unidades.filter((u) => u.modulo === moduloId).flatMap((u) => u.conceptos)
  const vistos = conceptos.filter((c) => p.conceptos[c.id]?.descubierto)
  // Una lección vista pero aún sin respuestas no tiene recuerdo medible: cuenta como "vista" (0,4).
  const recuerdo = (c: Concepto) => (p.conceptos[c.id].tarjeta.state === State.New ? 0.4 : retencion(p.conceptos[c.id], ahora))
  const suma = vistos.reduce((s, c) => s + recuerdo(c), 0)
  return {
    total: conceptos.length,
    aprendidos: vistos.length,
    dominados: conceptos.filter((c) => nivel(p.conceptos[c.id]) >= DOMINADO).length,
    preparado: conceptos.length ? suma / conceptos.length : 0,
    restantes: conceptos.length - vistos.length,
  }
}

export interface ExamenProximo {
  evento: EventoCalendario
  dias: number
  prep: Preparacion
  /** Lecciones nuevas por día para llegar con todo visto, dejando unos días finales para repasar. */
  ritmo: number
}

export const DIAS_DE_REPASO_FINAL = 4

export function diasHasta(fecha: string, ahora = new Date()): number {
  return Math.round((new Date(fecha + 'T12:00:00').getTime() - new Date(hoy(ahora) + 'T12:00:00').getTime()) / 86_400_000)
}

/** Exámenes futuros de asignaturas con contenido en el juego, del más cercano al más lejano. */
export function examenesProximos(ix: Indice, p: Progreso, calendario: EventoCalendario[], ahora = new Date()): ExamenProximo[] {
  const conContenido = new Set<string>(ix.unidades.map((u) => u.modulo))
  return calendario
    .filter((e) => e.tipo === 'examen' && conContenido.has(e.modulo) && e.fecha >= hoy(ahora))
    .map((evento) => {
      const dias = diasHasta(evento.fecha, ahora)
      const prep = preparacion(ix, p, evento.modulo, ahora)
      return { evento, dias, prep, ritmo: prep.restantes === 0 ? 0 : Math.ceil(prep.restantes / Math.max(1, dias - DIAS_DE_REPASO_FINAL)) }
    })
    .sort((a, b) => a.evento.fecha.localeCompare(b.evento.fecha))
}

/** Resumen en texto para enviar a la tutora o al profesorado (copiar o descargar). */
export function generarInforme(ix: Indice, p: Progreso, calendario: EventoCalendario[], modulos: { id: string; nombre: string }[], ahora = new Date()): string {
  const fecha = ahora.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  const lineas = [`Informe de progreso de ${p.nombre || 'alumno/a'} — ${fecha}`, '']
  const sesiones = Object.keys(p.turnos).length
  lineas.push(`Días con sesión completa: ${sesiones} · Racha actual: ${p.racha.actual} días (mejor: ${p.racha.mejor}) · XP total: ${p.xp}`, '')
  lineas.push('Por asignatura (lecciones vistas / dominio por repasos / total, y recuerdo estimado del contenido cargado):')
  for (const m of modulos) {
    const prep = preparacion(ix, p, m.id, ahora)
    if (prep.total === 0) { lineas.push(`- ${m.nombre}: sin contenido todavía en el juego`); continue }
    lineas.push(`- ${m.nombre}: ${prep.aprendidos} / ${prep.dominados} / ${prep.total} · preparación ${Math.round(prep.preparado * 100)} %`)
  }
  lineas.push('', 'Comprobaciones inmediatas (distintas del recuerdo a largo plazo):')
  const estados = Object.values(p.conceptos).filter((e) => e.aplicacion)
  lineas.push(`Última actividad sin ayuda: ${estados.filter((e) => e.aplicacion?.estado === 'sin-ayuda').length} conceptos · con ayuda: ${estados.filter((e) => e.aplicacion?.estado === 'con-ayuda').length} · pendientes: ${estados.filter((e) => e.aplicacion?.estado === 'pendiente').length}`)
  const muestras = (p.evidencias ?? []).slice(-8)
  if (!muestras.length) lineas.push('Sin muestras registradas todavía. El progreso anterior se conserva sin inventar evidencias.')
  for (const e of muestras) {
    const nombres = e.conceptos.map((id) => ix.concepto.get(id)?.concepto.nombre ?? id).join(', ')
    lineas.push(`- ${e.fecha.slice(0, 10)} · ${e.tipo} · ${nombres}: ${e.acierto ? 'resuelto' : 'pendiente'}${e.ayudas ? ` con ${e.ayudas} niveles de ayuda` : ' sin ayuda'}. ${e.detalle}`)
  }
  const proximos = examenesProximos(ix, p, calendario, ahora).slice(0, 4)
  if (proximos.length) {
    lineas.push('', 'Próximos exámenes:')
    for (const e of proximos) lineas.push(`- ${e.evento.titulo} (${e.evento.fecha}, en ${e.dias} días): preparación ${Math.round(e.prep.preparado * 100)} %, faltan ${e.prep.restantes} lecciones`)
  }
  const simulacros = Object.entries(p.simulacros ?? {})
  if (simulacros.length) {
    lineas.push('', 'Simulacros de examen (nota media de los últimos 5):')
    for (const [id, lista] of simulacros) {
      const ultimos = lista.slice(-5)
      lineas.push(`- ${modulos.find((m) => m.id === id)?.nombre ?? id}: ${(ultimos.reduce((s, x) => s + x.nota, 0) / ultimos.length).toFixed(1)} sobre 10 (${lista.length} simulacros)`)
    }
  }
  lineas.push('', 'Alcance: contenido cargado en el juego; no equivale al temario completo de un examen, a una nota oficial ni a una probabilidad de aprobar. Las simulaciones son modelos conceptuales.', 'Generado por Aula SMR. Los datos se calculan en este dispositivo y solo se comparten cuando el alumno lo decide.')
  return lineas.join('\n')
}
