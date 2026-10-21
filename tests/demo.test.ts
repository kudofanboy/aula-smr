import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Unidad, type Curso } from '../src/contenido/esquema'
import { comprobarReferencias, validarTodo } from '../src/contenido/integridad'
import { pasosDeFormacion } from '../src/contenido/didactica'
import { estadoNuevo, progresoVacio, registrarEvidencia } from '../src/motor/progreso'
import { construirBreve, construirLeccion, indexar } from '../src/motor/sesiones'
import { catalogoEncargos, decidirEncargo, encargoVisible, entregarEncargo, iniciarEncargo, pendientesParaEncargo, valorarEncargo } from '../src/motor/encargos'
import { validarCopiaProgreso } from '../src/motor/copias'
import { corregir, itemDeEjercicio, revisar, type Vista } from '../src/motor/items'

const leer = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const unidades = readdirSync('contenido', { withFileTypes: true }).filter(d => d.isDirectory()).flatMap(d => readdirSync(join('contenido', d.name)).filter(f => f.endsWith('.json')).map(f => Unidad.parse(leer(join('contenido', d.name, f)))))
const redes = unidades.find(u => u.modulo === 'REDES')!
const curso = leer('contenido/curso.json') as Curso
const calendario = leer('contenido/calendario.json')
const ix = indexar(unidades)
const aprendido = () => {
  const p = progresoVacio()
  p.nombre = 'Perfil Demo'
  for (const u of unidades) for (const c of u.conceptos) p.conceptos[c.id] = { ...estadoNuevo(), descubierto: '2030-01-01' }
  return p
}
const solucion = (v: Vista): unknown => {
  switch (v.motor) {
    case 'test': return v.correcta
    case 'vf': return v.verdadero
    case 'ordenar': return [...v.pasos]
    case 'clasificar': return Object.fromEntries(v.elementos.map((e, i) => [i, e.categoria]))
    case 'emparejar': return Object.fromEntries(v.pares.map(p => [p.a, p.b]))
    case 'nodos': return [...v.correctas]
  }
}

describe('contrato de la demostración pública', () => {
  it('carga seis unidades completas sin errores de esquema ni integridad', () => {
    const r = validarTodo({ unidades, calendario, curso })
    expect(r.errores).toEqual([])
    expect(r.unidades).toHaveLength(6)
    expect(new Set(r.unidades.map(u => u.modulo))).toEqual(new Set(['MME', 'SOM', 'REDES', 'AOF', 'ING', 'IPE']))
    expect(r.curso).not.toBeNull()
  })
  it('enseña antes de preguntar y conserva ese orden al preparar cada lección', () => {
    for (const u of unidades) for (const c of u.conceptos) {
      const pasos = pasosDeFormacion(c.descubrir, u.formato)
      expect(pasos[0].tipo, c.id).toBe('idea')
      expect(pasos.findIndex(p => p.tipo === 'pregunta'), c.id).toBeGreaterThan(0)
      expect(c.objetivo, c.id).toBeTruthy()
      expect(c.clave?.length, c.id).toBeGreaterThanOrEqual(2)
    }
  })
  it('usa fuentes propias existentes y el localizador de apartado', () => {
    const doc = readFileSync('docs/DEMO-CONTENT.md', 'utf8')
    expect(doc).toContain('kudofanboy')
    expect(doc).toContain('CC BY 4.0')
    for (const u of unidades) for (const f of u.fuentes) {
      expect(f.ruta).toBe('docs/DEMO-CONTENT.md')
      expect(f.localizador).toBe('apartado')
      expect(readFileSync(f.ruta, 'utf8')).toBe(doc)
    }
    for (const u of unidades) for (const c of u.conceptos) expect(doc).toContain(`## ${c.fuente.pag}.`)
  })
  it('explicita la ficción y solo utiliza correos del dominio de ejemplo', () => {
    expect(curso.profesorado).toHaveLength(6)
    expect(curso.profesorado.filter(p => p.tutora)).toHaveLength(1)
    expect(new Set(curso.profesorado.map(p => p.correo)).size).toBe(6)
    for (const p of curso.profesorado) {
      expect(p.nombre).toContain('ficticio')
      expect(p.correo).toMatch(/^docente-demo-\d@example\.org$/)
      expect(p.nota).toContain('No contactar')
      for (const f of p.fuentes) expect(new URL(f.url).hostname).toBe('example.org')
    }
    expect(calendario.length).toBeGreaterThan(0)
    for (const e of calendario) {
      expect(`${e.titulo} ${e.detalle}`).toMatch(/fictici|inventad/)
      expect(e.fuente).toBeUndefined()
    }
    for (const u of unidades) {
      expect(u.codigo).toBe('DEMO')
      expect(u.ejercicios.every(e => e.origen === 'juego')).toBe(true)
      expect(u.juegos.some(j => j.tipo === 'banco-profesor')).toBe(false)
    }
  })
  it('rechaza una ficha duplicada o un correo que no es válido', () => {
    const p = curso.profesorado[0]
    const validar = (profesorado: unknown[]) => validarTodo({ unidades: [], calendario: [], curso: { ...curso, profesorado } }).errores.join(' ')
    expect(validar([p, p])).toContain('id repetido')
    expect(validar([{ ...p, correo: 'sin-correo' }])).toContain('correo')
    expect(validar([{ ...p, modulos: ['SOC'] }])).toContain('no existe')
  })
})

