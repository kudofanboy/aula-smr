import { describe, expect, it } from 'vitest'
import type { Concepto, Ejercicio, Generador, Unidad } from '../src/contenido/esquema'
import { estadoNuevo, progresoVacio } from '../src/motor/progreso'
import { candidatosNuevos, construirAprender, construirJuego, construirLeccion, construirTurno, elegirNuevos, indexar, poolJuego, sinResponder, type Sesion } from '../src/motor/sesiones'
import { itemDeEjercicio } from '../src/motor/items'

const fuente = { doc: 'tema', pag: 1 }

function concepto(id: string, requiere: string[] = [], verificado = true): Concepto {
  return {
    id, nombre: id.toUpperCase(), fuente, nivel_verdad: 'temario', requiere, verificado,
    descubrir: [{ tipo: 'prediccion', pregunta: '¿?', opciones: ['Sí', 'No'], correcta: 0, revelacion: 'Sí.' }],
  }
}

const ejercicio: Ejercicio = {
  id: 'e1', motor: 'test', conceptos: ['c1'], dificultad: 1, fuente, verificado: true, origen: 'juego',
  explicacion: 'Porque sí.', enunciado: '¿?', opciones: ['Sí', 'No'], correcta: 0,
}

const generador: Generador = { tipo: 'red-identifica', conceptos: ['c1'], fuente }

function unidad(conceptos: Concepto[] = [concepto('c1')]): Unidad {
  return {
    id: 'u1', modulo: 'REDES', codigo: 'UD1', titulo: 'Unidad', orden: 1,
    fuentes: [{ id: 'tema', titulo: 'Tema', ruta: 'tema.pdf' }], conceptos, ejercicios: [ejercicio], generadores: [generador], juegos: [],
  }
}

function progresoDescubierto(...ids: string[]) {
  const p = progresoVacio()
  for (const id of ids) p.conceptos[id] = { ...estadoNuevo(), descubierto: '2026-10-01' }
  return p
}

