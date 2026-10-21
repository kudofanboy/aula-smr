// Construcción de sesiones: el turno diario, las partidas de la sala de juegos y los exámenes.
import type { Concepto, EventoCalendario, Juego, Termino, Unidad } from '../contenido/esquema'
import { barajar } from './azar'
import { itemDeEjercicio, itemDeGenerador, motorDe, type Item } from './items'
import { State } from 'ts-fsrs'
import { hoy, retencion, vencido, type Progreso } from './progreso'

export const MAX_NUEVOS_DIA = 3
export const MAX_REPASOS_TURNO = 8

export type PasoSesion =
  | { tipo: 'descubrir'; concepto: Concepto; unidadId: string }
  | { tipo: 'item'; item: Item; repaso: boolean }

export interface Sesion {
  tipo: 'turno' | 'practica' | 'examen' | 'aprender' | 'breve'
  titulo: string
  pasos: PasoSesion[]
  juegoId?: string
  /** Asignatura de un simulacro de examen (para guardar su historial). */
  modulo?: string
  /** Segundos totales (exámenes). */
  tiempo?: number
  objetivo?: string
  motivo?: string
  /** Solo los bloques breves de formación o repaso programado actualizan FSRS en aciertos. */
  repasoEspaciado?: boolean
  guiada?: boolean
}

export interface Indice {
  unidades: Unidad[]
  concepto: Map<string, { concepto: Concepto; unidad: Unidad }>
  /** Glosario común: términos de todas las unidades. */
  glosario: Map<string, Termino>
}

export function indexar(unidades: Unidad[]): Indice {
  const concepto = new Map<string, { concepto: Concepto; unidad: Unidad }>()
  const glosario = new Map<string, Termino>()
  const ordenadas = [...unidades].sort((a, b) => a.modulo.localeCompare(b.modulo) || a.orden - b.orden)
  for (const u of ordenadas) {
    for (const c of u.conceptos) concepto.set(c.id, { concepto: c, unidad: u })
    for (const t of u.glosario ?? []) glosario.set(t.id, t)
  }
  return { unidades: ordenadas, concepto, glosario }
}

const descubierto = (p: Progreso, id: string) => Boolean(p.conceptos[id]?.descubierto)

/** Ítems posibles para practicar un concepto, sin preguntar nada que no se haya descubierto. */
export function itemsDeConcepto(ix: Indice, p: Progreso, conceptoId: string, extraDescubiertos: Set<string> = new Set()): Item[] {
  const reg = ix.concepto.get(conceptoId)
  if (!reg) return []
  const ok = (ids: string[]) => ids.every((id) => descubierto(p, id) || extraDescubiertos.has(id))
  const ocultos = new Set(p.ocultos)
  const estaticos = reg.unidad.ejercicios
    .filter((e) => e.verificado && !ocultos.has(e.id) && e.conceptos.includes(conceptoId) && ok(e.conceptos))
    .map((e) => itemDeEjercicio(e, reg.unidad.id))
  const generados = reg.unidad.generadores
    .filter((g) => g.conceptos.includes(conceptoId) && ok(g.conceptos))
    .map((g) => itemDeGenerador(g, reg.unidad.id))
  return [...estaticos, ...generados]
}

/**
 * Preguntas de un examen que quedaron sin responder al acabarse el tiempo (también las saltadas y no retomadas).
 * Cuentan como falladas en la nota, así que la revisión también las enseña. Fuera de un examen no hay ninguna.
 */
export function sinResponder(sesion: Sesion, respondidas: Item[]): Item[] {
  if (sesion.tipo !== 'examen') return []
  const hechas = new Set(respondidas)
  return sesion.pasos.flatMap((p) => (p.tipo === 'item' && !hechas.has(p.item) ? [p.item] : []))
}

/** Días hasta el próximo examen, entrega o cuestionario de cada módulo (para darle prioridad en el turno). */
export function diasHastaExamen(calendario: EventoCalendario[], ahora = new Date()): Record<string, number> {
  const res: Record<string, number> = {}
  const hoyStr = hoy(ahora)
  for (const ev of calendario) {
    if (ev.tipo === 'aviso' || ev.fecha < hoyStr) continue
    const dias = Math.round((new Date(ev.fecha + 'T12:00:00').getTime() - new Date(hoyStr + 'T12:00:00').getTime()) / 86_400_000)
    res[ev.modulo] = Math.min(res[ev.modulo] ?? Infinity, dias)
  }
  return res
}

