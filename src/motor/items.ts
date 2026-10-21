// Convierte ejercicios del contenido y generadores en "ítems" jugables, con el orden aleatorio ya aplicado.
import type { Ejercicio, Generador, Unidad, Visual } from '../contenido/esquema'
import { barajar, elegir, entero } from './azar'
import { alcanzables, construirRed, describirAveria, enviar, type Averia, type Escenario, type TablaMac } from './simred'
import { ESTADOS, NOMBRE_ESTADO, TRANSICIONES } from './proceso'

type Ref = { doc: string; pag: number }

export type Vista =
  | { motor: 'test'; enunciado: string; opciones: string[]; correcta: number; por_opcion?: string[]; visual?: Visual }
  | { motor: 'vf'; afirmacion: string; verdadero: boolean }
  | { motor: 'clasificar'; enunciado: string; categorias: { id: string; nombre: string }[]; elementos: { texto: string; categoria: string }[] }
  | { motor: 'ordenar'; enunciado: string; pasos: string[]; inicial: string[] }
  | { motor: 'emparejar'; enunciado: string; pares: { a: string; b: string }[]; derecha: string[] }
  | {
      motor: 'nodos'
      enunciado: string
      escenario: Escenario
      /** Equipos que se pueden marcar. */
      candidatos: string[]
      correctas: string[]
      origen?: string
      destino?: string
      tabla?: TablaMac
      averia?: Averia
      /** Equipo desde el que se pregunta (averías). */
      desde?: string
    }

export interface Item {
  /** Identificador estable para estadísticas: id del ejercicio o "gen:<tipo>". */
  clave: string
  unidadId: string
  conceptos: string[]
  dificultad: number
  fuente: Ref
  origen: 'juego' | 'profesor'
  explicacion: string
  vista: Vista
}

/** Motor "lógico" del ítem, para variar el tipo de pregunta entre repasos. */
export function motorDe(item: Item): string {
  return item.clave.startsWith('gen:') ? item.clave : item.vista.motor
}

export function itemDeEjercicio(e: Ejercicio, unidadId: string): Item {
  const base = { clave: e.id, unidadId, conceptos: e.conceptos, dificultad: e.dificultad, fuente: e.fuente, origen: e.origen, explicacion: e.explicacion }
  switch (e.motor) {
    case 'test': {
      const orden = barajar(e.opciones.map((_, i) => i))
      return {
        ...base,
        vista: {
          motor: 'test',
          enunciado: e.enunciado,
          visual: e.visual,
          opciones: orden.map((i) => e.opciones[i]),
          correcta: orden.indexOf(e.correcta),
          por_opcion: e.por_opcion ? orden.map((i) => e.por_opcion![i]) : undefined,
        },
      }
    }
    case 'vf':
      return { ...base, vista: { motor: 'vf', afirmacion: e.afirmacion, verdadero: e.verdadero } }
    case 'clasificar':
      return { ...base, vista: { motor: 'clasificar', enunciado: e.enunciado, categorias: e.categorias, elementos: barajar(e.elementos) } }
    case 'ordenar': {
      let inicial = barajar(e.pasos)
      while (inicial.every((p, i) => p === e.pasos[i])) inicial = barajar(e.pasos)
      return { ...base, vista: { motor: 'ordenar', enunciado: e.enunciado, pasos: e.pasos, inicial } }
    }
    case 'emparejar':
      return { ...base, vista: { motor: 'emparejar', enunciado: e.enunciado, pares: barajar(e.pares), derecha: barajar(e.pares.map((p) => p.b)) } }
  }
}

const NOMBRE_TOPO = { bus: 'Bus', estrella: 'Estrella', anillo: 'Anillo', arbol: 'Árbol' } as const

