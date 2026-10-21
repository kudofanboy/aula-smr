import { describe, expect, it } from 'vitest'
import { Rating, State } from 'ts-fsrs'
import {
  actualizarRacha, estadoNuevo, migrar, nivel, notaFsrs, rango, repasar, retencion, VERSION_PROGRESO, vencido,
} from '../src/motor/progreso'

describe('nota para el repaso espaciado (FSRS)', () => {
  it('fallar es Again; acertar rápido, Easy; acertar lento, Hard; el resto, Good', () => {
    expect(notaFsrs(false, 5, 20)).toBe(Rating.Again)
    expect(notaFsrs(true, 5, 20)).toBe(Rating.Easy)
    expect(notaFsrs(true, 45, 20)).toBe(Rating.Hard)
    expect(notaFsrs(true, 15, 20)).toBe(Rating.Good)
  })
})

describe('racha diaria con comodín semanal', () => {
  it('sube al jugar en días consecutivos y guarda el mejor registro', () => {
    let r = actualizarRacha({ actual: 0, mejor: 0 }, '2026-09-28')
    expect(r.actual).toBe(1)
    r = actualizarRacha(r, '2026-09-29')
    expect(r.actual).toBe(2)
    r = actualizarRacha(r, '2026-09-30')
    expect(r.actual).toBe(3)
    expect(r.mejor).toBe(3)
  })

  it('el mismo día no cambia la racha', () => {
    const r = actualizarRacha({ actual: 3, mejor: 3, ultimoDia: '2026-09-30' }, '2026-09-30')
    expect(r.actual).toBe(3)
  })

  it('un día perdido se cubre con el comodín una sola vez por semana', () => {
    let r = actualizarRacha({ actual: 3, mejor: 3, ultimoDia: '2026-09-28' }, '2026-09-30')
    expect(r.actual).toBe(4)
    expect(r.comodinUsadoSemana).toBe('2026-09-28')
    r = actualizarRacha(r, '2026-10-02')
    expect(r.actual).toBe(1)
  })

  it('un hueco mayor de dos días reinicia la racha', () => {
    const r = actualizarRacha({ actual: 9, mejor: 9, ultimoDia: '2026-09-01' }, '2026-09-05')
    expect(r.actual).toBe(1)
    expect(r.mejor).toBe(9)
  })
})

describe('avance de un concepto', () => {
  const base = estadoNuevo()

  it('sin descubrir es nivel 0; recién descubierto, nivel 1', () => {
    expect(nivel(undefined)).toBe(0)
    expect(nivel(base)).toBe(0)
    expect(nivel({ ...base, descubierto: '2026-09-30' })).toBe(1)
  })

  it('los niveles 2-5 se alcanzan con estabilidad creciente', () => {
    const conEstabilidad = (stability: number) => ({
      ...base,
      descubierto: '2026-09-30',
      diasAcierto: ['2026-09-30', '2026-10-01'],
      tarjeta: { ...base.tarjeta, state: State.Review, stability },
    })
    expect(nivel(conEstabilidad(3))).toBe(2)
    expect(nivel(conEstabilidad(10))).toBe(3)
    expect(nivel(conEstabilidad(30))).toBe(4)
    expect(nivel(conEstabilidad(100))).toBe(5)
  })

  it('un concepto nuevo no está vencido y no tiene retención estimada', () => {
    expect(vencido(base)).toBe(false)
    expect(retencion(base)).toBe(0)
  })

  it('repetir aciertos el mismo día no da dominio, aunque FSRS estime estabilidad alta', () => {
    let e = { ...estadoNuevo(), descubierto: '2026-10-01' }
    e = repasar(e, Rating.Easy, new Date('2026-10-01T12:00:00')) as typeof e
    e = repasar(e, Rating.Easy, new Date('2026-10-01T12:05:00')) as typeof e
    expect(e.diasAcierto).toEqual(['2026-10-01'])
    expect(nivel({ ...e, tarjeta: { ...e.tarjeta, state: State.Review, stability: 30 } })).toBe(2)
    e = repasar(e, Rating.Good, new Date('2026-10-02T12:00:00')) as typeof e
    expect(e.diasAcierto).toHaveLength(2)
    expect(nivel({ ...e, tarjeta: { ...e.tarjeta, state: State.Review, stability: 30 } })).toBe(4)
  })

  it('un concepto de repaso con la fecha pasada está vencido', () => {
    const vencida = {
      ...base,
      tarjeta: { ...base.tarjeta, state: State.Review, due: new Date(Date.now() - 86_400_000).toISOString() },
    }
    expect(vencido(vencida)).toBe(true)
  })
})

describe('niveles', () => {
  it('suben con los conceptos dominados', () => {
    expect(rango(0).actual.nombre).toBe('Nivel 1')
    expect(rango(14).actual.nombre).toBe('Nivel 1')
    expect(rango(15).actual.nombre).toBe('Nivel 2')
    expect(rango(40).actual.nombre).toBe('Nivel 3')
    expect(rango(80).actual.nombre).toBe('Nivel 4')
    expect(rango(0).siguiente?.nombre).toBe('Nivel 2')
    expect(rango(80).siguiente).toBeUndefined()
  })
})

describe('migración de progreso guardado', () => {
  it('rellena los campos que falten sin tocar los que ya están', () => {
    const p = migrar({ xp: 25 })
    expect(p.xp).toBe(25)
    expect(p.version).toBe(VERSION_PROGRESO)
    expect(p.ajustes.sonido).toBe(true)
    expect(p.racha.actual).toBe(0)
    expect(migrar(null).xp).toBe(0)
  })
})
