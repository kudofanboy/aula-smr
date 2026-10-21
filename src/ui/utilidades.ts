import type { CSSProperties } from 'react'
import type { Curso } from '../contenido/esquema'
import { useTienda } from '../estado/tienda'
import { DOMINADO, hoy, nivel } from '../motor/progreso'
export { diasHasta } from '../motor/practica'

export type Modulo = Curso['modulos'][number]

/** Estilo que da a un bloque el color de su asignatura (las reglas CSS usan --h). */
export function colorModulo(m?: Pick<Modulo, 'tono'>): CSSProperties {
  return { '--h': m?.tono ?? 250 } as CSSProperties
}

export function useModulo(id?: string): Modulo | undefined {
  const curso = useTienda((s) => s.curso)
  return curso?.modulos.find((m) => m.id === id)
}

export function useDominados(): number {
  const { progreso, indice } = useTienda()
  return Object.entries(progreso.conceptos).filter(([id, e]) => indice?.concepto.has(id) && nivel(e) >= DOMINADO).length
}

export const textoDias = (d: number) => (d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`)

export function fechaDeHoy(): string {
  return new Date(`${hoy()}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}