/** Solo la primera formación pendiente de cada unidad, respetando además sus prerrequisitos. */
export function candidatosNuevos(ix: Indice, p: Progreso, calendario: EventoCalendario[], soloUnidad?: string, extra: Set<string> = new Set()): Concepto[] {
  const dias = diasHastaExamen(calendario)
  const prio = (u: Unidad) => (dias[u.modulo] !== undefined && dias[u.modulo] <= 21 ? 0 : 1)
  const unidades = ix.unidades.filter((u) => !soloUnidad || u.id === soloUnidad).sort((a, b) => prio(a) - prio(b))
  const visto = (id: string) => descubierto(p, id) || extra.has(id)
  const res: Concepto[] = []
  for (const u of unidades) {
    const c = u.conceptos.find((c) => !visto(c.id))
    if (c?.verificado && c.requiere.every(visto)) res.push(c)
  }
  return res
}

/**
 * Elige hasta `n` conceptos nuevos. Primero las asignaturas con fecha cercana, pero repartiendo entre asignaturas
 * (y luego entre unidades) para que una jornada no sea de una sola materia. Cuenta como descubiertos los ya
 * elegidos, así que un concepto elegido desbloquea el siguiente de su unidad.
 */
export function elegirNuevos(ix: Indice, p: Progreso, calendario: EventoCalendario[], n: number): Concepto[] {
  const dias = diasHastaExamen(calendario)
  const cerca = (modulo: string) => (dias[modulo] !== undefined && dias[modulo] <= 21 ? 0 : 1)
  const elegidos: Concepto[] = []
  const extra = new Set<string>()
  const porUnidad = new Map<string, number>()
  const porModulo = new Map<string, number>()
  const unidadDe = (c: Concepto) => ix.concepto.get(c.id)!.unidad
  while (elegidos.length < n) {
    const cands = candidatosNuevos(ix, p, calendario, undefined, extra)
    if (cands.length === 0) break
    const clave = (c: Concepto) => {
      const u = unidadDe(c)
      return [cerca(u.modulo), porModulo.get(u.modulo) ?? 0, porUnidad.get(u.id) ?? 0]
    }
    // El orden de `cands` (unidad y orden del temario) desempata: la sort es estable.
    const c = [...cands].sort((a, b) => {
      const ka = clave(a)
      const kb = clave(b)
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2]
    })[0]
    elegidos.push(c)
    extra.add(c.id)
    const u = unidadDe(c)
    porUnidad.set(u.id, (porUnidad.get(u.id) ?? 0) + 1)
    porModulo.set(u.modulo, (porModulo.get(u.modulo) ?? 0) + 1)
  }
  return elegidos
}

function elegirItem(items: Item[], evitarMotor?: string, preferirFacil = false): Item | undefined {
  if (items.length === 0) return undefined
  let lista = items.filter((i) => motorDe(i) !== evitarMotor)
  if (lista.length === 0) lista = items
  lista = barajar(lista)
  if (preferirFacil) lista.sort((a, b) => a.dificultad - b.dificultad)
  return lista[0]
}

/** Al enseñar, usar aplicaciones propias; el banco oficial queda disponible para repasos y exámenes. */
function paraFormacion(items: Item[]): Item[] {
  const propios = items.filter((it) => it.origen === 'juego')
  return propios.length ? propios : items
}

export function nuevosHoy(p: Progreso): number {
  const d = hoy()
  return Object.values(p.conceptos).filter((c) => c.descubierto === d).length
}