describe('contenido demo ejecutable', () => {
  it('los cinco motores aceptan su solución tras barajar y coinciden con la revisión', () => {
    const motores = new Set<string>()
    for (const u of unidades) for (const e of u.ejercicios) {
      const item = itemDeEjercicio(e, u.id)
      motores.add(item.vista.motor)
      const respuesta = solucion(item.vista)
      expect(corregir(item.vista, respuesta), e.id).toBe(true)
      expect(revisar(item.vista, respuesta).acierto, e.id).toBe(true)
      expect(corregir(item.vista, undefined), e.id).toBe(false)
    }
    expect(motores).toEqual(new Set(['test', 'vf', 'clasificar', 'ordenar', 'emparejar']))
  })
  it('un perfil nuevo aprende un concepto y recibe solo práctica del mismo concepto', () => {
    const indice = indexar([redes])
    const s = construirBreve(indice, progresoVacio(), [])
    const formaciones = s.pasos.filter(p => p.tipo === 'descubrir')
    expect(formaciones).toHaveLength(1)
    expect(formaciones[0].concepto.id).toBe(redes.conceptos[0].id)
    expect(s.pasos.filter(p => p.tipo === 'item').every(p => p.item.conceptos.every(c => c === redes.conceptos[0].id))).toBe(true)
  })
  it('construye todas las lecciones aprendidas con una explicación y actividades', () => {
    for (const u of unidades) for (const c of u.conceptos) {
      const s = construirLeccion(ix, aprendido(), c.id)
      if ('error' in s) throw new Error(s.error)
      expect(s.pasos[0]).toMatchObject({ tipo: 'descubrir', concepto: { id: c.id } })
      expect(s.pasos.some(p => p.tipo === 'item'), c.id).toBe(true)
    }
  })
  it('conserva evidencias al exportar e importar sin modificar la tarjeta de repaso', () => {
    const antes = aprendido()
    const id = redes.conceptos[0].id
    const tarjeta = antes.conceptos[id].tarjeta
    const despues = registrarEvidencia(antes, { fecha: '2030-01-01T12:00:00Z', tipo: 'practica', unidadId: redes.id, conceptos: [id], actividad: 'demo-red-conectar', acierto: false, ayudas: 0, detalle: 'Comprobación ficticia' })
    expect(despues.conceptos[id].tarjeta).toBe(tarjeta)
    expect(antes.evidencias).toBeUndefined()
    const copia = validarCopiaProgreso(JSON.parse(JSON.stringify(despues)), unidades)
    expect(copia.evidencias).toEqual(despues.evidencias)
    expect(() => validarCopiaProgreso({ ...despues, evidencias: [{ ...despues.evidencias![0], ayudas: -1 }] }, unidades)).toThrow()
  })
})

