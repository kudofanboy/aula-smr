// Lógica de los tableros interactivos de los encargos (sin interfaz, para poder probarla).
// Cada tablero devuelve un "valor" numérico que el encargo traduce a una de sus opciones (valor_taller).
import type { Tablero } from '../contenido/esquema'
import { alcanzables, construirRed, type Averia, type Red } from './simred'

type Conectar = Extract<Tablero, { tipo: 'conectar' }>
type Diagnostico = Extract<Tablero, { tipo: 'diagnostico' }>
type Maquina = Extract<Tablero, { tipo: 'maquina-virtual' }>
type Escena = Extract<Tablero, { tipo: 'escena' }>

/** Cable entre dos equipos; el orden no importa (se guarda con los ids ordenados). */
export type Cable = [string, string]

export const claveCable = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Resultado de revisar un cableado frente al objetivo (estrella con un equipo central). */
export const CONEXION = { CORRECTA: 0, SIN_CENTRO: 1, INCOMPLETA: 2, SOBRANTE: 3 } as const

const esFinal = (clase: string) => clase === 'pc' || clase === 'impresora'

/** Cables que debe tener la red: cada equipo final al central, el central al router y el router a Internet. */
export function cablesEsperados(t: Conectar): Set<string> {
  const esperados = new Set<string>()
  const router = t.nodos.find((n) => n.clase === 'router')
  const internet = t.nodos.find((n) => n.clase === 'internet')
  for (const n of t.nodos) if (esFinal(n.clase)) esperados.add(claveCable(n.id, t.centro))
  if (router) esperados.add(claveCable(t.centro, router.id))
  if (router && internet) esperados.add(claveCable(router.id, internet.id))
  return esperados
}

/**
 * Clasifica el cableado:
 * - SIN_CENTRO: algún equipo final está enlazado con otro equipo final o con el router/Internet, saltándose el central;
 * - SOBRANTE: hay cables que no deberían existir (por ejemplo, el central directo a Internet);
 * - INCOMPLETA: todos los cables puestos son correctos pero faltan algunos;
 * - CORRECTA: exactamente los cables esperados.
 */
export function evaluarConexion(t: Conectar, cables: Cable[]): number {
  const esperados = cablesEsperados(t)
  const puestos = new Set(cables.map(([a, b]) => claveCable(a, b)))
  const clase = new Map(t.nodos.map((n) => [n.id, n.clase]))
  const sobran = [...puestos].filter((c) => !esperados.has(c))
  const toca = (c: string) => c.split('|').some((id) => esFinal(clase.get(id) ?? ''))
  if (sobran.some(toca)) return CONEXION.SIN_CENTRO
  if (sobran.length > 0) return CONEXION.SOBRANTE
  if ([...esperados].some((c) => !puestos.has(c))) return CONEXION.INCOMPLETA
  return CONEXION.CORRECTA
}

/** Equipos con al menos un cable: su piloto de enlace se enciende (resumen UD1, pág. 4). */
export function equiposConectados(cables: Cable[]): Set<string> {
  return new Set(cables.flat())
}

export const redDeDiagnostico = (t: Diagnostico): Red => construirRed(t.escenario)

/** ¿Responde `b` cuando `a` le habla, con la avería del escenario? */
export function pruebaComunicacion(t: Diagnostico, a: string, b: string): boolean {
  if (a === b) throw new Error('Hay que elegir dos equipos distintos')
  return alcanzables(redDeDiagnostico(t), t.averia as Averia, a).includes(b)
}

/**
 * Piloto de enlace de cada equipo: encendido si su cable llega entero a un equipo central que funciona.
 * Solo tiene sentido en estrella y árbol (cada equipo con su cable al switch o hub).
 */
export function pilotos(t: Diagnostico): Record<string, boolean> {
  const red = redDeDiagnostico(t)
  const res: Record<string, boolean> = {}
  const a = t.averia
  for (const pc of red.pcs) {
    const enlace = red.enlaces.find((e) => e.id === `L-${pc}`)
    if (!enlace) continue
    const otro = enlace.a === pc ? enlace.b : enlace.a
    const cableRoto = a.tipo === 'cable-pc' && a.pc === pc
    const centroApagado = (a.tipo === 'centro' && otro === 'C') || (a.tipo === 'switch' && a.sw === otro)
    res[pc] = !cableRoto && !centroApagado
  }
  return res
}

