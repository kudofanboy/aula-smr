// Comprobaciones de integridad del contenido, además del esquema Zod.
// Se ejecutan al cargar el juego y en los tests (npm test).
import { CONEXION, ESCENA, MAQUINA, causaReal, errorDeConexion, errorDeDiagnostico, errorDeEscena, errorDeMaquina } from '../motor/tableros'
import { z } from 'zod'
import { Curso, EventoCalendario, Unidad, type Visual } from './esquema'
import { terminosCitados } from './texto'

/** Zonas pulsables de cada dibujo (deben coincidir con los ids que dibuja el componente). */
export const ZONAS_VISUAL: Record<Visual['tipo'], string[]> = {
  vonneumann: ['uc', 'alu', 'registros', 'ram', 'es', 'buses'],
  'capas-so': ['usuario', 'aplicaciones', 'so', 'hardware'],
  disco: ['plato', 'pista', 'sector', 'cilindro'],
  'estados-proceso': ['nuevo', 'listo', 'ejecucion', 'bloqueado', 'terminado'],
  'alcance-redes': ['pan', 'lan', 'man', 'wan'],
  nic: ['rj45', 'led-link', 'led-act'],
  topologia: ['centro', 'troncal', 'terminador', 'equipo', 'raiz', 'intermedio'],
  'nodos-red': [],
  emoji: [],
}

const PROHIBIDAS = [/todas las anteriores/i, /ninguna de las anteriores/i]

/** Opciones de relleno que nadie elegiría: no enseñan a distinguir (formato v2). */
const RELLENO = [/^por casualidad\.?$/i, /^suerte\.?$/i, /^para gastar espacio/i, /^tomar café/i, /color del cable/i]

/** Una corrección que solo cita la fuente no explica nada: la fuente ya se muestra aparte (formato v2). */
const SOLO_CITA = /^(\(?\s*(tema|ud\d|ut\d|unidad|diapositiva|tabla|resumen|guía|ficha)\b[^.]*\.?\s*\)?\s*)+$/i
export const MIN_CORRECCION = 60

/**
 * Si la opción correcta es bastante más larga que todas las demás, se adivina sin saber la materia
 * (Haladyna, Downing y Rodríguez 2002: opciones de longitud parecida). Margen: un 30 % y 15 caracteres.
 */
export function delataLongitud(opciones: string[], correcta: number): boolean {
  const otras = opciones.filter((_, i) => i !== correcta).map((o) => o.length)
  const larga = Math.max(...otras)
  const c = opciones[correcta]?.length ?? 0
  return c > larga * 1.3 && c - larga > 15
}

/** Textos de una unidad donde se pueden citar términos del glosario (para comprobar las referencias). */
function textosDeUnidad(u: z.infer<typeof Unidad>): { donde: string; texto: string }[] {
  const t: { donde: string; texto: string }[] = []
  for (const c of u.conceptos) {
    if (c.objetivo) t.push({ donde: `${c.id}/objetivo`, texto: c.objetivo })
    for (const k of c.clave ?? []) t.push({ donde: `${c.id}/clave`, texto: k })
    if (c.matiz) t.push({ donde: `${c.id}/matiz`, texto: `${c.matiz.examen} ${c.matiz.real}` })
    c.descubrir.forEach((p, i) => {
      const donde = `${c.id} paso ${i + 1}`
      if (p.tipo === 'idea') t.push({ donde, texto: p.texto })
      if (p.tipo === 'prediccion' || p.tipo === 'pregunta') t.push({ donde, texto: [p.pregunta, p.revelacion, ...(p.tipo === 'pregunta' ? p.por_opcion ?? [] : [])].join(' ') })
      if (p.tipo === 'explorar') t.push({ donde, texto: [p.instruccion, ...p.zonas.map((z) => z.texto)].join(' ') })
      if (p.tipo === 'simulador-red') t.push({ donde, texto: p.instruccion })
    })
  }
  for (const e of u.ejercicios) {
    const extra = e.motor === 'test' ? [e.enunciado, ...(e.por_opcion ?? [])] : e.motor === 'vf' ? [e.afirmacion] : [e.enunciado]
    t.push({ donde: e.id, texto: [...extra, e.explicacion].join(' ') })
  }
  for (const g of u.glosario) t.push({ donde: `glosario/${g.id}`, texto: g.definicion })
  return t
}