/** Turno diario: repasos vencidos + hasta 3 conceptos nuevos + un minijuego al final. */
export function construirTurno(ix: Indice, p: Progreso, calendario: EventoCalendario[], ahora = new Date()): Sesion {
  const dias = diasHastaExamen(calendario, ahora)
  const examenCerca = (id: string) => {
    const m = ix.concepto.get(id)?.unidad.modulo
    return m !== undefined && dias[m] !== undefined && dias[m] <= 21
  }
  const vencidos = Object.entries(p.conceptos)
    // También cuentan los descubiertos sin ninguna respuesta todavía (p. ej. si se cerró el juego tras la lección).
    .filter(([id, e]) => ix.concepto.has(id) && e.descubierto && (e.tarjeta.state === State.New || vencido(e, ahora)))
    .sort(([a, ea], [b, eb]) => Number(examenCerca(b)) - Number(examenCerca(a)) || retencion(ea, ahora) - retencion(eb, ahora))
    .slice(0, MAX_REPASOS_TURNO)

  const repasos: PasoSesion[] = []
  for (const [id, e] of vencidos) {
    const item = elegirItem(itemsDeConcepto(ix, p, id), e.ultimoMotor)
    if (item) repasos.push({ tipo: 'item', item: { ...item, conceptos: [id] }, repaso: true })
  }

  const cupo = Math.max(0, MAX_NUEVOS_DIA - nuevosHoy(p))
  const nuevos = elegirNuevos(ix, p, calendario, cupo)
  const bloques: PasoSesion[][] = []
  const yaNuevos = new Set<string>()
  for (const c of nuevos) {
    yaNuevos.add(c.id)
    const reg = ix.concepto.get(c.id)!
    const bloque: PasoSesion[] = [{ tipo: 'descubrir', concepto: c, unidadId: reg.unidad.id }]
    const item = elegirItem(paraFormacion(itemsDeConcepto(ix, p, c.id, yaNuevos)), undefined, true)
    if (item) bloque.push({ tipo: 'item', item: { ...item, conceptos: [c.id] }, repaso: false })
    bloques.push(bloque)
  }

  // Intercalar: un repaso para calentar, luego nuevos y repasos alternados.
  const pasos: PasoSesion[] = []
  const rep = [...repasos]
  if (rep.length) pasos.push(rep.shift()!)
  for (const b of bloques) {
    pasos.push(...b)
    pasos.push(...rep.splice(0, 2))
  }
  pasos.push(...rep)

  // Minijuego final con conceptos ya conocidos (clasificar, emparejar, ordenar o simulación).
  const conocidos = new Set([...Object.keys(p.conceptos).filter((id) => descubierto(p, id)), ...yaNuevos])
  const juegos: Item[] = []
  const usados = new Set(pasos.flatMap((p) => p.tipo === 'item' ? [p.item.clave] : []))
  for (const id of conocidos)
    for (const it of itemsDeConcepto(ix, p, id, yaNuevos))
      if (['clasificar', 'emparejar', 'ordenar', 'nodos'].includes(it.vista.motor)
        && (it.clave.startsWith('gen:') || !usados.has(it.clave))) juegos.push(it)
  const final = elegirItem(juegos)
  if (final && pasos.length > 0) pasos.push({ tipo: 'item', item: final, repaso: false })

  return { tipo: 'turno', titulo: `Sesión del ${ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`, pasos }
}