describe('encargos ficticios y copias de progreso', () => {
  const encargo = redes.encargos[0]
  it('bloquea el caso sin aprender y calcula todas las formaciones pendientes', () => {
    const p = progresoVacio()
    expect(iniciarEncargo(p, encargo)).toBe(p)
    const ficha = catalogoEncargos([redes])[0]
    expect(pendientesParaEncargo(ficha, p)).toEqual(redes.conceptos.slice(0, 2).map(c => c.id))
    const preparado = aprendido()
    expect(pendientesParaEncargo(ficha, preparado)).toEqual([])
  })
  it('rechaza saltos y opciones inválidas, conserva la copia y premia una sola entrega', () => {
    let p = iniciarEncargo(aprendido(), encargo, '2030-01-01')
    expect(decidirEncargo(p, encargo, 1, 0)).toBe(p)
    expect(decidirEncargo(p, encargo, 0, 999)).toBe(p)
    expect(entregarEncargo(p, encargo)).toBe(p)
    for (const [i, paso] of encargo.pasos.entries()) {
      const opcion = paso.opciones.findIndex(o => o.correcta)
      p = decidirEncargo(p, encargo, i, opcion)
      expect(decidirEncargo(p, encargo, i, opcion)).toBe(p)
    }
    const copia = validarCopiaProgreso(JSON.parse(JSON.stringify(p)), unidades)
    expect(copia.encargos[encargo.id]).toEqual(p.encargos[encargo.id])
    p = entregarEncargo(copia, encargo, '2030-01-02')
    expect(p.xp).toBe(encargo.pasos.length * 12)
    expect(p.sueldo).toBe(encargo.pasos.length * 20)
    expect(entregarEncargo(p, encargo, '2030-01-03')).toBe(p)
  })
  it('no convierte una copia con opciones inexistentes en progreso válido', () => {
    const p = aprendido()
    p.encargos[encargo.id] = { recibido: '2030-01-01', leido: true, respuestas: [999] }
    expect(() => validarCopiaProgreso(p, unidades)).toThrow('decisiones inválidas')
    p.encargos[encargo.id].respuestas = Array(encargo.pasos.length + 1).fill(0)
    expect(() => validarCopiaProgreso(p, unidades)).toThrow('decisiones inválidas')
  })
  it('rechaza una referencia rota y una decisión con varias respuestas correctas', () => {
    const u = structuredClone(redes)
    u.encargos[0].pasos[0].fuente.doc = 'sin-fuente'
    u.encargos[0].pasos[0].opciones.forEach(o => { o.correcta = true })
    const errores = comprobarReferencias([u]).join(' ')
    expect(errores).toContain('no está declarada')
    expect(errores).toContain('una sola decisión correcta')
  })
  it('las versiones ficticias comparten premio y permiten terminar una versión empezada', () => {
    const v1 = { ...encargo, id: 'fixture-v1', sustituido_por: 'fixture-v2' }
    const v2 = { ...encargo, id: 'fixture-v2', sustituye: 'fixture-v1' }
    let p = aprendido()
    expect(encargoVisible(v1, p)).toBe(false)
    p.encargos[v1.id] = { recibido: '2030-01-01', leido: true, respuestas: [] }
    expect(encargoVisible(v1, p)).toBe(true)
    const completar = (actual: typeof p, caso: typeof encargo) => {
      let q = iniciarEncargo(actual, caso, '2030-01-01')
      caso.pasos.forEach((s, i) => { q = decidirEncargo(q, caso, i, s.opciones.findIndex(o => o.correcta)) })
      return entregarEncargo(q, caso, '2030-01-01')
    }
    p = completar(p, v1)
    const xp = p.xp
    p = completar(p, v2)
    expect(p.xp).toBe(xp)
    expect(p.encargos[v2.id].sinPremio).toBe(true)
    expect(valorarEncargo(encargo, encargo.pasos.map(s => s.opciones.findIndex(o => !o.correcta))).xp).toBe(0)
  })
})