/** Reglas de calidad didáctica de las unidades migradas al formato v2 (docs/PLAN-DIDACTICO.md). */
function comprobarFormato2(u: z.infer<typeof Unidad>): string[] {
  const err: string[] = []
  for (const c of u.conceptos) {
    const donde = `${u.id}/${c.id}`
    if (!c.objetivo) err.push(`${donde}: falta el objetivo`)
    if (!c.clave) err.push(`${donde}: falta «Lo importante» (clave)`)
    if (!c.descubrir.some((p) => p.tipo === 'pregunta')) err.push(`${donde}: la lección necesita una comprobación (paso "pregunta") después de explicar`)
    c.descubrir.forEach((p, i) => {
      const antes = c.descubrir.slice(0, i)
      if (p.tipo === 'prediccion' && c.descubrir[i + 1]?.tipo !== 'idea')
        err.push(`${donde} paso ${i + 1}: «¿Qué crees?» debe ir seguido de la explicación que lo resuelve`)
      if (p.tipo === 'pregunta') {
        if (!antes.some((a) => a.tipo === 'idea' || a.tipo === 'explorar' || a.tipo === 'simulador-red'))
          err.push(`${donde} paso ${i + 1}: la comprobación debe ir después de explicar`)
        if (p.correcta >= p.opciones.length) err.push(`${donde} paso ${i + 1}: "correcta" fuera de rango`)
        if (p.por_opcion && p.por_opcion.length !== p.opciones.length) err.push(`${donde} paso ${i + 1}: por_opcion no tiene una entrada por opción`)
      }
      if (p.tipo === 'prediccion' || p.tipo === 'pregunta') {
        for (const o of p.opciones) if (RELLENO.some((rx) => rx.test(o))) err.push(`${donde} paso ${i + 1}: opción de relleno "${o}"`)
        if (delataLongitud(p.opciones, p.correcta)) err.push(`${donde} paso ${i + 1}: la opción correcta se delata por ser mucho más larga que las demás`)
      }
    })
  }
  for (const e of u.ejercicios) {
    const x = e.explicacion.trim()
    if (x.length < MIN_CORRECCION || SOLO_CITA.test(x)) err.push(`${u.id}/${e.id}: la corrección debe explicar el porqué (no solo citar la fuente o repetir la respuesta)`)
    if (e.motor === 'test') {
      for (const o of e.opciones) if (RELLENO.some((rx) => rx.test(o))) err.push(`${u.id}/${e.id}: opción de relleno "${o}"`)
      // El banco del profesor conserva su texto literal: ahí no se puede reescribir.
      if (e.origen !== 'profesor' && delataLongitud(e.opciones, e.correcta)) err.push(`${u.id}/${e.id}: la opción correcta se delata por ser mucho más larga que las demás`)
    }
  }
  return err
}

export interface ResultadoCarga {
  unidades: z.infer<typeof Unidad>[]
  calendario: z.infer<typeof EventoCalendario>[]
  curso: z.infer<typeof Curso> | null
  errores: string[]
}

