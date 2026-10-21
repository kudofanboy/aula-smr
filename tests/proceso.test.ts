import { describe, expect, it } from 'vitest'
import { ESTADOS, esValida, NOMBRE_ESTADO, TRANSICIONES } from '../src/motor/proceso'

describe('estados de un proceso del modelo simplificado', () => {
  it('admite las transiciones del diagrama', () => {
    expect(esValida('nuevo', 'listo')).toBe(true)
    expect(esValida('listo', 'ejecucion')).toBe(true)
    expect(esValida('ejecucion', 'listo')).toBe(true)
    expect(esValida('ejecucion', 'bloqueado')).toBe(true)
    expect(esValida('bloqueado', 'listo')).toBe(true)
    expect(esValida('ejecucion', 'terminado')).toBe(true)
  })

  it('a Terminado solo se llega desde En ejecución', () => {
    for (const estado of ESTADOS) {
      expect(esValida(estado, 'terminado')).toBe(estado === 'ejecucion')
    }
  })

  it('rechaza transiciones que no están en el diagrama', () => {
    expect(esValida('listo', 'terminado')).toBe(false)
    expect(esValida('listo', 'bloqueado')).toBe(false)
    expect(esValida('bloqueado', 'ejecucion')).toBe(false)
    expect(esValida('bloqueado', 'terminado')).toBe(false)
    expect(esValida('nuevo', 'ejecucion')).toBe(false)
    expect(esValida('terminado', 'listo')).toBe(false)
  })

  it('cada estado tiene nombre y cada transición, al menos un evento que la provoca', () => {
    for (const estado of ESTADOS) expect(NOMBRE_ESTADO[estado]).toBeTruthy()
    for (const t of TRANSICIONES) {
      expect(ESTADOS).toContain(t.de)
      expect(ESTADOS).toContain(t.a)
      expect(t.eventos.length).toBeGreaterThan(0)
    }
  })
})
