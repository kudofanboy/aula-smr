import { describe, expect, it } from 'vitest'
import type { Vista } from '../src/motor/items'
import { estrellas, nota, puntosRespuesta, tiempoObjetivo, xpRespuesta } from '../src/motor/puntuacion'

const vistaTest: Vista = { motor: 'test', enunciado: 'x', opciones: ['a', 'b'], correcta: 0 }

describe('puntuación de partidas', () => {
  it('las estrellas dependen solo de la precisión (95 %, 80 % y 60 %)', () => {
    expect(estrellas(10, 10)).toBe(3)
    expect(estrellas(19, 20)).toBe(3)
    expect(estrellas(9, 10)).toBe(2)
    expect(estrellas(16, 20)).toBe(2)
    expect(estrellas(7, 10)).toBe(1)
    expect(estrellas(12, 20)).toBe(1)
    expect(estrellas(5, 10)).toBe(0)
    expect(estrellas(0, 0)).toBe(0)
  })

  it('la nota de examen es sobre 10 con un decimal, como las reales', () => {
    expect(nota(8, 10)).toBe(8)
    expect(nota(7, 8)).toBe(8.8)
    expect(nota(1, 3)).toBe(3.3)
    expect(nota(0, 0)).toBe(0)
  })

  it('los puntos suben con dificultad, combo y rapidez; la rapidez tiene tope', () => {
    const base = { acierto: true, segundos: 20, objetivo: 20, dificultad: 1 }
    expect(puntosRespuesta(base, 0)).toBe(100)
    expect(puntosRespuesta({ ...base, dificultad: 3 }, 0)).toBe(300)
    expect(puntosRespuesta(base, 5)).toBe(150)
    expect(puntosRespuesta(base, 50)).toBe(150)
    expect(puntosRespuesta({ ...base, segundos: 0 }, 0)).toBe(120)
    expect(puntosRespuesta({ ...base, segundos: 21 }, 0)).toBe(100)
    expect(puntosRespuesta({ ...base, acierto: false }, 5)).toBe(0)
  })

  it('el tiempo objetivo crece con lo que hay que manipular', () => {
    expect(tiempoObjetivo({ motor: 'vf', afirmacion: 'x', verdadero: true })).toBe(12)
    expect(tiempoObjetivo(vistaTest)).toBe(20)
    expect(tiempoObjetivo({ motor: 'ordenar', enunciado: 'x', pasos: ['a', 'b', 'c'], inicial: ['b', 'a', 'c'] })).toBe(10 + 3 * 6)
    expect(
      tiempoObjetivo({
        motor: 'emparejar',
        enunciado: 'x',
        pares: [
          { a: '1', b: 'uno' },
          { a: '2', b: 'dos' },
          { a: '3', b: 'tres' },
        ],
        derecha: ['uno', 'dos', 'tres'],
      }),
    ).toBe(10 + 3 * 6)
  })

  it('acertar da 5 XP por dificultad; intentarlo da 1 XP', () => {
    expect(xpRespuesta(true, 1)).toBe(5)
    expect(xpRespuesta(true, 3)).toBe(15)
    expect(xpRespuesta(false, 3)).toBe(1)
  })
})