export function validarTodo(bruto: { unidades: unknown[]; calendario: unknown; curso: unknown; errores?: string[] }): ResultadoCarga {
  const errores: string[] = [...(bruto.errores ?? [])]
  const unidades: z.infer<typeof Unidad>[] = []
  for (const u of bruto.unidades) {
    const r = Unidad.safeParse(u)
    const nombre = (u as { id?: string })?.id ?? '¿sin id?'
    if (!r.success) {
      for (const iss of r.error.issues) errores.push(`${nombre}: ${iss.path.join('.')} → ${iss.message}`)
      continue
    }
    unidades.push(r.data)
  }
  const cal = z.array(EventoCalendario).safeParse(bruto.calendario)
  if (!cal.success) errores.push(...cal.error.issues.map((i) => `calendario: ${i.path.join('.')} → ${i.message}`))
  const curso = Curso.safeParse(bruto.curso)
  if (!curso.success) errores.push(...curso.error.issues.map((i) => `curso: ${i.path.join('.')} → ${i.message}`))
  if (curso.success) {
    const modulos = new Set(curso.data.modulos.map((m) => m.id))
    const docentes = new Set<string>()
    const correos = new Set<string>()
    for (const p of curso.data.profesorado) {
      if (docentes.has(p.id)) errores.push(`profesorado: id repetido "${p.id}"`)
      if (correos.has(p.correo.toLowerCase())) errores.push(`profesorado: correo repetido "${p.correo}"`)
      docentes.add(p.id)
      correos.add(p.correo.toLowerCase())
      for (const id of p.modulos) if (!modulos.has(id)) errores.push(`profesorado/${p.id}: módulo "${id}" no existe en el curso`)
    }
  }
  errores.push(...comprobarReferencias(unidades))
  return { unidades, calendario: cal.success ? cal.data : [], curso: curso.success ? curso.data : null, errores }
}

