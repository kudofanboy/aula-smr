import { describe, expect, it } from 'vitest'
import {
  alcanzables, construirRed, describirAveria, enviar,
} from '../src/motor/simred'

describe('construcción de redes', () => {
  it('estrella: un nodo central y un cable por equipo', () => {
    const red = construirRed({ topologia: 'estrella', centro: 'switch', equipos: 5 })
    expect(red.pcs).toEqual(['PC1', 'PC2', 'PC3', 'PC4', 'PC5'])
    expect(red.nodos).toHaveLength(6)
    expect(red.enlaces).toHaveLength(5)
  })

  it('bus: los terminadores cierran los extremos y el troncal va en tramos', () => {
    const red = construirRed({ topologia: 'bus', equipos: 5 })
    expect(red.nodos.filter((n) => n.tipo === 'terminador')).toHaveLength(2)
    expect(red.enlaces).toHaveLength(6)
    expect(red.enlaces.every((e) => e.troncal)).toBe(true)
  })

  it('anillo: cada equipo se une al siguiente y el último, al primero', () => {
    const red = construirRed({ topologia: 'anillo', equipos: 4 })
    expect(red.enlaces).toHaveLength(4)
    expect(red.enlaces.some((e) => e.a === 'PC4' && e.b === 'PC1')).toBe(true)
  })

  it('árbol: switch raíz, dos intermedios y los equipos repartidos', () => {
    const red = construirRed({ topologia: 'arbol', equipos: 4 })
    expect(red.nodos.some((n) => n.id === 'R')).toBe(true)
    expect(red.ramaDe).toEqual({ PC1: 'S1', PC2: 'S1', PC3: 'S2', PC4: 'S2' })
  })
})

describe('envío de una trama', () => {
  it('bus: la señal llega a todos los equipos y solo el destino la acepta', () => {
    const red = construirRed({ topologia: 'bus', equipos: 5 })
    const r = enviar(red, 'PC1', 'PC3')
    expect(r.lesLlega.sort()).toEqual(['PC2', 'PC3', 'PC4', 'PC5'])
    expect(r.acepta).toBe('PC3')
  })

  it('hub: repite por todos los puertos y llega a todos menos al emisor', () => {
    const red = construirRed({ topologia: 'estrella', centro: 'hub', equipos: 5 })
    const r = enviar(red, 'PC2', 'PC5')
    expect(r.lesLlega.sort()).toEqual(['PC1', 'PC3', 'PC4', 'PC5'])
    expect(r.acepta).toBe('PC5')
  })

  it('anillo: el mensaje recorre el anillo en un sentido hasta el destino', () => {
    const red = construirRed({ topologia: 'anillo', equipos: 5 })
    const r = enviar(red, 'PC1', 'PC3')
    expect(r.recorrido).toEqual(['PC2', 'PC3'])
    expect(r.lesLlega).toEqual(['PC2', 'PC3'])
  })

  it('switch sin la MAC del destino: inunda todos los puertos menos el de entrada', () => {
    const red = construirRed({ topologia: 'estrella', centro: 'switch', equipos: 5 })
    const r = enviar(red, 'PC1', 'PC3', {})
    expect(r.inundado).toBe(true)
    expect(r.lesLlega.sort()).toEqual(['PC2', 'PC3', 'PC4', 'PC5'])
    expect(r.tablaDespues?.PC1).toBe('PC1')
  })

  it('switch con la MAC aprendida: envía solo por el puerto del destino', () => {
    const red = construirRed({ topologia: 'estrella', centro: 'switch', equipos: 5 })
    const r = enviar(red, 'PC1', 'PC3', { PC3: 'PC3' })
    expect(r.inundado).toBe(false)
    expect(r.lesLlega).toEqual(['PC3'])
    expect(r.tablaDespues).toEqual({ PC3: 'PC3', PC1: 'PC1' })
  })

  it('no se puede enviar de un equipo a sí mismo', () => {
    const red = construirRed({ topologia: 'bus', equipos: 4 })
    expect(() => enviar(red, 'PC1', 'PC1')).toThrow()
  })

  it('en árbol el envío no está simulado en esta versión', () => {
    const red = construirRed({ topologia: 'arbol', equipos: 4 })
    expect(() => enviar(red, 'PC1', 'PC2')).toThrow()
  })
})

describe('averías: con quién puede seguir hablando un equipo', () => {
  it('estrella: un cable cortado solo deja fuera a ese equipo', () => {
    const red = construirRed({ topologia: 'estrella', centro: 'switch', equipos: 5 })
    expect(alcanzables(red, { tipo: 'cable-pc', pc: 'PC2' }, 'PC1').sort()).toEqual(['PC3', 'PC4', 'PC5'])
    expect(alcanzables(red, { tipo: 'cable-pc', pc: 'PC1' }, 'PC1')).toEqual([])
  })

  it('estrella: si cae el nodo central, cae toda la red', () => {
    const red = construirRed({ topologia: 'estrella', centro: 'hub', equipos: 5 })
    expect(alcanzables(red, { tipo: 'centro' }, 'PC1')).toEqual([])
  })

  it('bus: un corte en el troncal rompe la red entera', () => {
    const red = construirRed({ topologia: 'bus', equipos: 5 })
    expect(alcanzables(red, { tipo: 'troncal', tramo: 'B2' }, 'PC1')).toEqual([])
  })

  it('anillo: la avería de un nodo interrumpe el paso al resto', () => {
    const red = construirRed({ topologia: 'anillo', equipos: 5 })
    expect(alcanzables(red, { tipo: 'nodo-anillo', pc: 'PC2' }, 'PC1')).toEqual([])
  })

  it('árbol: la caída de un switch intermedio aísla solo su rama', () => {
    const red = construirRed({ topologia: 'arbol', equipos: 4 })
    expect(alcanzables(red, { tipo: 'switch', sw: 'S2' }, 'PC1')).toEqual(['PC2'])
    expect(alcanzables(red, { tipo: 'switch', sw: 'S1' }, 'PC1')).toEqual([])
  })

  it('árbol: si cae el switch raíz, cada rama sigue funcionando por dentro', () => {
    const red = construirRed({ topologia: 'arbol', equipos: 4 })
    expect(alcanzables(red, { tipo: 'switch', sw: 'R' }, 'PC1')).toEqual(['PC2'])
    expect(alcanzables(red, { tipo: 'switch', sw: 'R' }, 'PC3')).toEqual(['PC4'])
  })

  it('las averías se describen en español para los enunciados', () => {
    const red = construirRed({ topologia: 'estrella', centro: 'hub', equipos: 4 })
    expect(describirAveria(red, { tipo: 'cable-pc', pc: 'PC2' })).toBe('se corta el cable de PC2')
    expect(describirAveria(red, { tipo: 'centro' })).toBe('se avería el hub central')
  })
})
