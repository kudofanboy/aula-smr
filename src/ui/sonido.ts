// Sonidos cortos generados con Web Audio (sin ficheros, funcionan sin internet). Se pueden silenciar desde la barra lateral.
// Cada evento tiene su propio carácter: el acierto sube con el combo, el fallo es suave (no castiga), el ascenso suena a fanfarria
// y la llegada de un encargo a timbre de oficina. Todo pasa por un compresor y un volumen general bajo para no molestar.
let ctx: AudioContext | undefined
let salida: AudioNode | undefined
let activado = true

export function activarSonido(v: boolean) {
  activado = v
}

export type Tipo = 'bien' | 'mal' | 'suave' | 'clic' | 'record' | 'fin' | 'ascenso' | 'encargo' | 'logro' | 'paso'

interface Nota {
  /** Frecuencia en Hz. */
  f: number
  /** Segundos desde el inicio del sonido. */
  en: number
  /** Duración total (ataque corto + caída). */
  d: number
  /** Volumen relativo (0-1). */
  v?: number
  onda?: OscillatorType
  /** Añade una octava superior más suave (timbre de campana). */
  campana?: boolean
}

// Escala pentatónica mayor de do (suena bien con cualquier orden): do, re, mi, sol, la.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760]

const SONIDOS: Record<Exclude<Tipo, 'bien'>, Nota[]> = {
  // Tictac muy corto al pulsar o avanzar.
  clic: [{ f: 1100, en: 0, d: 0.035, v: 0.35 }],
  paso: [{ f: 740, en: 0, d: 0.05, v: 0.3 }, { f: 988, en: 0.04, d: 0.06, v: 0.25 }],
  // Fallo: dos notas descendentes y suaves, sin estridencia.
  mal: [{ f: 349, en: 0, d: 0.2, v: 0.5, onda: 'triangle' }, { f: 262, en: 0.12, d: 0.32, v: 0.5, onda: 'triangle' }],
  // Neutro (por ejemplo, una predicción errónea durante el descubrimiento).
  suave: [{ f: 440, en: 0, d: 0.16, v: 0.4, onda: 'triangle' }],
  // Fin de una sesión.
  fin: [{ f: 523.25, en: 0, d: 0.18, campana: true }, { f: 659.25, en: 0.12, d: 0.18, campana: true }, { f: 783.99, en: 0.24, d: 0.5, campana: true }],
  // Récord: arpegio ascendente con destello final.
  record: [
    { f: 523.25, en: 0, d: 0.14, campana: true }, { f: 659.25, en: 0.1, d: 0.14, campana: true }, { f: 783.99, en: 0.2, d: 0.14, campana: true },
    { f: 1046.5, en: 0.3, d: 0.22, campana: true }, { f: 1318.51, en: 0.42, d: 0.6, campana: true, v: 0.8 },
  ],
  // Ascenso de rango: fanfarria corta y brillante.
  ascenso: [
    { f: 392, en: 0, d: 0.16, onda: 'triangle' }, { f: 523.25, en: 0.14, d: 0.16, onda: 'triangle' }, { f: 659.25, en: 0.28, d: 0.16, onda: 'triangle' },
    { f: 783.99, en: 0.42, d: 0.2, onda: 'triangle' }, { f: 1046.5, en: 0.6, d: 0.8, campana: true, v: 0.9 }, { f: 783.99, en: 0.6, d: 0.8, onda: 'triangle', v: 0.4 },
  ],
  // Llegada de un encargo: timbre de oficina de dos tonos.
  encargo: [{ f: 880, en: 0, d: 0.35, campana: true, v: 0.8 }, { f: 659.25, en: 0.22, d: 0.55, campana: true, v: 0.8 }],
  // Objetivo del día cumplido: campanilla brillante.
  logro: [{ f: 1046.5, en: 0, d: 0.2, campana: true }, { f: 1567.98, en: 0.14, d: 0.6, campana: true, v: 0.8 }],
}

function preparar(): { c: AudioContext; destino: AudioNode } {
  if (!ctx) {
    ctx = new AudioContext()
    const compresor = ctx.createDynamicsCompressor()
    const general = ctx.createGain()
    general.gain.value = 0.55
    compresor.connect(general).connect(ctx.destination)
    salida = compresor
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return { c: ctx, destino: salida! }
}

function tocar(c: AudioContext, destino: AudioNode, t0: number, n: Nota) {
  const inicio = t0 + n.en
  const voz = (f: number, vol: number, onda: OscillatorType) => {
    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = onda
    osc.frequency.value = f
    // Ataque de 8 ms (evita chasquidos) y caída exponencial.
    env.gain.setValueAtTime(0.0001, inicio)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), inicio + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, inicio + n.d)
    osc.connect(env).connect(destino)
    osc.start(inicio)
    osc.stop(inicio + n.d + 0.02)
  }
  const vol = 0.2 * (n.v ?? 0.7)
  voz(n.f, vol, n.onda ?? 'sine')
  if (n.campana) voz(n.f * 2, vol * 0.35, 'sine')
}

/**
 * Reproduce un sonido. `nivel` solo afecta a 'bien': cada acierto seguido (combo) sube una nota de la escala,
 * hasta un tope, para que encadenar aciertos se note sin mirar la pantalla.
 */
export function sonar(tipo: Tipo, nivel = 0) {
  if (!activado) return
  try {
    const { c, destino } = preparar()
    const t0 = c.currentTime + 0.01
    if (tipo === 'bien') {
      const i = Math.min(Math.max(nivel, 0), 5)
      tocar(c, destino, t0, { f: PENTA[i], en: 0, d: 0.14, campana: true })
      tocar(c, destino, t0, { f: PENTA[i + 2], en: 0.09, d: 0.3, campana: true })
      return
    }
    for (const n of SONIDOS[tipo]) tocar(c, destino, t0, n)
  } catch {
    // Sin audio disponible: se ignora.
  }
}
