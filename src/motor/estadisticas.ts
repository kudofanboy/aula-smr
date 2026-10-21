// Datos del panel personal: qué has tocado esta semana, dónde fallas, qué dominas y cómo va tu semana.
import { DOMINADO, hoy, nivel, retencion, vencido, type Progreso } from './progreso'
import type { Indice } from './sesiones'

/** Los últimos `n` días (AAAA-MM-DD), del más antiguo a hoy. */
export function ultimosDias(n: number, ahora = new Date()): string[] {
  const res: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ahora)
    d.setDate(d.getDate() - i)
    res.push(hoy(d))
  }
  return res
}

/** Ejercicios respondidos esta semana (7 días) en cada asignatura con temario. */
export function actividadSemana(p: Progreso, modulos: string[], ahora = new Date()): Record<string, number> {
  const res = Object.fromEntries(modulos.map((m) => [m, 0]))
  for (const d of ultimosDias(7, ahora)) for (const [m, n] of Object.entries(p.actividad[d] ?? {})) if (m in res) res[m] += n
  return res
}

/** Asignatura menos practicada esta semana (en empate, la que menos conceptos tiene descubiertos). */
export function menosTocada(ix: Indice, p: Progreso, ahora = new Date()): { modulo: string; ejercicios: number } | undefined {
  const modulos = [...new Set(ix.unidades.map((u) => u.modulo))]
  if (modulos.length === 0) return undefined
  const act = actividadSemana(p, modulos, ahora)
  const vistos = (m: string) => ix.unidades.filter((u) => u.modulo === m).flatMap((u) => u.conceptos).filter((c) => p.conceptos[c.id]?.descubierto).length
  const m = [...modulos].sort((a, b) => act[a] - act[b] || vistos(a) - vistos(b))[0]
  return { modulo: m, ejercicios: act[m] }
}

export interface DatoConcepto {
  id: string
  nombre: string
  unidadId: string
  modulo: string
  aciertos: number
  fallos: number
  /** Proporción de fallos (0-1). */
  tasaFallo: number
  nivel: number
  retencion: number
}

function datos(ix: Indice, p: Progreso, ahora: Date): DatoConcepto[] {
  const res: DatoConcepto[] = []
  for (const [id, { concepto, unidad }] of ix.concepto) {
    const e = p.conceptos[id]
    if (!e?.descubierto) continue
    const total = e.aciertos + e.fallos
    res.push({
      id, nombre: concepto.nombre, unidadId: unidad.id, modulo: unidad.modulo, aciertos: e.aciertos, fallos: e.fallos,
      tasaFallo: total ? e.fallos / total : 0, nivel: nivel(e), retencion: retencion(e, ahora),
    })
  }
  return res
}

/** Conceptos en los que más fallas (al menos 2 fallos y un tercio de las respuestas). */
export function masFallados(ix: Indice, p: Progreso, n = 3, ahora = new Date()): DatoConcepto[] {
  return datos(ix, p, ahora)
    .filter((d) => d.fallos >= 2 && d.tasaFallo >= 1 / 3)
    .sort((a, b) => b.tasaFallo - a.tasaFallo || b.fallos - a.fallos)
    .slice(0, n)
}

/** Conceptos dominados, los más sólidos primero. */
export function dominados(ix: Indice, p: Progreso, ahora = new Date()): DatoConcepto[] {
  return datos(ix, p, ahora).filter((d) => d.nivel >= DOMINADO).sort((a, b) => b.nivel - a.nivel || b.retencion - a.retencion)
}

/** Conceptos descubiertos que ya toca repasar. */
export function pendientesRepaso(ix: Indice, p: Progreso, ahora = new Date()): number {
  return [...ix.concepto.keys()].filter((id) => p.conceptos[id]?.descubierto && vencido(p.conceptos[id], ahora)).length
}

/** XP de cada uno de los últimos 7 días. */
export function semanaXp(p: Progreso, ahora = new Date()): { dia: string; xp: number }[] {
  return ultimosDias(7, ahora).map((dia) => ({ dia, xp: p.xpDia[dia] ?? 0 }))
}
