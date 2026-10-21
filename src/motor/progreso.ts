// Progreso del jugador y repaso espaciado (FSRS). Se guarda en datos/progreso.json a través del servidor.
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'
import type { EstadoLaboratorio } from './laboratorio'

export const VERSION_PROGRESO = 1

/** Tarjeta FSRS serializable (fechas como texto ISO). */
export interface TarjetaGuardada {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: State
  last_review?: string
}

export interface EstadoConcepto {
  tarjeta: TarjetaGuardada
  /** Fecha (AAAA-MM-DD) en que se descubrió. */
  descubierto?: string
  aciertos: number
  fallos: number
  /** Días distintos con acierto en repaso; repetir hoy no demuestra recuerdo mañana. */
  diasAcierto?: string[]
  /** Último motor usado al repasarlo, para variar la forma de preguntar. */
  ultimoMotor?: string
  /** Última comprobación inmediata; distinta del recuerdo que estima FSRS. */
  aplicacion?: { estado: 'pendiente' | 'con-ayuda' | 'sin-ayuda'; fecha: string }
}

export interface Partida {
  fecha: string
  puntos: number
  estrellas: number
  aciertos: number
  total: number
  nota?: number
}

export interface EstadoJuego {
  mejor: number
  mejorEstrellas: number
  mejorNota?: number
  historial: Partida[]
}

export interface EstadoEncargo {
  recibido: string
  leido: boolean
  /** Índices de las opciones elegidas, en orden. Se guardan al decidir. */
  respuestas: number[]
  /** Preparación del taller por paso; todavía no es una respuesta ni concede premio. */
  borradores?: Record<string, number>
  completado?: string
  /** Entregado sin XP ni sueldo porque ya se cobró otra versión del mismo caso. */
  sinPremio?: boolean
}

export interface Progreso {
  version: number
  creado: string
  conceptos: Record<string, EstadoConcepto>
  juegos: Record<string, EstadoJuego>
  xp: number
  sueldo: number
  racha: { actual: number; mejor: number; ultimoDia?: string; comodinUsadoSemana?: string }
  /** Días (AAAA-MM-DD) con turno completado. */
  turnos: Record<string, { xp: number; items: number; aciertos: number }>
  /** Ejercicios retirados por un informe de error, hasta que Claude los revise. */
  ocultos: string[]
  /** Nombre que el jugador eligió al empezar (vacío hasta entonces). */
  nombre: string
  /** Avatar elegido (sin elegir hasta que lo escoge). */
  avatar?: 'chica' | 'chico'
  /** Respuestas por día y asignatura: {'2026-10-01': {REDES: 5}}. Solo los últimos 60 días. */
  actividad: Record<string, Record<string, number>>
  /** XP ganada cada día (AAAA-MM-DD), para el objetivo diario. */
  xpDia: Record<string, number>
  /** Encargos reales marcados como hechos. */
  encargosHechos: string[]
  /** Encargos ficticios de clientes; separados de las tareas reales de la agenda. */
  encargos: Record<string, EstadoEncargo>
  ultimoEncargoDia?: string
  /** Notas de los simulacros de examen por asignatura (últimos 20). */
  simulacros?: Record<string, { fecha: string; nota: number; aciertos: number; total: number }[]>
  /** Muestras locales de práctica; no son notas ni certificados de competencia. */
  evidencias?: EvidenciaAprendizaje[]
  laboratorios?: Record<string, EstadoLaboratorio>
  ajustes: { sonido: boolean; tema: 'auto' | 'claro' | 'oscuro'; guiaVista?: boolean; animaciones?: boolean; tamano?: 'normal' | 'grande' }
}

export interface EvidenciaAprendizaje {
  fecha: string
  tipo: 'practica' | 'recuperacion' | 'caso'
  unidadId: string
  conceptos: string[]
  actividad: string
  acierto: boolean
  ayudas: number
  detalle: string
}

/** Conserva una muestra acotada y deja intacto el calendario de recuerdo. */
export function registrarEvidencia(p: Progreso, e: EvidenciaAprendizaje): Progreso {
  const conceptos = { ...p.conceptos }
  if (e.tipo !== 'caso') for (const id of e.conceptos) {
    const actual = conceptos[id]
    if (actual?.descubierto) conceptos[id] = { ...actual, aplicacion: {
      estado: !e.acierto ? 'pendiente' : e.ayudas > 0 ? 'con-ayuda' : 'sin-ayuda', fecha: e.fecha,
    } }
  }
  return { ...p, conceptos, evidencias: [...(p.evidencias ?? []), e].slice(-200) }
}

export function progresoVacio(): Progreso {
  return {
    version: VERSION_PROGRESO,
    creado: new Date().toISOString(),
    conceptos: {},
    juegos: {},
    xp: 0,
    sueldo: 0,
    racha: { actual: 0, mejor: 0 },
    turnos: {},
    ocultos: [],
    encargosHechos: [],
    encargos: {},
    xpDia: {},
    nombre: '',
    actividad: {},
    ajustes: { sonido: true, tema: 'auto' },
  }
}