export function comprobarReferencias(unidades: z.infer<typeof Unidad>[]): string[] {
  const err: string[] = []
  const ids = new Map<string, string>()
  const unico = (id: string, donde: string) => {
    if (ids.has(id)) err.push(`id repetido "${id}" (${donde} y ${ids.get(id)})`)
    else ids.set(id, donde)
  }
  const todosConceptos = new Set(unidades.flatMap((u) => u.conceptos.map((c) => c.id)))
  const glosario = new Set<string>()
  for (const u of unidades) for (const g of u.glosario) {
    if (glosario.has(g.id)) err.push(`glosario: término repetido "${g.id}" (${u.id})`)
    glosario.add(g.id)
    if (g.concepto && !todosConceptos.has(g.concepto)) err.push(`glosario/${g.id}: el concepto "${g.concepto}" no existe`)
  }
  for (const u of unidades) {
    for (const { donde, texto } of textosDeUnidad(u))
      for (const id of terminosCitados(texto)) if (!glosario.has(id)) err.push(`${u.id}/${donde}: el término [[${id}]] no está en el glosario`)
    if (u.formato === 2) err.push(...comprobarFormato2(u))
    unico(u.id, 'unidad')
    const fuentes = new Set(u.fuentes.map((f) => f.id))
    const propios = new Set(u.conceptos.map((c) => c.id))
    const conPractica = new Set<string>()
    const ref = (donde: string, r: { doc: string }) => {
      if (!fuentes.has(r.doc)) err.push(`${u.id}/${donde}: la fuente "${r.doc}" no está declarada`)
    }
    for (const c of u.conceptos) {
      unico(c.id, `${u.id} concepto`)
      ref(c.id, c.fuente)
      for (const r of c.requiere) if (!todosConceptos.has(r)) err.push(`${u.id}/${c.id}: requiere "${r}", que no existe`)
      if (!c.descubrir.some((p) => p.tipo !== 'idea')) err.push(`${u.id}/${c.id}: "descubrir" necesita al menos un paso interactivo (no solo ideas)`)
      c.descubrir.forEach((p, i) => {
        if (p.tipo === 'prediccion' && p.correcta >= p.opciones.length) err.push(`${u.id}/${c.id} paso ${i}: "correcta" fuera de rango`)
        if (p.tipo === 'explorar') {
          const validas = ZONAS_VISUAL[p.visual.tipo]
          for (const z of p.zonas) if (!validas.includes(z.id)) err.push(`${u.id}/${c.id} paso ${i}: zona "${z.id}" no existe en el dibujo ${p.visual.tipo}`)
        }
      })
    }
    for (const e of u.ejercicios) {
      unico(e.id, `${u.id} ejercicio`)
      ref(e.id, e.fuente)
      for (const c of e.conceptos) {
        if (!propios.has(c)) err.push(`${u.id}/${e.id}: concepto "${c}" no pertenece a la unidad`)
        if (e.verificado) conPractica.add(c)
      }
      if (e.motor === 'test') {
        if (e.correcta >= e.opciones.length) err.push(`${u.id}/${e.id}: "correcta" fuera de rango`)
        if (e.por_opcion && e.por_opcion.length !== e.opciones.length) err.push(`${u.id}/${e.id}: por_opcion no tiene una entrada por opción`)
        if (new Set(e.opciones).size !== e.opciones.length) err.push(`${u.id}/${e.id}: opciones repetidas`)
        for (const o of e.opciones) if (PROHIBIDAS.some((rx) => rx.test(o))) err.push(`${u.id}/${e.id}: opción prohibida "${o}"`)
      }
      if (e.motor === 'clasificar') {
        const cats = new Set(e.categorias.map((c) => c.id))
        for (const el of e.elementos) if (!cats.has(el.categoria)) err.push(`${u.id}/${e.id}: categoría "${el.categoria}" no existe`)
        for (const c of cats) if (!e.elementos.some((el) => el.categoria === c)) err.push(`${u.id}/${e.id}: categoría "${c}" sin elementos`)
      }
      if (e.motor === 'emparejar') {
        if (new Set(e.pares.map((p) => p.a)).size !== e.pares.length || new Set(e.pares.map((p) => p.b)).size !== e.pares.length)
          err.push(`${u.id}/${e.id}: los pares deben ser únicos por los dos lados`)
      }
      if (e.motor === 'ordenar' && new Set(e.pasos).size !== e.pasos.length) err.push(`${u.id}/${e.id}: pasos repetidos`)
    }
    for (const g of u.generadores) {
      ref(`generador ${g.tipo}`, g.fuente)
      for (const c of g.conceptos) {
        if (!propios.has(c)) err.push(`${u.id}/generador ${g.tipo}: concepto "${c}" no pertenece a la unidad`)
        conPractica.add(c)
      }
    }
    for (const c of u.conceptos) if (c.verificado && !conPractica.has(c.id)) err.push(`${u.id}/${c.id}: no tiene ningún ejercicio verificado ni generador`)
    for (const j of u.juegos) {
      unico(j.id, `${u.id} juego`)
      for (const c of j.conceptos ?? []) if (!propios.has(c)) err.push(`${u.id}/${j.id}: concepto "${c}" no pertenece a la unidad`)
    }
    for (const encargo of u.encargos) {
      unico(encargo.id, `${u.id} encargo`)
      const otra = encargo.sustituye ?? encargo.sustituido_por
      if (encargo.sustituye && encargo.sustituido_por) err.push(`${u.id}/${encargo.id}: un caso no puede sustituir y estar sustituido a la vez`)
      if (otra) {
        const pareja = u.encargos.find((x) => x.id === otra)
        if (!pareja || (encargo.sustituye ? pareja.sustituido_por : pareja.sustituye) !== encargo.id)
          err.push(`${u.id}/${encargo.id}: la versión "${otra}" no existe en la unidad o no la enlaza de vuelta`)
      }
      for (const [i, paso] of encargo.pasos.entries()) {
        const donde = `${encargo.id} decisión ${i + 1}`
        ref(donde, paso.fuente)
        for (const c of paso.conceptos) if (!propios.has(c)) err.push(`${u.id}/${donde}: concepto "${c}" no pertenece a la unidad`)
        if (paso.opciones.filter((o) => o.correcta).length !== 1) err.push(`${u.id}/${donde}: debe haber una sola decisión correcta`)
        if (new Set(paso.opciones.map((o) => o.texto)).size !== paso.opciones.length) err.push(`${u.id}/${donde}: opciones repetidas`)
        if (paso.taller) {
          const valores = paso.taller === 'inventario' ? [-1, 7, 8, 15] : [0, 1, 2]
          const correcta = paso.taller === 'conexion' ? 1 : paso.taller === 'inventario' ? 15 : 0
          if (paso.opciones.length !== valores.length || valores.some((v) => paso.opciones.filter((o) => o.valor_taller === v).length !== 1)
            || paso.opciones.some((o) => o.correcta !== (o.valor_taller === correcta))) err.push(`${u.id}/${donde}: el taller no coincide con sus opciones y su solución`)
          const concepto = paso.taller === 'conexion' ? 'red-definicion' : paso.taller === 'inventario' ? 'nodo' : 'lan'
          if (u.id !== 'REDES-UD1' || !paso.conceptos.includes(concepto)) err.push(`${u.id}/${donde}: taller sin el concepto necesario de Redes UD1`)
        }
        if (paso.tablero && paso.taller) err.push(`${u.id}/${donde}: un paso no puede tener taller y tablero a la vez`)
        const t = paso.tablero
        if (t?.tipo === 'conectar') {
          const e = errorDeConexion(t)
          if (e) err.push(`${u.id}/${donde}: tablero de cableado: ${e}`)
          const valores = [CONEXION.CORRECTA, CONEXION.SIN_CENTRO, CONEXION.INCOMPLETA, CONEXION.SOBRANTE]
          if (paso.opciones.length !== valores.length || valores.some((v) => paso.opciones.filter((o) => o.valor_taller === v).length !== 1)
            || paso.opciones.some((o) => o.correcta !== (o.valor_taller === CONEXION.CORRECTA))) err.push(`${u.id}/${donde}: las opciones del cableado deben cubrir correcta, sin centro, incompleta y sobrante, y solo la primera es correcta`)
        }
        if (t?.tipo === 'escena') {
          const e = errorDeEscena(t)
          if (e) err.push(`${u.id}/${donde}: escena de riesgos: ${e}`)
          const valores = [ESCENA.CORRECTA, ESCENA.FALTAN, ESCENA.SOBRAN, ESCENA.AMBAS]
          if (paso.opciones.length !== valores.length || valores.some((v) => paso.opciones.filter((o) => o.valor_taller === v).length !== 1)
            || paso.opciones.some((o) => o.correcta !== (o.valor_taller === ESCENA.CORRECTA))) err.push(`${u.id}/${donde}: las opciones de la escena deben cubrir correcta, faltan, sobran y ambas, y solo la primera es correcta`)
        }
        if (t?.tipo === 'maquina-virtual') {
          const e = errorDeMaquina(t)
          if (e) err.push(`${u.id}/${donde}: tablero de máquina virtual: ${e}`)
          const valores = [MAQUINA.CORRECTA, MAQUINA.INSUFICIENTE, MAQUINA.SOBRECARGA, MAQUINA.RED]
          if (paso.opciones.length !== valores.length || valores.some((v) => paso.opciones.filter((o) => o.valor_taller === v).length !== 1)
            || paso.opciones.some((o) => o.correcta !== (o.valor_taller === MAQUINA.CORRECTA))) err.push(`${u.id}/${donde}: las opciones de la máquina virtual deben cubrir correcta, insuficiente, sobrecarga y red, y solo la primera es correcta`)
        }
        if (t?.tipo === 'diagnostico') {
          const e = errorDeDiagnostico(t)
          if (e) err.push(`${u.id}/${donde}: tablero de diagnóstico: ${e}`)
          const real = t.sospechosos.findIndex((x) => x.id === causaReal(t))
          if (paso.opciones.length !== t.sospechosos.length || paso.opciones.some((o, i) => o.valor_taller !== i || o.correcta !== (i === real)))
            err.push(`${u.id}/${donde}: la opción i debe corresponder a la causa i, y solo la causa real es correcta`)
        }
      }
    }
  }
  return err
}
