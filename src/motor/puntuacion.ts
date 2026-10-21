// Puntuación de partidas. La precisión pesa siempre más que la velocidad (bonus de velocidad con tope).
import type { Vista } from './items'

/** Tiempo objetivo en segundos para responder, según el tipo de ejercicio. */
export function tiempoObjetivo(v: Vista): number {
  switch (v.motor) {
    case 'vf':
      return 12
    case 'test':
      return 20
    case 'nodos':
      return 30
    case 'ordenar':
      return 10 + v.pasos.length * 6
    case 'emparejar':
      return 10 + v.pares.length * 6
    case 'clasificar':
      return 10 + v.elementos.length * 5
  }
}

export interface Golpe {
  acierto: boolean
  segundos: number
  objetivo: number
  dificultad: number
}

/** Puntos de una respuesta dada la racha de aciertos previa (combo). */
export function puntosRespuesta(g: Golpe, comboPrevio: number): number {
  if (!g.acierto) return 0
  const base = 100 * g.dificultad
  const combo = 1 + 0.1 * Math.min(comboPrevio, 5) // hasta +50 %
  const rapidez = g.segundos <= g.objetivo ? 0.2 * (1 - g.segundos / g.objetivo) : 0 // hasta +20 %
  return Math.round(base * combo * (1 + rapidez))
}

/** Estrellas por porcentaje de aciertos: la velocidad no da estrellas. */
export function estrellas(aciertos: number, total: number): number {
  if (total === 0) return 0
  const p = aciertos / total
  if (p >= 0.95) return 3
  if (p >= 0.8) return 2
  if (p >= 0.6) return 1
  return 0
}

/** Nota sobre 10 (exámenes), con un decimal. */
export function nota(aciertos: number, total: number): number {
  return total === 0 ? 0 : Math.round((aciertos / total) * 100) / 10
}

/** XP y sueldo que da una respuesta: solo se gana por acertar. */
export function xpRespuesta(acierto: boolean, dificultad: number): number {
  return acierto ? 5 * dificultad : 1 // 1 XP por intentarlo: equivocarse forma parte de aprender
}