describe('sesiones de una asignatura', () => {
  it('no rellena la formación con preguntas oficiales cuando tiene práctica propia; conserva el banco', () => {
    const u = unidad()
    u.ejercicios.push({ ...ejercicio, id: 'oficial', origen: 'profesor' })
    const ix = indexar([u])
    const p = progresoVacio()
    for (const sesion of [construirLeccion(ix, p, 'c1'), construirAprender(ix, p, [], 'u1'), construirTurno(ix, p, [])]) {
      if ('error' in sesion) throw new Error(sesion.error)
      expect(sesion.pasos.filter((s) => s.tipo === 'item').every((s) => s.item.origen === 'juego')).toBe(true)
    }
    const banco = poolJuego(u, { id: 'b', titulo: 'Banco', descripcion: 'Oficial', tipo: 'banco-profesor', preguntas: 3 }, progresoDescubierto('c1'))
    expect(banco.estaticos.map((it) => it.clave)).toEqual(['oficial'])
  })
  it('mantiene formación si la única práctica disponible es la del profesor', () => {
    const u = unidad()
    u.ejercicios = [{ ...ejercicio, origen: 'profesor' }]
    u.generadores = []
    const sesion = construirLeccion(indexar([u]), progresoVacio(), 'c1')
    if ('error' in sesion) throw new Error(sesion.error)
    expect(sesion.pasos).toHaveLength(2)
    expect(sesion.pasos[1]).toMatchObject({ tipo: 'item', item: { origen: 'profesor' } })
  })
  it('no repite un ejercicio estático como reto final de la misma jornada', () => {
    const u = unidad()
    u.ejercicios = [{ ...ejercicio, motor: 'clasificar', enunciado: 'Clasifica', categorias: [{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }], elementos: [{ texto: 'uno', categoria: 'a' }, { texto: 'dos', categoria: 'a' }, { texto: 'tres', categoria: 'b' }] }]
    u.generadores = []
    const sesion = construirTurno(indexar([u]), progresoVacio(), [])
    expect(sesion.pasos.filter((s) => s.tipo === 'item')).toHaveLength(1)
  })
  it('desbloquea una sola formación cada vez aunque varias compartan el primer requisito', () => {
    const ix = indexar([unidad([concepto('c1'), concepto('c2', ['c1']), concepto('c3', ['c1']), concepto('c4')])])
    const disponibles = (...ids: string[]) => candidatosNuevos(ix, progresoDescubierto(...ids), []).map((c) => c.id)
    expect(disponibles()).toEqual(['c1'])
    expect(disponibles('c1')).toEqual(['c2'])
    expect(disponibles('c1', 'c2')).toEqual(['c3'])
    expect(disponibles('c1', 'c2', 'c3')).toEqual(['c4'])
    expect(construirLeccion(ix, progresoDescubierto('c1'), 'c3')).toEqual({ error: 'Antes debes completar: C2.' })
  })

  it('el turno puede planificar varias formaciones manteniendo su orden', () => {
    const ix = indexar([unidad([concepto('c1'), concepto('c2', ['c1']), concepto('c3', ['c1'])])])
    expect(elegirNuevos(ix, progresoVacio(), [], 3).map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('reparte las formaciones nuevas entre asignaturas en vez de agotar la primera por orden alfabético', () => {
    const de = (id: string, modulo: Unidad['modulo']): Unidad => ({ ...unidad([concepto(`${id}1`), concepto(`${id}2`, [`${id}1`]), concepto(`${id}3`, [`${id}2`])]), id, modulo, codigo: id })
    const ix = indexar([de('ipe', 'IPE'), de('red', 'REDES'), de('som', 'SOM')])
    const modulos = (n: number, cal: Parameters<typeof elegirNuevos>[2] = []) => elegirNuevos(ix, progresoVacio(), cal, n).map((c) => ix.concepto.get(c.id)!.unidad.modulo)
    expect(new Set(modulos(3)).size).toBe(3)
    // Con fechas cercanas en IPE y Redes, esas dos pasan primero, pero también se reparten entre sí.
    const proximo = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
    const cal = [{ id: 'a', modulo: 'IPE', tipo: 'examen', fecha: proximo, titulo: 'Examen' }, { id: 'b', modulo: 'REDES', tipo: 'entrega', fecha: proximo, titulo: 'Entrega' }] as Parameters<typeof elegirNuevos>[2]
    expect(modulos(2, cal).sort()).toEqual(['IPE', 'REDES'])
    expect(modulos(4, cal).filter((m) => m === 'SOM')).toEqual([])
  })

  it('no salta una formación sin verificar y conserva lo aprendido en progresos anteriores', () => {
    const ix = indexar([unidad([concepto('c1'), concepto('c2', [], false), concepto('c3')])])
    expect(candidatosNuevos(ix, progresoDescubierto('c1'), [])).toEqual([])
    const previo = progresoDescubierto('c1', 'c3')
    expect(construirLeccion(ix, previo, 'c3')).toMatchObject({ tipo: 'aprender' })
    expect(previo.conceptos.c3.descubierto).toBeDefined()
  })

  it('trata una lista vacía de motores como todos e filtra los generadores con el motor indicado', () => {
    const u = unidad()
    const p = progresoDescubierto('c1')
    const todos = poolJuego(u, { id: 'j', titulo: 'Juego', descripcion: 'x', tipo: 'practica', preguntas: 3, motores: [], generadores: [generador] }, p)
    expect(todos.estaticos).toHaveLength(1)
    expect(todos.generadores).toEqual([generador])

    const soloGenerado = poolJuego(u, { id: 'j', titulo: 'Juego', descripcion: 'x', tipo: 'practica', preguntas: 3, motores: ['gen:red-identifica'], generadores: [generador] }, p)
    expect(soloGenerado.estaticos).toHaveLength(0)
    expect(soloGenerado.generadores).toEqual([generador])
  })

  it('un reto que declara simulaciones las incluye aunque sobren ejercicios estáticos', () => {
    const muchos: Ejercicio[] = Array.from({ length: 12 }, (_, k) => ({ ...ejercicio, id: `e${k}` }))
    const u = { ...unidad(), ejercicios: muchos }
    const j = { id: 'j', titulo: 'Reto', descripcion: 'x', tipo: 'practica' as const, preguntas: 9, generadores: [generador] }
    for (let rep = 0; rep < 10; rep++) {
      const sesion = construirJuego(u, j, progresoDescubierto('c1'))
      if ('error' in sesion) throw new Error(sesion.error)
      expect(sesion.pasos).toHaveLength(9)
      const simulaciones = sesion.pasos.filter((p) => p.tipo === 'item' && p.item.clave.startsWith('gen:')).length
      expect(simulaciones, 'al menos un tercio de simulaciones').toBeGreaterThanOrEqual(3)
    }
    // Sin generadores declarados, el reto sigue siendo solo de ejercicios.
    const sin = construirJuego(u, { ...j, generadores: undefined }, progresoDescubierto('c1'))
    if ('error' in sin) throw new Error(sin.error)
    expect(sin.pasos.every((p) => p.tipo === 'item' && !p.item.clave.startsWith('gen:'))).toBe(true)
  })

  it('no construye una formación sin verificar o con prerrequisitos pendientes', () => {
    const sinVerificar = indexar([unidad([concepto('c1', [], false)])])
    expect(construirLeccion(sinVerificar, progresoVacio(), 'c1')).toEqual({ error: 'Esta lección todavía no está verificada.' })

    const conRequisito = indexar([unidad([concepto('c0'), concepto('c1', ['c0'])])])
    expect(construirLeccion(conRequisito, progresoVacio(), 'c1')).toEqual({ error: 'Antes debes completar: C0.' })
  })

  it('construye la formación cuando el concepto está verificado y sus requisitos se descubrieron', () => {
    const ix = indexar([unidad([concepto('c0'), concepto('c1', ['c0'])])])
    const sesion = construirLeccion(ix, progresoDescubierto('c0'), 'c1')
    if ('error' in sesion) throw new Error(sesion.error)
    expect(sesion.tipo).toBe('aprender')
    expect(sesion.pasos[0]).toMatchObject({ tipo: 'descubrir', concepto: { id: 'c1' } })
  })
})

describe('examen terminado por tiempo', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => itemDeEjercicio({ ...ejercicio, id }, 'u1'))
  const examen: Sesion = { tipo: 'examen', titulo: 'Simulacro', pasos: items.map((item) => ({ tipo: 'item', item, repaso: false })), tiempo: 240 }

  it('las preguntas a las que no se llegó se devuelven en orden para revisarlas', () => {
    expect(sinResponder(examen, [items[0]]).map((i) => i.clave)).toEqual(['b', 'c', 'd'])
    expect(sinResponder(examen, items)).toEqual([])
  })

  it('una pregunta saltada y no retomada también queda pendiente', () => {
    expect(sinResponder(examen, [items[0], items[2], items[3]]).map((i) => i.clave)).toEqual(['b'])
  })

  it('fuera de un examen no hay preguntas pendientes', () => {
    expect(sinResponder({ ...examen, tipo: 'practica' }, [items[0]])).toEqual([])
  })
})