/** Crea un ítem nuevo a partir de un generador. Cada llamada da una variante distinta. */
export function itemDeGenerador(g: Generador, unidadId: string): Item {
  const base = { clave: `gen:${g.tipo}`, unidadId, conceptos: g.conceptos, fuente: g.fuente, origen: 'juego' as const }
  switch (g.tipo) {
    case 'red-identifica': {
      const topologia = elegir(g.topologias ?? (['bus', 'estrella', 'anillo', 'arbol'] as const))
      const escenario: Escenario = { topologia, centro: 'switch', equipos: entero(4, 6) }
      const opciones = barajar(['bus', 'estrella', 'anillo', 'arbol'] as const)
      return {
        ...base,
        dificultad: 1,
        explicacion: {
          bus: 'Bus: un único cable troncal compartido, con un terminador en cada extremo.',
          estrella: 'Estrella: cada equipo tiene su propio cable hasta un nodo central (switch o hub).',
          anillo: 'Anillo: cada equipo se une al anterior y al siguiente formando un circuito cerrado.',
          arbol: 'Árbol: estructura jerárquica en cascada, con un nodo raíz del que cuelgan otros conmutadores y, de ellos, los equipos.',
        }[topologia],
        vista: {
          motor: 'test',
          enunciado: '¿Qué topología física representa este esquema?',
          visual: { tipo: 'topologia', escenario },
          opciones: opciones.map((o) => NOMBRE_TOPO[o]),
          correcta: opciones.indexOf(topologia),
        },
      }
    }
    case 'red-quien-recibe': {
      const topologia = elegir(g.topologias ?? (['bus', 'estrella', 'anillo'] as const))
      const centro = elegir(g.centros ?? (['hub', 'switch'] as const))
      const escenario: Escenario = { topologia, centro, equipos: entero(4, 6) }
      const red = construirRed(escenario)
      const [origen, destino] = barajar(red.pcs).slice(0, 2)
      // Para el switch se genera una tabla MAC parcial, como si ya hubiera habido tráfico antes.
      let tabla: TablaMac | undefined
      if (topologia === 'estrella' && centro === 'switch') {
        tabla = {}
        for (const pc of red.pcs) if (Math.random() < 0.5) tabla[pc] = pc
        if (Math.random() < 0.5) tabla[destino] = destino
      }
      const r = enviar(red, origen, destino, tabla ?? {})
      const esAnillo = topologia === 'anillo'
      const dispositivo = topologia === 'estrella' ? (centro === 'hub' ? 'un hub' : 'un switch') : topologia === 'bus' ? 'un bus' : 'un anillo'
      let explicacion: string
      if (topologia === 'bus') explicacion = 'En un bus la señal viaja por el cable compartido y llega a todos los equipos. Cada uno lee la cabecera y descarta lo que no lleva su dirección; solo el destino lo acepta.'
      else if (esAnillo) explicacion = `En el anillo el mensaje pasa de equipo en equipo en un solo sentido: cada uno lo examina y, si no es para él, lo reenvía al siguiente. Recorrido: ${r.recorrido.join(' → ')}.`
      else if (centro === 'hub') explicacion = 'El hub repite la señal por todos sus puertos menos por el que entró. Todos los equipos la reciben y solo el destino la acepta.'
      else if (r.inundado) explicacion = `${destino} no está en la tabla MAC, así que el switch no sabe en qué puerto está: envía la trama por todos los puertos menos el de entrada (actúa "como un hub"). Además apunta que ${origen} está en su puerto.`
      else explicacion = `${destino} ya está en la tabla MAC: el switch envía la trama solo por su puerto. Nadie más la recibe.`
      return {
        ...base,
        dificultad: topologia === 'estrella' && centro === 'switch' ? 3 : 2,
        explicacion,
        vista: {
          motor: 'nodos',
          enunciado: esAnillo
            ? `En esta red en anillo los mensajes giran siempre en el mismo sentido: ${[...red.pcs, red.pcs[0]].join(' → ')}. ${origen} envía un mensaje a ${destino}. Marca los equipos por los que pasa el mensaje hasta llegar a su destino (incluido ${destino}).`
            : `En esta red con ${dispositivo}, ${origen} envía una trama a ${destino}. Marca todos los equipos a los que les llega (aunque luego la descarten).`,
          escenario,
          candidatos: red.pcs.filter((p) => p !== origen),
          correctas: r.lesLlega,
          origen,
          destino,
          tabla,
        },
      }
    }
    case 'red-averia': {
      const topologia = elegir(g.topologias ?? (['bus', 'estrella', 'anillo', 'arbol'] as const))
      const escenario: Escenario = { topologia, centro: elegir(g.centros ?? (['switch'] as const)), equipos: topologia === 'arbol' ? entero(4, 6) : entero(4, 6) }
      const red = construirRed(escenario)
      let averia: Averia
      if (topologia === 'estrella') averia = Math.random() < 0.6 ? { tipo: 'cable-pc', pc: elegir(red.pcs) } : { tipo: 'centro' }
      else if (topologia === 'bus') averia = { tipo: 'troncal', tramo: elegir(red.enlaces).id }
      else if (topologia === 'anillo') averia = { tipo: 'nodo-anillo', pc: elegir(red.pcs) }
      else averia = Math.random() < 0.3 ? { tipo: 'cable-pc', pc: elegir(red.pcs) } : { tipo: 'switch', sw: elegir(['R', 'S1', 'S2'] as const) }
      const posibles = red.pcs.filter((p) => !(averia.tipo === 'cable-pc' && averia.pc === p) && !(averia.tipo === 'nodo-anillo' && averia.pc === p))
      const desde = elegir(posibles)
      const correctas = alcanzables(red, averia, desde)
      const explicaciones: Record<string, string> = {
        'cable-pc': topologia === 'arbol'
          ? `Solo cae el equipo cuyo cable se ha cortado; el resto de la red sigue funcionando.`
          : `En estrella, si se rompe un cable solo cae ese equipo: el resto sigue comunicándose a través del nodo central.`,
        centro: `En estrella, si el nodo central (${escenario.centro}) se avería, cae toda la red: todo el tráfico pasaba por él.`,
        troncal: 'En bus, un corte en cualquier punto del cable troncal rompe la red entera (los extremos quedan sin terminador y la señal rebota).',
        'nodo-anillo': 'Según el tema, en anillo la avería de un solo nodo interrumpe el paso de datos al resto: el mensaje ya no puede dar la vuelta. (En Token Ring real, los concentradores MAU puenteaban al equipo averiado.)',
        switch: averia.tipo === 'switch' && averia.sw === 'R'
          ? 'Si cae el switch raíz, las dos ramas quedan separadas entre sí, pero los equipos de una misma rama siguen comunicándose a través de su switch.'
          : 'La caída de un switch intermedio aísla a toda su rama: sus equipos quedan sin red, y el resto sigue funcionando.',
      }
      return {
        ...base,
        dificultad: topologia === 'arbol' ? 3 : 2,
        explicacion: explicaciones[averia.tipo],
        vista: {
          motor: 'nodos',
          enunciado: `Red en ${NOMBRE_TOPO[topologia].toLowerCase()}: ${describirAveria(red, averia)}. Marca los equipos con los que ${desde} puede seguir comunicándose. Si no puede con ninguno, no marques nada.`,
          escenario,
          candidatos: red.pcs.filter((p) => p !== desde),
          correctas,
          averia,
          desde,
        },
      }
    }
    case 'proceso-transicion': {
      const t = elegir(TRANSICIONES)
      const evento = elegir(t.eventos)
      const opciones = barajar(ESTADOS.filter((e) => e !== t.de))
      return {
        ...base,
        dificultad: 2,
        explicacion: `Desde ${NOMBRE_ESTADO[t.de]}, esta situación lleva a ${NOMBRE_ESTADO[t.a]}. Recuerda: Listo = espera CPU; Bloqueado = espera un evento o E/S; en el diagrama del tema, a Terminado se llega desde En ejecución.`,
        vista: {
          motor: 'test',
          enunciado: `Un proceso está en estado «${NOMBRE_ESTADO[t.de]}». ${evento} ¿A qué estado pasa?`,
          visual: { tipo: 'estados-proceso' },
          opciones: opciones.map((e) => NOMBRE_ESTADO[e]),
          correcta: opciones.indexOf(t.a),
        },
      }
    }
  }
}

