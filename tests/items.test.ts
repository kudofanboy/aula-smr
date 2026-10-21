import { describe, expect, it } from 'vitest'
import type { Ejercicio, Generador } from '../src/contenido/esquema'
import { corregir, itemDeEjercicio, itemDeGenerador, motorDe, revisar, type Vista } from '../src/motor/items'

const fuente = { doc: 'temario', pag: 1 }

const test: Ejercicio = {
  id: 'e-test', motor: 'test', conceptos: ['c1'], dificultad: 1, fuente, verificado: true, origen: 'juego',
  explicacion: 'porque sí', enunciado: '¿cuál?', opciones: ['uno', 'dos', 'tres'], correcta: 1,
  por_opcion: ['', '', 'esta no'],
}

const ordenar: Ejercicio = {
  id: 'e-ordenar', motor: 'ordenar', conceptos: ['c1'], dificultad: 2, fuente, verificado: true, origen: 'juego',
  explicacion: 'porque no', enunciado: 'ordena', pasos: ['a', 'b', 'c', 'd'],
}

const emparejar: Ejercicio = {
  id: 'e-emparejar', motor: 'emparejar', conceptos: ['c1'], dificultad: 1, fuente, verificado: true, origen: 'juego',
  explicacion: 'porque tal', enunciado: 'empareja',
  pares: [
    { a: '1', b: 'uno' },
    { a: '2', b: 'dos' },
    { a: '3', b: 'tres' },
  ],
}

const generador: Generador = { tipo: 'red-identifica', conceptos: ['c1'], fuente }

describe('corrección de respuestas', () => {
  const vistaTest = { motor: 'test', enunciado: 'x', opciones: ['a', 'b'], correcta: 1 } as const

  it('test: solo la opción correcta', () => {
    expect(corregir(vistaTest, 1)).toBe(true)
    expect(corregir(vistaTest, 0)).toBe(false)
  })

  it('verdadero/falso', () => {
    expect(corregir({ motor: 'vf', afirmacion: 'x', verdadero: true }, true)).toBe(true)
    expect(corregir({ motor: 'vf', afirmacion: 'x', verdadero: true }, false)).toBe(false)
  })

  it('clasificar: todas las fichas en su caja', () => {
    const vista = {
      motor: 'clasificar',
      enunciado: 'x',
      categorias: [{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }],
      elementos: [{ texto: 'u', categoria: 'a' }, { texto: 'd', categoria: 'b' }],
    } as const
    expect(corregir(vista, { 0: 'a', 1: 'b' })).toBe(true)
    expect(corregir(vista, { 0: 'b', 1: 'a' })).toBe(false)
    expect(corregir(vista, { 0: 'a' })).toBe(false)
  })

  it('ordenar: la secuencia completa en su orden', () => {
    const vista = { motor: 'ordenar', enunciado: 'x', pasos: ['a', 'b'], inicial: ['b', 'a'] } as const
    expect(corregir(vista, ['a', 'b'])).toBe(true)
    expect(corregir(vista, ['b', 'a'])).toBe(false)
    expect(corregir(vista, ['a'])).toBe(false)
  })

  it('emparejar: cada término con su pareja', () => {
    const vista = {
      motor: 'emparejar',
      enunciado: 'x',
      pares: [{ a: '1', b: 'uno' }, { a: '2', b: 'dos' }],
      derecha: ['uno', 'dos'],
    } as const
    expect(corregir(vista, { 1: 'uno', 2: 'dos' })).toBe(true)
    expect(corregir(vista, { 1: 'dos', 2: 'uno' })).toBe(false)
  })

  it('nodos: exactamente los equipos correctos, ni uno más', () => {
    const vista = { motor: 'nodos', enunciado: 'x', escenario: { topologia: 'bus' }, candidatos: ['PC2', 'PC3'], correctas: ['PC2'] } as const
    expect(corregir(vista, ['PC2'])).toBe(true)
    expect(corregir(vista, ['PC2', 'PC3'])).toBe(false)
    expect(corregir(vista, [])).toBe(false)
  })
})

