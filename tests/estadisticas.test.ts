import { describe, expect, it } from 'vitest'
import type { Unidad } from '../src/contenido/esquema'
import { actividadSemana, masFallados, menosTocada, semanaXp, ultimosDias } from '../src/motor/estadisticas'
import { estadoNuevo, migrar } from '../src/motor/progreso'
import { indexar } from '../src/motor/sesiones'

const concepto = (id: string) => ({ id, nombre: id, verificado: true, requiere: [] }) as unknown as Unidad['conceptos'][number]
const unidad = (id: string, modulo: string, conceptos: string[]) =>
  ({ id, modulo, codigo: id, titulo: id, orden: 1, fuentes: [], conceptos: conceptos.map(concepto), ejercicios: [], generadores: [], juegos: [] }) as unknown as Unidad

const ix = indexar([unidad('R1', 'REDES', ['a', 'b']), unidad('S1', 'SOM', ['c'])])
const ahora = new Date('2026-10-05T12:00:00')

describe('estadísticas del panel', () => {
  it('ultimosDias devuelve 7 días terminando hoy', () => {
    const d = ultimosDias(7, ahora)
    expect(d).toHaveLength(7)
    expect(d[6]).toBe('2026-10-05')
    expect(d[0]).toBe('2026-09-29')
  })

  it('la actividad de la semana ignora días de hace más de 7 días', () => {
    const p = { ...migrar(null), actividad: { '2026-10-04': { REDES: 3 }, '2026-09-20': { SOM: 9 } } }
    expect(actividadSemana(p, ['REDES', 'SOM'], ahora)).toEqual({ REDES: 3, SOM: 0 })
    expect(menosTocada(ix, p, ahora)).toEqual({ modulo: 'SOM', ejercicios: 0 })
  })

  it('masFallados exige al menos dos respuestas y un tercio de fallos', () => {
    const e = (aciertos: number, fallos: number) => ({ ...estadoNuevo(), descubierto: '2026-10-01', aciertos, fallos })
    const p = { ...migrar(null), conceptos: { a: e(1, 3), b: e(0, 1), c: e(5, 1) } }
    expect(masFallados(ix, p, 3, ahora).map((d) => d.id)).toEqual(['a'])
  })

  it('semanaXp rellena con 0 los días sin juego', () => {
    const p = { ...migrar(null), xpDia: { '2026-10-05': 30 } }
    const s = semanaXp(p, ahora)
    expect(s.at(-1)).toEqual({ dia: '2026-10-05', xp: 30 })
    expect(s[0].xp).toBe(0)
  })
})
