import { describe, expect, it } from 'vitest'
import { validarTodo } from '../src/contenido/integridad'

function unidadBase() {
  return {
    id: 'REDES-FIXTURE',
    modulo: 'REDES',
    codigo: 'UD1',
    titulo: 'Unidad de fixture',
    orden: 1,
    fuentes: [{ id: 'temario', titulo: 'Documento ficticio', ruta: 'docs/fixture.pdf' }],
    conceptos: [
      {
        id: 'c1',
        nombre: 'Qué es una red',
        fuente: { doc: 'temario', pag: 1 },
        nivel_verdad: 'temario',
        descubrir: [
          { tipo: 'prediccion', pregunta: '¿Qué es una red?', opciones: ['Conjunto de equipos que comparten recursos', 'Un cable'], correcta: 0, revelacion: 'Es un conjunto de equipos y software que comparten recursos.' },
        ],
        verificado: true,
      },
    ],
    ejercicios: [
      {
        id: 'e1',
        motor: 'test',
        conceptos: ['c1'],
        dificultad: 1,
        fuente: { doc: 'temario', pag: 1 },
        verificado: true,
        explicacion: 'Una red comparte recursos.',
        enunciado: '¿Qué es una red?',
        opciones: ['Conjunto de equipos que comparten recursos', 'Un programa que funciona en un solo equipo'],
        correcta: 0,
      },
    ],
    generadores: [],
    juegos: [{ id: 'j1', titulo: 'Práctica UD1', descripcion: 'Repaso', tipo: 'practica', preguntas: 5 }],
  }
}

function comprobar(unidad: unknown) {
  return validarTodo({ unidades: [unidad], calendario: [], curso: { modulos: [] } }).errores
}

describe('integridad del contenido', () => {
  it('una unidad mínima correcta no da errores', () => {
    expect(comprobar(unidadBase())).toEqual([])
  })

  it('rechaza un concepto que apunta a una fuente no declarada', () => {
    const u = unidadBase()
    u.conceptos[0].fuente.doc = 'otro-pdf'
    expect(comprobar(u).join(' ')).toContain('la fuente "otro-pdf" no está declarada')
  })

  it('rechaza un ejercicio que usa un concepto de otra unidad', () => {
    const u = unidadBase()
    u.ejercicios[0].conceptos = ['c2']
    expect(comprobar(u).join(' ')).toContain('concepto "c2" no pertenece a la unidad')
  })

  it('rechaza un test con la respuesta correcta fuera de rango', () => {
    const u = unidadBase()
    u.ejercicios[0].correcta = 5
    expect(comprobar(u).join(' ')).toContain('"correcta" fuera de rango')
  })

  it('rechaza opciones prohibidas como "todas las anteriores"', () => {
    const u = unidadBase()
    u.ejercicios[0].opciones = ['Todas las anteriores', 'Un programa']
    expect(comprobar(u).join(' ')).toContain('opción prohibida')
  })

  it('exige que cada concepto verificado tenga al menos un ejercicio verificado', () => {
    const u = unidadBase()
    u.ejercicios = []
    expect(comprobar(u).join(' ')).toContain('no tiene ningún ejercicio verificado ni generador')
  })

  it('exige que "descubrir" no sea solo texto: al menos un paso interactivo', () => {
    const u = unidadBase()
    u.conceptos[0].descubrir = [{ tipo: 'idea', texto: 'Una red comparte recursos.' }]
    expect(comprobar(u).join(' ')).toContain('necesita al menos un paso interactivo')
  })

  it('rechaza zonas de explorar que no existen en el dibujo', () => {
    const u = unidadBase()
    u.conceptos[0].descubrir = [
      {
        tipo: 'explorar',
        instruccion: 'Pulsa las partes',
        visual: { tipo: 'estados-proceso' },
        zonas: [
          { id: 'nuevo', titulo: 'Nuevo', texto: 'Recién creado.' },
          { id: 'inventada', titulo: 'X', texto: 'No existe.' },
        ],
      },
    ]
    expect(comprobar(u).join(' ')).toContain('zona "inventada" no existe en el dibujo estados-proceso')
  })

  it('rechaza ids repetidos', () => {
    const u = unidadBase()
    u.ejercicios.push({ ...u.ejercicios[0] })
    expect(comprobar(u).join(' ')).toContain('id repetido "e1"')
  })

  it('rechaza un módulo desconocido en la propia unidad', () => {
    const u = unidadBase()
    ;(u as { modulo: string }).modulo = 'MATES'
    expect(comprobar(u).join(' ')).toContain('modulo')
  })
})