/** Todos los ítems posibles de una unidad (los estáticos). */
export function ejerciciosVisibles(u: Unidad, ocultos: Set<string>): Ejercicio[] {
  return u.ejercicios.filter((e) => e.verificado && !ocultos.has(e.id))
}

/**
 * Corrección detallada de una respuesta: qué eligió el alumno, qué está bien y qué mal elemento a elemento,
 * y cuál era la respuesta correcta. Es la base de `corregir` y de la revisión de la pantalla de resultados.
 * `respuesta` depende del motor; si falta (pregunta sin responder), todo cuenta como fallo.
 */
export type Revision =
  | { motor: 'test'; acierto: boolean; elegida?: string; correcta: string; porQue?: string }
  | { motor: 'vf'; acierto: boolean; elegida?: boolean; correcta: boolean }
  | { motor: 'clasificar'; acierto: boolean; elementos: { texto: string; puesta?: string; correcta: string; bien: boolean }[] }
  | { motor: 'ordenar'; acierto: boolean; tuyo: { texto: string; bien: boolean }[]; correcto: string[] }
  | { motor: 'emparejar'; acierto: boolean; pares: { a: string; elegida?: string; correcta: string; bien: boolean }[] }
  | { motor: 'nodos'; acierto: boolean; marcados: { id: string; bien: boolean }[]; faltan: string[]; correctas: string[] }