/** Índice de la causa correcta entre los `sospechosos` según la avería real. */
export function causaReal(t: Diagnostico): string {
  const a = t.averia
  if (a.tipo === 'cable-pc') return `cable-${a.pc}`
  if (a.tipo === 'centro') return 'centro'
  return `switch-${a.sw}`
}

/** Comprueba que un tablero de diagnóstico está bien definido (lo usa la validación del contenido). */
export function errorDeDiagnostico(t: Diagnostico): string | undefined {
  try {
    const red = redDeDiagnostico(t)
    if (t.averia.tipo === 'cable-pc' && !red.pcs.includes(t.averia.pc)) return `el equipo ${t.averia.pc} no existe en el escenario`
    alcanzables(red, t.averia as Averia, red.pcs[0])
    if (!t.sospechosos.some((s) => s.id === causaReal(t))) return `ninguna causa coincide con la avería real (${causaReal(t)})`
    if (new Set(t.sospechosos.map((s) => s.id)).size !== t.sospechosos.length) return 'causas repetidas'
    return undefined
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/** Comprueba que un tablero de cableado está bien definido. */
export function errorDeConexion(t: Conectar): string | undefined {
  const ids = new Set(t.nodos.map((n) => n.id))
  if (ids.size !== t.nodos.length) return 'identificadores de equipo repetidos'
  const centro = t.nodos.find((n) => n.id === t.centro)
  if (!centro || (centro.clase !== 'switch' && centro.clase !== 'hub')) return 'el equipo central debe ser un switch o un hub'
  if (t.nodos.filter((n) => n.clase === 'switch' || n.clase === 'hub').length !== 1) return 'debe haber un solo dispositivo central'
  if (t.nodos.some((n) => n.clase === 'internet') && !t.nodos.some((n) => n.clase === 'router')) return 'Internet exige un router'
  if (t.nodos.filter((n) => esFinal(n.clase)).length < 2) return 'faltan equipos finales'
  return undefined
}

/* ---------------------------------------------------------------- Máquina virtual */

export type ModoRed = Maquina['red']
export interface ConfigMaquina { ram: number; nucleos: number; disco: number; tipoDisco: 'dinamico' | 'fijo'; red: ModoRed }

/** Resultado de revisar la configuración de una máquina virtual. */
export const MAQUINA = { CORRECTA: 0, INSUFICIENTE: 1, SOBRECARGA: 2, RED: 3 } as const

/**
 * - INSUFICIENTE: no llega a los mínimos del sistema invitado (no instalará o irá inservible);
 * - SOBRECARGA: cede al invitado más de lo razonable del anfitrión (RAM, núcleos o un disco fijo que reserva demasiado espacio);
 * - RED: el modo de red no cumple lo que pide el cliente;
 * - CORRECTA: cumple los mínimos, deja recursos al anfitrión y usa el modo de red pedido.
 * El tema solo dice "sin dejar sin RAM al host"; la fracción máxima es el criterio de cada caso (`reparto_max`).
 */
export function evaluarMaquina(t: Maquina, c: ConfigMaquina): number {
  if (c.ram < t.minimos.ram_gb || c.nucleos < t.minimos.nucleos || c.disco < t.minimos.disco_gb) return MAQUINA.INSUFICIENTE
  const m = t.reparto_max
  if (c.ram > t.host.ram_gb * m || c.nucleos > t.host.nucleos * m || (c.tipoDisco === 'fijo' && c.disco > t.host.disco_libre_gb * m)) return MAQUINA.SOBRECARGA
  return c.red === t.red ? MAQUINA.CORRECTA : MAQUINA.RED
}

/** Qué alcanza una VM según su modo de red en VirtualBox (tema SOM UT3, pág. 3). `null` = el tema no lo dice. */
export const ALCANCE_RED: Record<ModoRed, { nombre: string; internet: boolean; anfitrion: boolean | null; otrasVm: boolean; resumen: string }> = {
  nat: { nombre: 'NAT', internet: true, anfitrion: false, otrasVm: false, resumen: 'Sale a Internet; ni el anfitrión ni otras VM la ven.' },
  'nat-network': { nombre: 'Red NAT', internet: true, anfitrion: false, otrasVm: true, resumen: 'Como NAT, pero las VM se ven entre sí.' },
  interna: { nombre: 'Red interna', internet: false, anfitrion: false, otrasVm: true, resumen: 'Solo entre VM, sin Internet.' },
  'solo-anfitrion': { nombre: 'Solo anfitrión', internet: false, anfitrion: true, otrasVm: false, resumen: 'Solo el anfitrión y la VM, sin Internet.' },
  puente: { nombre: 'Adaptador puente', internet: true, anfitrion: true, otrasVm: true, resumen: 'La VM obtiene IP en la misma red física que el anfitrión: aparece como un equipo más.' },
}

/** Comprueba que el tablero admite una solución correcta y que los otros tres resultados son alcanzables. */
export function errorDeMaquina(t: Maquina): string | undefined {
  const redes: ModoRed[] = ['nat', 'nat-network', 'interna', 'solo-anfitrion', 'puente']
  const nucleos = Array.from({ length: t.host.nucleos }, (_, i) => i + 1)
  const alcanzados = new Set<number>()
  for (const ram of t.opciones_ram) for (const n of nucleos) for (const disco of t.opciones_disco) for (const tipoDisco of ['dinamico', 'fijo'] as const)
    for (const red of redes) alcanzados.add(evaluarMaquina(t, { ram, nucleos: n, disco, tipoDisco, red }))
  for (const v of Object.values(MAQUINA)) if (!alcanzados.has(v)) return `ninguna configuración da el resultado ${v}`
  if (t.minimos.ram_gb > t.host.ram_gb * t.reparto_max || t.minimos.nucleos > t.host.nucleos * t.reparto_max) return 'los mínimos del invitado superan lo que se puede ceder'
  return undefined
}

/* ---------------------------------------------------------------- Escena con riesgos */

/** Elementos pulsables que dibuja cada escena (los ids deben coincidir con los de la ilustración). */
export const ELEMENTOS_ESCENA: Record<Escena['escena'], string[]> = {
  taller: ['cable-suelo', 'equipo-abierto', 'pantalla-ventana', 'caja-pesada', 'diferencial', 'caja-ligera'],
}

/** Resultado de una revisión de riesgos: acertar todo, dejarse riesgos, marcar lo que estaba bien, o ambas cosas. */
export const ESCENA = { CORRECTA: 0, FALTAN: 1, SOBRAN: 2, AMBAS: 3 } as const

export function evaluarEscena(t: Escena, marcados: Set<string>): number {
  const faltan = t.elementos.some((e) => e.riesgo && !marcados.has(e.id))
  const sobran = t.elementos.some((e) => !e.riesgo && marcados.has(e.id))
  if (faltan && sobran) return ESCENA.AMBAS
  if (faltan) return ESCENA.FALTAN
  return sobran ? ESCENA.SOBRAN : ESCENA.CORRECTA
}

/** Veredicto de cada elemento tras revisar: para explicar uno a uno qué se vio bien y qué no. */
export function veredictoEscena(t: Escena, marcados: Set<string>) {
  return t.elementos.map((e) => ({
    ...e,
    marcado: marcados.has(e.id),
    acierto: e.riesgo === marcados.has(e.id),
  }))
}

export function errorDeEscena(t: Escena): string | undefined {
  const dibujados = new Set(ELEMENTOS_ESCENA[t.escena])
  const ids = t.elementos.map((e) => e.id)
  if (new Set(ids).size !== ids.length) return 'elementos repetidos'
  const fuera = ids.find((id) => !dibujados.has(id))
  if (fuera) return `el elemento "${fuera}" no existe en la escena ${t.escena}`
  if (t.elementos.filter((e) => e.riesgo).length < 2) return 'debe haber al menos dos riesgos'
  if (t.elementos.filter((e) => !e.riesgo).length < 1) return 'debe haber al menos un elemento que esté bien (si no, bastaría marcarlo todo)'
  return undefined
}

/* ---------------------------------------------------------------- Revisiones detalladas (se muestran al confirmar) */

export interface Linea { ok: boolean; texto: string }

/** Qué cables faltaban y cuáles sobraban, con los nombres de los equipos. */
export function revisionCableado(t: Conectar, cables: Cable[]): Linea[] {
  const nombre = new Map(t.nodos.map((n) => [n.id, n.etiqueta]))
  const par = (k: string) => k.split('|').map((id) => nombre.get(id) ?? id).join(' con ')
  const esperados = cablesEsperados(t)
  const puestos = new Set(cables.map(([a, b]) => claveCable(a, b)))
  const faltan = [...esperados].filter((k) => !puestos.has(k)).map((k) => ({ ok: false, texto: `Falta unir ${par(k)}.` }))
  const sobran = [...puestos].filter((k) => !esperados.has(k)).map((k) => ({ ok: false, texto: `Sobra el cable entre ${par(k)}.` }))
  if (faltan.length + sobran.length === 0) return [{ ok: true, texto: `Los ${esperados.size} cables son los que tocaban.` }]
  return [...sobran, ...faltan]
}

/** Cómo se nombra el límite de reparto de un caso: «la mitad» o un porcentaje. */
export function nombreReparto(m: number): string {
  return m === 0.5 ? 'la mitad' : `el ${Math.round(m * 100)} %`
}

/** Qué se cumple y qué no en una máquina virtual, con las cifras concretas. */
export function diagnosticoMaquina(t: Maquina, c: ConfigMaquina): Linea[] {
  const m = t.reparto_max
  const tope = (n: number) => Math.floor(n * m)
  const f = nombreReparto(m)
  const res: Linea[] = []
  res.push(c.ram < t.minimos.ram_gb
    ? { ok: false, texto: `RAM: ${c.ram} GB no llega al mínimo de ${t.minimos.ram_gb} GB.` }
    : c.ram > t.host.ram_gb * m
      ? { ok: false, texto: `RAM: ${c.ram} GB es más de ${f} de los ${t.host.ram_gb} GB del portátil (el límite del caso son ${tope(t.host.ram_gb)} GB).` }
      : { ok: true, texto: `RAM: ${c.ram} GB cumple el mínimo (${t.minimos.ram_gb} GB) y deja memoria al portátil.` })
  res.push(c.nucleos < t.minimos.nucleos
    ? { ok: false, texto: `Núcleos: ${c.nucleos} no llega al mínimo de ${t.minimos.nucleos}.` }
    : c.nucleos > t.host.nucleos * m
      ? { ok: false, texto: `Núcleos: ${c.nucleos} es más de ${f} de los ${t.host.nucleos} del portátil (el límite son ${tope(t.host.nucleos)}).` }
      : { ok: true, texto: `Núcleos: ${c.nucleos} cumple el mínimo (${t.minimos.nucleos}) y deja procesador al portátil.` })
  if (c.disco < t.minimos.disco_gb) res.push({ ok: false, texto: `Disco: ${c.disco} GB no llega al mínimo de ${t.minimos.disco_gb} GB.` })
  else if (c.tipoDisco === 'fijo' && c.disco > t.host.disco_libre_gb * m)
    res.push({ ok: false, texto: `Disco fijo: reserva ${c.disco} GB de golpe, más de ${f} de los ${t.host.disco_libre_gb} GB libres (el límite del caso son ${tope(t.host.disco_libre_gb)} GB). Uno dinámico crece solo cuando hace falta.` })
  else res.push({ ok: true, texto: c.tipoDisco === 'dinamico' ? `Disco dinámico: ${c.disco} GB como máximo, y ocupa solo lo que se va usando.` : `Disco fijo: ${c.disco} GB reservados caben en el espacio libre.` })
  res.push(c.red === t.red
    ? { ok: true, texto: `Red: ${ALCANCE_RED[c.red].nombre} es el modo que pedía el cliente.` }
    : { ok: false, texto: `Red: ${ALCANCE_RED[c.red].nombre} no es lo que pedía el cliente; hacía falta ${ALCANCE_RED[t.red].nombre}.` })
  return res
}