describe('reglas del formato didáctico v2', () => {
  function unidadV2() {
    const u = unidadBase() as ReturnType<typeof unidadBase> & Record<string, unknown>
    u.formato = 2
    u.glosario = [{ id: 'recurso', termino: 'Recurso compartido', definicion: 'Algo que varios equipos usan a través de la red.' }]
    Object.assign(u.conceptos[0], {
      objetivo: 'Explicar qué es una red.',
      clave: ['Red = hardware + software.', 'Sirve para compartir [[recurso|recursos]].'],
      descubrir: [
        { tipo: 'idea', texto: 'Una red une equipos y programas para compartir [[recurso|recursos]].' },
        { tipo: 'pregunta', pregunta: 'Cinco PC y una impresora: ¿cómo imprimen todos?', opciones: ['Conectándolos en red', 'Con un USB'], correcta: 0, revelacion: 'La red permite compartir la impresora.' },
      ],
    })
    u.ejercicios[0].explicacion = 'Una red une hardware y software para compartir recursos; un programa solo no basta para comunicar equipos.'
    return u
  }

  it('una unidad v2 bien hecha no da errores', () => {
    expect(comprobar(unidadV2())).toEqual([])
  })

  it('exige objetivo, «Lo importante» y una comprobación después de explicar', () => {
    const u = unidadV2()
    const c = u.conceptos[0] as Record<string, unknown>
    delete c.objetivo
    delete c.clave
    c.descubrir = [(c.descubrir as unknown[])[1], (c.descubrir as unknown[])[0]]
    const e = comprobar(u).join(' ')
    expect(e).toContain('falta el objetivo')
    expect(e).toContain('falta «Lo importante»')
    expect(e).toContain('la comprobación debe ir después de explicar')
  })

  it('rechaza correcciones que solo citan la fuente y términos que no están en el glosario', () => {
    const u = unidadV2()
    u.ejercicios[0].explicacion = 'Tema, pág. 1.'
    ;(u.conceptos[0].descubrir[0] as { texto: string }).texto += ' Usa una [[trama]].'
    const e = comprobar(u).join(' ')
    expect(e).toContain('la corrección debe explicar el porqué')
    expect(e).toContain('el término [[trama]] no está en el glosario')
  })

  it('el «¿Qué crees?» debe ir seguido de la explicación que lo resuelve', () => {
    const u = unidadV2()
    const c = u.conceptos[0] as { descubrir: unknown[] }
    c.descubrir = [{ tipo: 'prediccion', pregunta: '¿Para qué sirve una red?', opciones: ['Compartir', 'Nada'], correcta: 0, revelacion: 'Para compartir.' }, ...c.descubrir.slice(1)]
    expect(comprobar(u).join(' ')).toContain('debe ir seguido de la explicación')
  })

  it('la opción correcta no puede delatarse por ser mucho más larga que las demás', () => {
    const u = unidadV2()
    const paso = u.conceptos[0].descubrir[1] as { opciones: string[] }
    paso.opciones = ['Conectándolos en red para que todos compartan la misma impresora', 'Con un USB']
    expect(comprobar(u).join(' ')).toContain('se delata por ser mucho más larga')
  })
})
