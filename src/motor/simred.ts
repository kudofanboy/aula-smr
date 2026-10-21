// Simulador de red local de la UD1 de Redes.
// Reglas (fichas: docs/simulaciones/red.md):
// - Hub: repite la señal por todos los puertos menos el de entrada (temario pág. 2; resumen págs. 4-5).
// - Switch: aprende la MAC de origen en el puerto de entrada; si conoce el destino lo envía solo por ese puerto,
//   si no lo conoce inunda todos los puertos menos el de entrada (resumen pág. 5: "actúa como un hub" al principio).
// - Bus: la señal llega a todos los equipos del cable; cada uno descarta lo que no es para él (temario pág. 3).
// - Anillo: el mensaje pasa de nodo en nodo en un sentido hasta llegar al destino (temario pág. 3).
//   En Token Ring real (IEEE 802.5) la trama sigue hasta volver al emisor, que la retira: se indica como matiz.
// - Averías según la tabla de topologías del temario (pág. 3).
import type { z } from 'zod'
import type { EscenarioRed } from '../contenido/esquema'

export type Escenario = z.infer<typeof EscenarioRed>

export interface Nodo {
  id: string
  etiqueta: string
  tipo: 'pc' | 'hub' | 'switch' | 'terminador'
  x: number
  y: number
}
export interface Enlace {
  id: string
  a: string
  b: string
  /** En bus, los tramos del cable troncal. */
  troncal?: boolean
}
export interface Red {
  escenario: Required<Escenario>
  nodos: Nodo[]
  enlaces: Enlace[]
  /** Equipos finales en el orden del bus o del anillo. */
  pcs: string[]
  /** En árbol: qué switch intermedio cuelga cada PC. */
  ramaDe: Record<string, string>
}

const ANCHO = 600
const ALTO = 360

export function construirRed(esc: Escenario): Red {
  const n = esc.equipos ?? (esc.topologia === 'arbol' ? 4 : 5)
  const topologia = esc.topologia
  const centro = esc.centro ?? 'switch'
  const escenario = { topologia, centro, equipos: n } as Required<Escenario>
  const pcs = Array.from({ length: n }, (_, i) => `PC${i + 1}`)
  const nodos: Nodo[] = []
  const enlaces: Enlace[] = []
  const ramaDe: Record<string, string> = {}

  if (topologia === 'estrella') {
    nodos.push({ id: 'C', etiqueta: centro === 'hub' ? 'Hub' : 'Switch', tipo: centro, x: ANCHO / 2, y: ALTO / 2 })
    pcs.forEach((id, i) => {
      const ang = (2 * Math.PI * i) / n - Math.PI / 2
      nodos.push({ id, etiqueta: id, tipo: 'pc', x: ANCHO / 2 + Math.cos(ang) * 145, y: ALTO / 2 + Math.sin(ang) * 135 })
      enlaces.push({ id: `L-${id}`, a: id, b: 'C' })
    })
  } else if (topologia === 'bus') {
    const y = ALTO / 2
    nodos.push({ id: 'T1', etiqueta: 'Terminador', tipo: 'terminador', x: 40, y })
    pcs.forEach((id, i) => {
      const x = 90 + (i * (ANCHO - 180)) / (n - 1)
      nodos.push({ id, etiqueta: id, tipo: 'pc', x, y: i % 2 === 0 ? y - 95 : y + 95 })
    })
    nodos.push({ id: 'T2', etiqueta: 'Terminador', tipo: 'terminador', x: ANCHO - 40, y })
    // Tramos del troncal entre puntos de conexión
    const puntos = ['T1', ...pcs, 'T2']
    for (let i = 0; i < puntos.length - 1; i++) enlaces.push({ id: `B${i}`, a: puntos[i], b: puntos[i + 1], troncal: true })
  } else if (topologia === 'anillo') {
    pcs.forEach((id, i) => {
      const ang = (2 * Math.PI * i) / n - Math.PI / 2
      nodos.push({ id, etiqueta: id, tipo: 'pc', x: ANCHO / 2 + Math.cos(ang) * 150, y: ALTO / 2 + Math.sin(ang) * 135 })
    })
    pcs.forEach((id, i) => enlaces.push({ id: `R${i}`, a: id, b: pcs[(i + 1) % n] }))
  } else {
    // Árbol: switch raíz, dos switches intermedios y los PC repartidos entre ellos
    nodos.push({ id: 'R', etiqueta: 'Switch raíz', tipo: 'switch', x: ANCHO / 2, y: 50 })
    nodos.push({ id: 'S1', etiqueta: 'Switch A', tipo: 'switch', x: ANCHO * 0.27, y: 165 })
    nodos.push({ id: 'S2', etiqueta: 'Switch B', tipo: 'switch', x: ANCHO * 0.73, y: 165 })
    enlaces.push({ id: 'L-S1', a: 'S1', b: 'R' }, { id: 'L-S2', a: 'S2', b: 'R' })
    const mitad = Math.ceil(n / 2)
    pcs.forEach((id, i) => {
      const sw = i < mitad ? 'S1' : 'S2'
      const enRama = i < mitad ? i : i - mitad
      const total = i < mitad ? mitad : n - mitad
      const baseX = sw === 'S1' ? ANCHO * 0.27 : ANCHO * 0.73
      nodos.push({ id, etiqueta: id, tipo: 'pc', x: baseX + (enRama - (total - 1) / 2) * 85, y: 300 })
      enlaces.push({ id: `L-${id}`, a: id, b: sw })
      ramaDe[id] = sw
    })
  }
  return { escenario, nodos, enlaces, pcs, ramaDe }
}