/** Un objetivo: recuperar una dificultad, repasar algo vencido o descubrir una lección. */
export function construirBreve(ix: Indice, p: Progreso, calendario: EventoCalendario[], ahora = new Date()): Sesion {
  const pendiente = [...ix.concepto.values()].find(({ concepto }) => p.conceptos[concepto.id]?.aplicacion?.estado === 'pendiente')
  const turno = construirTurno(ix, p, calendario, ahora)
  const repaso = turno.pasos.find((s) => s.tipo === 'item' && s.repaso)
  const siguiente = turno.pasos.find((s) => s.tipo === 'descubrir')
  const recuperacion = pendiente ? construirLeccion(ix, p, pendiente.concepto.id) : undefined
  if (recuperacion && !('error' in recuperacion)) return {
    ...recuperacion, tipo: 'breve', repasoEspaciado: false, guiada: true, titulo: 'Un paso para entenderlo',
    objetivo: `Volver a practicar: ${pendiente!.concepto.nombre}`,
    motivo: 'La última comprobación quedó pendiente. Repasaremos la explicación antes de intentarlo con ayuda disponible.',
  }
  if (repaso?.tipo === 'item') {
    const id = repaso.item.conceptos[0]
    const nombre = ix.concepto.get(id)?.concepto.nombre ?? 'lo que ya has visto'
    const segundo = itemsDeConcepto(ix, p, id).find((it) => it.clave !== repaso.item.clave)
    return { tipo: 'breve', repasoEspaciado: true, titulo: 'Un repaso breve', objetivo: `Comprobar qué recuerdas: ${nombre}`,
      motivo: 'Este concepto necesita repaso. Lo practicaremos con una o dos actividades.',
      pasos: [repaso, ...(segundo ? [{ tipo: 'item' as const, item: { ...segundo, conceptos: [id] }, repaso: true }] : [])] }
  }
  if (siguiente?.tipo === 'descubrir') {
    const leccion = construirLeccion(ix, p, siguiente.concepto.id)
    if (!('error' in leccion)) return { ...leccion, tipo: 'breve', repasoEspaciado: true, titulo: 'Una sola lección', objetivo: `Empezar con: ${siguiente.concepto.nombre}`,
      motivo: 'Una explicación y su práctica. Puedes parar al terminar este objetivo.' }
  }
  // Si hoy no toca repasar ni queda cupo nuevo, practicar un concepto conocido sigue siendo opcional.
  for (const [id, e] of Object.entries(p.conceptos)) if (e.descubierto) {
    const items = variados(itemsDeConcepto(ix, p, id), 2, false)
    if (items.length) return { tipo: 'breve', repasoEspaciado: false, titulo: 'Práctica breve', objetivo: `Practicar: ${ix.concepto.get(id)?.concepto.nombre ?? id}`,
      motivo: 'No hay repasos urgentes. Este bloque es práctica voluntaria.', pasos: items.map((item) => ({ tipo: 'item', item, repaso: false })) }
  }
  return { tipo: 'breve', titulo: 'Todo al día', objetivo: 'No hay un bloque disponible ahora', motivo: 'Puedes explorar las asignaturas.', pasos: [] }
}

/** Ítems disponibles para un juego de la sala de juegos (solo conceptos ya descubiertos). */
export function poolJuego(u: Unidad, j: Juego, p: Progreso): { estaticos: Item[]; generadores: Unidad['generadores'] } {
  const ocultos = new Set(p.ocultos)
  const enFiltro = (conceptos: string[]) => !j.conceptos || conceptos.some((c) => j.conceptos!.includes(c))
  const conocidos = (conceptos: string[]) => conceptos.every((c) => descubierto(p, c))
  const motores = j.motores ?? []
  const admiteMotor = (motor: string) => motores.length === 0 || motores.includes(motor)
  const estaticos = u.ejercicios
    .filter((e) => e.verificado && !ocultos.has(e.id) && enFiltro(e.conceptos) && conocidos(e.conceptos))
    .filter((e) => admiteMotor(e.motor))
    .filter((e) => (j.tipo === 'banco-profesor' || j.solo_profesor ? e.origen === 'profesor' : true))
    .map((e) => itemDeEjercicio(e, u.id))
  const generadores = (j.generadores ?? []).filter((g) => conocidos(g.conceptos) && admiteMotor(`gen:${g.tipo}`))
  return { estaticos, generadores }
}

export function construirJuego(u: Unidad, j: Juego, p: Progreso): Sesion | { error: string } {
  const { estaticos, generadores } = poolJuego(u, j, p)
  if (estaticos.length === 0 && generadores.length === 0)
    return { error: 'Todavía no has descubierto los conceptos de este juego. Descúbrelos en tu turno o con "Aprender" en esta sala.' }
  // Un juego que anuncia simulaciones debe incluirlas: se reserva al menos un tercio de las preguntas para los generadores
  // (antes solo entraban si faltaban ejercicios estáticos, y con la unidad completa no salían nunca).
  const reservadas = generadores.length > 0 ? Math.min(j.preguntas, Math.max(1, Math.round(j.preguntas / 3))) : 0
  const elegidos = barajar(estaticos).slice(0, j.preguntas - reservadas)
  let i = 0
  while (elegidos.length < j.preguntas && generadores.length > 0) {
    elegidos.push(itemDeGenerador(generadores[i % generadores.length], u.id))
    i++
  }
  return {
    tipo: j.tipo === 'examen' ? 'examen' : 'practica',
    titulo: j.titulo,
    juegoId: j.id,
    tiempo: j.tiempo,
    pasos: barajar(elegidos).map((item) => ({ tipo: 'item', item, repaso: false })),
  }
}