/** Completa campos que falten en progresos guardados por versiones anteriores. */
export function migrar(p: Partial<Progreso> | null): Progreso {
  const base = progresoVacio()
  if (!p) return base
  return { ...base, ...p, racha: { ...base.racha, ...p.racha }, ajustes: { ...base.ajustes, ...p.ajustes }, version: VERSION_PROGRESO }
}

// Retención objetivo 0,90 (valor por defecto de FSRS). Fuzz activado para que los repasos no se amontonen el mismo día.
const planificador = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }))

export function aTarjeta(t: TarjetaGuardada): Card {
  return { ...t, due: new Date(t.due), last_review: t.last_review ? new Date(t.last_review) : undefined }
}

function guardarTarjeta(c: Card): TarjetaGuardada {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review?.toISOString(),
  }
}

export function estadoNuevo(ahora = new Date()): EstadoConcepto {
  return { tarjeta: guardarTarjeta(createEmptyCard(ahora)), aciertos: 0, fallos: 0, diasAcierto: [] }
}

/**
 * Nota FSRS a partir de la respuesta.
 * Fallo = Again. Acierto lento (más del doble del tiempo objetivo) = Hard.
 * Acierto muy rápido (menos del 40 % del objetivo) = Easy. Resto = Good.
 */
export function notaFsrs(acierto: boolean, segundos: number, objetivo: number): Grade {
  if (!acierto) return Rating.Again
  if (segundos > objetivo * 2) return Rating.Hard
  if (segundos < objetivo * 0.4) return Rating.Easy
  return Rating.Good
}

export function repasar(e: EstadoConcepto, nota: Grade, ahora = new Date()): EstadoConcepto {
  const r = planificador.next(aTarjeta(e.tarjeta), ahora, nota)
  return {
    ...e,
    tarjeta: guardarTarjeta(r.card),
    aciertos: e.aciertos + (nota === Rating.Again ? 0 : 1),
    fallos: e.fallos + (nota === Rating.Again ? 1 : 0),
    diasAcierto: [...new Set([...(e.diasAcierto ?? []), ...(nota === Rating.Again ? [] : [hoy(ahora)])])].sort().slice(-60),
  }
}

export function retencion(e: EstadoConcepto, ahora = new Date()): number {
  if (e.tarjeta.state === State.New) return 0
  return planificador.get_retrievability(aTarjeta(e.tarjeta), ahora, false)
}

export function vencido(e: EstadoConcepto, ahora = new Date()): boolean {
  return e.tarjeta.state !== State.New && new Date(e.tarjeta.due) <= ahora
}

/**
 * Nivel de dominio 0-5:
 * 0 sin descubrir · 1 aprendiendo · 2 estabilidad < 7 días · 3 < 21 días · 4 < 60 días · 5 ≥ 60 días.
 * "Dominado" = nivel 3 o más: solo se alcanza acertando en repasos separados en el tiempo.
 */
export function nivel(e: EstadoConcepto | undefined): number {
  if (!e || !e.descubierto) return 0
  const t = e.tarjeta
  if (t.state === State.New || t.state === State.Learning || t.state === State.Relearning) return 1
  // Los progresos anteriores no registraban los días: conservan su nivel hasta el próximo repaso.
  if (e.diasAcierto && e.diasAcierto.length < 2) return 2
  if (t.stability < 7) return 2
  if (t.stability < 21) return 3
  if (t.stability < 60) return 4
  return 5
}

export const DOMINADO = 3

export function hoy(d = new Date()): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Lunes de la semana (AAAA-MM-DD), para el comodín semanal de la racha. */
function semanaDe(dia: string): string {
  const d = new Date(dia + 'T12:00:00')
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return hoy(d)
}

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000)
}

/** Actualiza la racha al completar el turno de hoy. Un comodín por semana cubre un único día perdido. */
export function actualizarRacha(r: Progreso['racha'], dia = hoy()): Progreso['racha'] {
  if (r.ultimoDia === dia) return r
  let actual = 1
  let comodinUsadoSemana = r.comodinUsadoSemana
  if (r.ultimoDia) {
    const hueco = diasEntre(r.ultimoDia, dia)
    if (hueco === 1) actual = r.actual + 1
    else if (hueco === 2 && comodinUsadoSemana !== semanaDe(dia)) {
      actual = r.actual + 1
      comodinUsadoSemana = semanaDe(dia)
    }
  }
  return { actual, mejor: Math.max(r.mejor, actual), ultimoDia: dia, comodinUsadoSemana }
}

/** XP diaria que cuenta como "objetivo cumplido" (un turno normal da unos 30-50). */
export const META_XP_DIA = 40

export const RANGOS = [
  { nombre: 'Nivel 1', dominados: 0 },
  { nombre: 'Nivel 2', dominados: 15 },
  { nombre: 'Nivel 3', dominados: 40 },
  { nombre: 'Nivel 4', dominados: 80 },
] as const

export function rango(dominados: number) {
  let actual: (typeof RANGOS)[number] = RANGOS[0]
  let siguiente: (typeof RANGOS)[number] | undefined
  for (const r of RANGOS) {
    if (dominados >= r.dominados) actual = r
    else if (!siguiente) siguiente = r
  }
  return { actual, siguiente }
}