export const DIMENSIONES = { ancho: ANCHO, alto: ALTO }

/** Tabla MAC de un switch: equipo -> puerto (el puerto se identifica por el equipo conectado en estrella). */
export type TablaMac = Record<string, string>

export interface ResultadoEnvio {
  /** Equipos a los que les llega la señal/trama (sin contar el emisor). */
  lesLlega: string[]
  /** De ellos, quién la acepta (el destino). */
  acepta: string
  /** Orden del recorrido (anillo) o de entrega, para animar. */
  recorrido: string[]
  /** Tabla MAC después del envío (solo switch). */
  tablaDespues?: TablaMac
  /** true si el switch inundó por no conocer el destino. */
  inundado?: boolean
}

/** Envía una trama unicast de origen a destino en una red sin averías. */
export function enviar(red: Red, origen: string, destino: string, tabla: TablaMac = {}): ResultadoEnvio {
  if (origen === destino) throw new Error('Origen y destino iguales')
  const { topologia, centro } = red.escenario
  const otros = red.pcs.filter((p) => p !== origen)
  if (topologia === 'bus') return { lesLlega: otros, acepta: destino, recorrido: otros }
  if (topologia === 'anillo') {
    const i = red.pcs.indexOf(origen)
    const recorrido: string[] = []
    for (let k = 1; k < red.pcs.length; k++) {
      const p = red.pcs[(i + k) % red.pcs.length]
      recorrido.push(p)
      if (p === destino) break
    }
    return { lesLlega: recorrido, acepta: destino, recorrido }
  }
  if (topologia === 'estrella' && centro === 'hub') return { lesLlega: otros, acepta: destino, recorrido: otros }
  if (topologia === 'estrella') {
    const tablaDespues = { ...tabla, [origen]: origen }
    if (tabla[destino]) return { lesLlega: [destino], acepta: destino, recorrido: [destino], tablaDespues, inundado: false }
    return { lesLlega: otros, acepta: destino, recorrido: otros, tablaDespues, inundado: true }
  }
  throw new Error('Envío en árbol no simulado en esta versión')
}

export type Averia =
  | { tipo: 'cable-pc'; pc: string } // se corta el cable de un equipo (estrella / árbol)
  | { tipo: 'centro' } // se avería el hub/switch central (estrella)
  | { tipo: 'troncal'; tramo: string } // se corta el cable troncal (bus)
  | { tipo: 'nodo-anillo'; pc: string } // se avería un equipo del anillo
  | { tipo: 'switch'; sw: 'R' | 'S1' | 'S2' } // se avería un switch del árbol

/**
 * Con qué equipos puede seguir comunicándose `desde` tras la avería (sin contarse a sí mismo).
 * Modelo del temario (pág. 3): estrella = solo cae el equipo del cable cortado, o toda la red si cae el central;
 * bus = un corte en el troncal rompe la red entera; anillo = la avería de un nodo interrumpe el paso de datos al resto;
 * árbol = la caída de un switch intermedio aísla su rama.
 */
export function alcanzables(red: Red, averia: Averia, desde: string): string[] {
  const { topologia } = red.escenario
  const otros = red.pcs.filter((p) => p !== desde)
  switch (topologia) {
    case 'estrella':
      if (averia.tipo === 'centro') return []
      if (averia.tipo === 'cable-pc') return averia.pc === desde ? [] : otros.filter((p) => p !== averia.pc)
      break
    case 'bus':
      if (averia.tipo === 'troncal') return []
      break
    case 'anillo':
      if (averia.tipo === 'nodo-anillo') return []
      break
    case 'arbol': {
      if (averia.tipo === 'cable-pc') return averia.pc === desde ? [] : otros.filter((p) => p !== averia.pc)
      if (averia.tipo === 'switch') {
        const miRama = red.ramaDe[desde]
        if (averia.sw === miRama) return []
        if (averia.sw === 'R') return otros.filter((p) => red.ramaDe[p] === miRama)
        return otros.filter((p) => red.ramaDe[p] !== averia.sw)
      }
      break
    }
  }
  throw new Error(`Avería ${averia.tipo} no válida en ${topologia}`)
}

/** Descripción corta de una avería para enunciados. */
/** Nodos o enlaces que se dibujan como averiados. */
export function averiados(red: Red, a?: Averia): Set<string> {
  const s = new Set<string>()
  if (a?.tipo === 'centro') s.add('C')
  if (a?.tipo === 'nodo-anillo') s.add(a.pc)
  if (a?.tipo === 'switch') s.add(a.sw)
  if (a?.tipo === 'troncal') s.add(a.tramo)
  if (a?.tipo === 'cable-pc') {
    const e = red.enlaces.find((x) => x.a === a.pc || x.b === a.pc)
    if (e) s.add(e.id)
  }
  return s
}

export function describirAveria(red: Red, a: Averia): string {
  switch (a.tipo) {
    case 'cable-pc':
      return `se corta el cable de ${a.pc}`
    case 'centro':
      return `se avería el ${red.escenario.centro} central`
    case 'troncal':
      return 'se corta el cable troncal del bus'
    case 'nodo-anillo':
      return `se avería ${a.pc}`
    case 'switch':
      return `se avería el ${a.sw === 'R' ? 'switch raíz' : a.sw === 'S1' ? 'Switch A' : 'Switch B'}`
  }
}