/** Hasta `n` ítems distintos de un concepto, variando el tipo de ejercicio (los fáciles primero si se pide). */
function variados(items: Item[], n: number, facilesPrimero: boolean): Item[] {
  let lista = barajar(items)
  if (facilesPrimero) lista = lista.sort((a, b) => a.dificultad - b.dificultad)
  const res: Item[] = []
  const motores = new Set<string>()
  for (const it of lista) if (res.length < n && !motores.has(motorDe(it))) { res.push(it); motores.add(motorDe(it)) }
  for (const it of lista) if (res.length < n && !res.includes(it)) res.push(it)
  return res
}

/** Lección de un nodo del camino: descubrir el concepto y practicarlo con hasta 3 ejercicios. */
export function construirLeccion(ix: Indice, p: Progreso, conceptoId: string): Sesion | { error: string } {
  const reg = ix.concepto.get(conceptoId)
  if (!reg) return { error: 'Concepto no encontrado.' }
  const c = reg.concepto
  if (!c.verificado) return { error: 'Esta lección todavía no está verificada.' }
  const faltan = c.requiere.filter((id) => !descubierto(p, id))
  if (faltan.length > 0) return { error: `Antes debes completar: ${faltan.map((id) => ix.concepto.get(id)?.concepto.nombre ?? id).join(', ')}.` }
  const anterior = reg.unidad.conceptos.slice(0, reg.unidad.conceptos.indexOf(c)).find((c) => !descubierto(p, c.id))
  if (!descubierto(p, c.id) && anterior) return { error: `Antes debes completar: ${anterior.nombre}.` }
  const pasos: PasoSesion[] = [{ tipo: 'descubrir', concepto: c, unidadId: reg.unidad.id }]
  for (const item of variados(paraFormacion(itemsDeConcepto(ix, p, c.id, new Set([c.id]))), 3, true))
    pasos.push({ tipo: 'item', item: { ...item, conceptos: [c.id] }, repaso: false })
  return { tipo: 'aprender', titulo: `Lección: ${c.nombre}`, pasos }
}

/** Refuerzo de un concepto ya descubierto: 4 ejercicios seguidos (cuenta como práctica libre). */
export function construirRefuerzo(ix: Indice, p: Progreso, conceptoId: string): Sesion | { error: string } {
  const reg = ix.concepto.get(conceptoId)
  if (!reg) return { error: 'Concepto no encontrado.' }
  const items = variados(itemsDeConcepto(ix, p, conceptoId), 4, false)
  if (items.length === 0) return { error: 'Este concepto aún no tiene ejercicios disponibles.' }
  return { tipo: 'practica', titulo: `Refuerzo: ${reg.concepto.nombre}`, pasos: items.map((item) => ({ tipo: 'item', item, repaso: false })) }
}

/** Sesión para descubrir el siguiente concepto de una unidad por iniciativa propia. */
export function construirAprender(ix: Indice, p: Progreso, calendario: EventoCalendario[], unidadId: string): Sesion | { error: string } {
  const c = candidatosNuevos(ix, p, calendario, unidadId)[0]
  if (!c) return { error: 'Ya has descubierto todos los conceptos disponibles de esta unidad.' }
  const pasos: PasoSesion[] = [{ tipo: 'descubrir', concepto: c, unidadId }]
  const item = elegirItem(paraFormacion(itemsDeConcepto(ix, p, c.id, new Set([c.id]))), undefined, true)
  if (item) pasos.push({ tipo: 'item', item: { ...item, conceptos: [c.id] }, repaso: false })
  return { tipo: 'aprender', titulo: `Aprender: ${c.nombre}`, pasos }
}