export function revisar(vista: Vista, respuesta: unknown): Revision {
  switch (vista.motor) {
    case 'test': {
      const i = typeof respuesta === 'number' ? respuesta : undefined
      const acierto = i === vista.correcta
      return {
        motor: 'test', acierto, correcta: vista.opciones[vista.correcta],
        elegida: i === undefined ? undefined : vista.opciones[i],
        porQue: i === undefined || acierto ? undefined : vista.por_opcion?.[i],
      }
    }
    case 'vf': {
      const elegida = typeof respuesta === 'boolean' ? respuesta : undefined
      return { motor: 'vf', acierto: elegida === vista.verdadero, elegida, correcta: vista.verdadero }
    }
    case 'clasificar': {
      const r = (respuesta ?? {}) as Record<number, string>
      const nombre = (id: string | undefined) => vista.categorias.find((c) => c.id === id)?.nombre
      const elementos = vista.elementos.map((el, i) => ({ texto: el.texto, puesta: nombre(r[i]), correcta: nombre(el.categoria) ?? el.categoria, bien: r[i] === el.categoria }))
      return { motor: 'clasificar', acierto: elementos.every((e) => e.bien), elementos }
    }
    case 'ordenar': {
      const r = Array.isArray(respuesta) ? (respuesta as string[]) : []
      const tuyo = r.map((texto, i) => ({ texto, bien: texto === vista.pasos[i] }))
      return { motor: 'ordenar', acierto: r.length === vista.pasos.length && tuyo.every((p) => p.bien), tuyo, correcto: vista.pasos }
    }
    case 'emparejar': {
      const r = (respuesta ?? {}) as Record<string, string>
      const pares = vista.pares.map((p) => ({ a: p.a, elegida: r[p.a], correcta: p.b, bien: r[p.a] === p.b }))
      return { motor: 'emparejar', acierto: pares.every((p) => p.bien), pares }
    }
    case 'nodos': {
      const r = new Set(Array.isArray(respuesta) ? (respuesta as string[]) : [])
      const correctas = new Set(vista.correctas)
      const marcados = [...r].sort().map((id) => ({ id, bien: correctas.has(id) }))
      const faltan = [...correctas].filter((c) => !r.has(c)).sort()
      return { motor: 'nodos', acierto: faltan.length === 0 && marcados.every((m) => m.bien), marcados, faltan, correctas: [...correctas].sort() }
    }
  }
}

/** Comprueba la respuesta de un ítem. `respuesta` depende del motor. */
export function corregir(vista: Vista, respuesta: unknown): boolean {
  return revisar(vista, respuesta).acierto
}
