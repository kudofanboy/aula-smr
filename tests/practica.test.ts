import { describe, expect, it } from 'vitest'
import type { Concepto, EventoCalendario, Ejercicio, Unidad } from '../src/contenido/esquema'
import { construirPractica, construirSimulacro, examenesProximos, generarInforme, preparacion, SEGUNDOS_POR_PREGUNTA } from '../src/motor/practica'
import { estadoNuevo, progresoVacio } from '../src/motor/progreso'
import { indexar } from '../src/motor/sesiones'

const fuente = { doc: 'tema', pag: 1 }

const concepto = (id: string): Concepto => ({
  id, nombre: id.toUpperCase(), fuente, nivel_verdad: 'temario', requiere: [], verificado: true,
  descubrir: [{ tipo: 'prediccion', pregunta: '¿?', opciones: ['Sí', 'No'], correcta: 0, revelacion: 'Sí.' }],
})

const ejercicio = (id: string, c: string, origen: 'juego' | 'profesor' = 'juego'): Ejercicio => ({
  id, motor: 'test', conceptos: [c], dificultad: 1, fuente, verificado: true, origen, explicacion: 'Porque sí.', enunciado: '¿?', opciones: ['Sí', 'No'], correcta: 0,
})

function unidad(): Unidad {
  const ids = ['c1', 'c2', 'c3', 'c4']
  return {
    id: 'u1', modulo: 'REDES', codigo: 'UD1', titulo: 'Unidad', orden: 1,
    fuentes: [{ id: 'tema', titulo: 'Tema', ruta: 'tema.pdf' }],
    conceptos: ids.map(concepto),
    ejercicios: ids.flatMap((c) => [ejercicio(`${c}-a`, c), ejercicio(`${c}-b`, c), ejercicio(`${c}-oficial`, c, 'profesor')]),
    generadores: [], juegos: [],
  }
}

function conAprendidos(...ids: string[]) {
  const p = progresoVacio()
  for (const id of ids) p.conceptos[id] = { ...estadoNuevo(), descubierto: '2026-10-01' }
  return p
}

const ix = indexar([unidad()])
const OPC = { moduloId: 'REDES', modo: 'aprendido', n: 6 } as const

describe('práctica libre', () => {
  it('no se puede practicar lo que no se ha aprendido', () => {
    expect(construirPractica(ix, progresoVacio(), OPC)).toEqual({ error: expect.stringContaining('Aún no has aprendido') })
  })

  it('solo pregunta por conceptos aprendidos y no repite ejercicios fijos', () => {
    const s = construirPractica(ix, conAprendidos('c1', 'c2'), OPC)
    if ('error' in s) throw new Error(s.error)
    const claves = s.pasos.flatMap((x) => (x.tipo === 'item' ? [x.item.clave] : []))
    expect(claves.length).toBe(6)
    expect(new Set(claves).size).toBe(6)
    expect(claves.every((c) => c.startsWith('c1') || c.startsWith('c2'))).toBe(true)
    expect(s.tipo).toBe('practica')
  })

  it('el modo fallos solo usa conceptos con fallos, los más fallados primero', () => {
    const p = conAprendidos('c1', 'c2', 'c3')
    p.conceptos.c2 = { ...p.conceptos.c2, fallos: 3, aciertos: 0 }
    p.conceptos.c3 = { ...p.conceptos.c3, fallos: 1, aciertos: 0 }
    const s = construirPractica(ix, p, { ...OPC, modo: 'fallos', n: 3 })
    if ('error' in s) throw new Error(s.error)
    const primero = s.pasos[0]
    expect(primero.tipo === 'item' && primero.item.conceptos[0]).toBe('c2')
    expect(s.pasos.every((x) => x.tipo === 'item' && x.item.conceptos[0] !== 'c1')).toBe(true)
    expect(construirPractica(ix, conAprendidos('c1'), { ...OPC, modo: 'fallos' })).toEqual({ error: expect.stringContaining('No tienes fallos') })
  })

  it('un ejercicio que clasifica varios conceptos conserva todos al registrar la práctica', () => {
    const u = unidad()
    const compartido = { ...ejercicio('clasificar-topologias', 'c1'), conceptos: ['c1', 'c2', 'c3'] }
    u.ejercicios = [compartido]
    const indice = indexar([u])
    const s = construirPractica(indice, conAprendidos('c1', 'c2', 'c3'), { ...OPC, n: 5 })
    if ('error' in s) throw new Error(s.error)
    expect(s.pasos).toHaveLength(1)
    const paso = s.pasos[0]
    expect(paso.tipo === 'item' && paso.item.conceptos).toEqual(['c1', 'c2', 'c3'])
    expect(construirPractica(indice, conAprendidos('c1', 'c2'), OPC)).toEqual({ error: expect.stringContaining('ejercicios disponibles') })
  })
})

describe('simulacro de examen', () => {
  it('necesita al menos 3 lecciones aprendidas', () => {
    expect(construirSimulacro(ix, conAprendidos('c1', 'c2'), 'REDES')).toEqual({ error: expect.stringContaining('al menos 3') })
  })

  it('es un examen con tiempo proporcional, de la asignatura y con las preguntas oficiales primero', () => {
    const s = construirSimulacro(ix, conAprendidos('c1', 'c2', 'c3'), 'REDES', 5)
    if ('error' in s) throw new Error(s.error)
    expect(s.tipo).toBe('examen')
    expect(s.modulo).toBe('REDES')
    expect(s.pasos.length).toBe(3)
    expect(s.tiempo).toBe(3 * SEGUNDOS_POR_PREGUNTA)
    expect(s.pasos.every((x) => x.tipo === 'item' && x.item.origen === 'profesor')).toBe(true)
  })
})

describe('preparación para un examen', () => {
  it('cuenta lo no aprendido como cero y calcula el ritmo con días de repaso final', () => {
    const p = conAprendidos('c1')
    const prep = preparacion(ix, p, 'REDES')
    expect(prep.total).toBe(4)
    expect(prep.aprendidos).toBe(1)
    expect(prep.restantes).toBe(3)
    expect(prep.preparado).toBeGreaterThan(0)
    expect(prep.preparado).toBeLessThanOrEqual(0.25)

    const examen: EventoCalendario = { id: 'x', fecha: '2026-11-10', modulo: 'REDES', tipo: 'examen', titulo: 'Examen REDES' }
    const otro: EventoCalendario = { id: 'y', fecha: '2026-11-10', modulo: 'MME', tipo: 'examen', titulo: 'Examen MME' }
    const lista = examenesProximos(ix, p, [examen, otro], new Date('2026-10-01T12:00:00'))
    expect(lista.length).toBe(1)
    expect(lista[0].dias).toBe(40)
    expect(lista[0].ritmo).toBe(1)
  })
})

describe('informe de progreso', () => {
  it('resume nombre, asignaturas con y sin contenido y próximos exámenes', () => {
    const p = conAprendidos('c1', 'c2')
    p.nombre = 'Perfil Demo'
    const texto = generarInforme(ix, p, [{ id: 'x', fecha: '2026-11-10', modulo: 'REDES', tipo: 'examen', titulo: 'Examen REDES' }], [{ id: 'REDES', nombre: 'Redes locales' }, { id: 'MME', nombre: 'Montaje' }], new Date('2026-10-01T12:00:00'))
    expect(texto).toContain('Perfil Demo')
    expect(texto).toContain('Redes locales: 2 / 0 / 4')
    expect(texto).toContain('Montaje: sin contenido todavía')
    expect(texto).toContain('Examen REDES')
  })
})