describe('revisión detallada de una respuesta (pantalla de resultados)', () => {
  const clasificar: Vista = {
    motor: 'clasificar', enunciado: 'x',
    categorias: [{ id: 'w', nombre: 'Windows' }, { id: 'l', nombre: 'Linux' }],
    elementos: [{ texto: 'NTFS', categoria: 'w' }, { texto: 'ext4', categoria: 'l' }, { texto: 'FAT32', categoria: 'w' }],
  }

  it('test: dice qué elegiste, cuál era la correcta y por qué falla tu opción', () => {
    const v: Vista = { motor: 'test', enunciado: 'x', opciones: ['Listo', 'Bloqueado'], correcta: 1, por_opcion: ['Listo espera la CPU, no un evento.', ''] }
    expect(revisar(v, 0)).toEqual({ motor: 'test', acierto: false, elegida: 'Listo', correcta: 'Bloqueado', porQue: 'Listo espera la CPU, no un evento.' })
    expect(revisar(v, 1)).toMatchObject({ acierto: true, elegida: 'Bloqueado', porQue: undefined })
  })

  it('verdadero/falso: lo elegido y lo correcto', () => {
    expect(revisar({ motor: 'vf', afirmacion: 'x', verdadero: false }, true)).toEqual({ motor: 'vf', acierto: false, elegida: true, correcta: false })
  })

  it('clasificar: cada ficha con dónde la pusiste y dónde va', () => {
    const r = revisar(clasificar, { 0: 'w', 1: 'w', 2: 'l' })
    expect(r).toEqual({
      motor: 'clasificar', acierto: false, elementos: [
        { texto: 'NTFS', puesta: 'Windows', correcta: 'Windows', bien: true },
        { texto: 'ext4', puesta: 'Windows', correcta: 'Linux', bien: false },
        { texto: 'FAT32', puesta: 'Linux', correcta: 'Windows', bien: false },
      ],
    })
  })

  it('emparejar: cada pareja con la elegida y la correcta', () => {
    const v: Vista = { motor: 'emparejar', enunciado: 'x', pares: [{ a: 'HTTP', b: '80' }, { a: 'FTP', b: '21' }], derecha: ['21', '80'] }
    expect(revisar(v, { HTTP: '21', FTP: '80' })).toMatchObject({ acierto: false, pares: [
      { a: 'HTTP', elegida: '21', correcta: '80', bien: false },
      { a: 'FTP', elegida: '80', correcta: '21', bien: false },
    ] })
  })

  it('ordenar: qué pasos quedaron en su sitio', () => {
    const v: Vista = { motor: 'ordenar', enunciado: 'x', pasos: ['a', 'b', 'c'], inicial: ['c', 'b', 'a'] }
    expect(revisar(v, ['c', 'b', 'a'])).toEqual({ motor: 'ordenar', acierto: false, correcto: ['a', 'b', 'c'],
      tuyo: [{ texto: 'c', bien: false }, { texto: 'b', bien: true }, { texto: 'a', bien: false }] })
  })

  it('nodos: los que sobran y los que faltan', () => {
    const v: Vista = { motor: 'nodos', enunciado: 'x', escenario: { topologia: 'estrella', centro: 'hub', equipos: 4 }, candidatos: ['PC2', 'PC3', 'PC4'], correctas: ['PC2', 'PC3'] }
    expect(revisar(v, ['PC4', 'PC2'])).toEqual({ motor: 'nodos', acierto: false, correctas: ['PC2', 'PC3'], faltan: ['PC3'],
      marcados: [{ id: 'PC2', bien: true }, { id: 'PC4', bien: false }] })
  })

  it('sin responder (examen terminado por tiempo): todo cuenta como fallo y no inventa una respuesta', () => {
    expect(revisar(clasificar, undefined)).toMatchObject({ acierto: false })
    expect(revisar({ motor: 'test', enunciado: 'x', opciones: ['a', 'b'], correcta: 0 }, undefined)).toMatchObject({ acierto: false, elegida: undefined })
    expect(revisar({ motor: 'vf', afirmacion: 'x', verdadero: false }, undefined)).toMatchObject({ acierto: false, elegida: undefined })
  })

  it('el veredicto coincide siempre con corregir', () => {
    const casos: [Vista, unknown][] = [[clasificar, { 0: 'w', 1: 'l', 2: 'w' }], [clasificar, { 0: 'w', 1: 'l' }], [clasificar, {}]]
    for (const [v, r] of casos) expect(revisar(v, r).acierto).toBe(corregir(v, r))
  })
})

describe('preparación de ejercicios para jugar', () => {
  it('test: baraja las opciones pero la correcta sigue apuntando al mismo texto', () => {
    for (let i = 0; i < 20; i++) {
      const item = itemDeEjercicio(test, 'u1')
      if (item.vista.motor !== 'test') throw new Error('motor inesperado')
      expect(item.vista.opciones[item.vista.correcta]).toBe('dos')
      expect([...item.vista.opciones].sort()).toEqual(['dos', 'tres', 'uno'])
    }
  })

  it('test: el motivo por el que falla cada opción viaja con ella', () => {
    const item = itemDeEjercicio(test, 'u1')
    if (item.vista.motor !== 'test') throw new Error('motor inesperado')
    const posTres = item.vista.opciones.indexOf('tres')
    expect(item.vista.por_opcion?.[posTres]).toBe('esta no')
  })

  it('ordenar: los pasos llegan desordenados pero completos', () => {
    const item = itemDeEjercicio(ordenar, 'u1')
    if (item.vista.motor !== 'ordenar') throw new Error('motor inesperado')
    expect([...item.vista.inicial].sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(item.vista.inicial.join('|')).not.toBe('a|b|c|d')
    expect(item.vista.pasos).toEqual(['a', 'b', 'c', 'd'])
  })

  it('emparejar: la columna derecha es la misma lista de definiciones, barajada', () => {
    const item = itemDeEjercicio(emparejar, 'u1')
    if (item.vista.motor !== 'emparejar') throw new Error('motor inesperado')
    expect([...item.vista.derecha].sort()).toEqual(['dos', 'tres', 'uno'])
  })

  it('el motor lógico sirve para no repetir la misma forma de preguntar', () => {
    expect(motorDe(itemDeEjercicio(test, 'u1'))).toBe('test')
    expect(motorDe(itemDeGenerador(generador, 'u1'))).toBe('gen:red-identifica')
  })
})

describe('generadores', () => {
  it('identificar la topología: la respuesta correcta es la que se dibuja', () => {
    const nombres = { bus: 'Bus', estrella: 'Estrella', anillo: 'Anillo', arbol: 'Árbol' } as const
    for (let i = 0; i < 10; i++) {
      const item = itemDeGenerador(generador, 'u1')
      if (item.vista.motor !== 'test') throw new Error('motor inesperado')
      const visual = item.vista.visual
      if (visual?.tipo !== 'topologia') throw new Error('falta el dibujo')
      expect(item.vista.opciones[item.vista.correcta]).toBe(nombres[visual.escenario.topologia])
    }
  })
})
