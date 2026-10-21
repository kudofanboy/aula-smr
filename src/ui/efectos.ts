// Efectos visuales del juego: transiciones entre pantallas, brillo que sigue al puntero y profundidad (paralaje).
// Todo respeta la preferencia del sistema "reducir movimiento" y el interruptor de animaciones del juego.
import { flushSync } from 'react-dom'

/** ¿Se pueden usar animaciones? Falso con "reducir movimiento" del sistema o con el interruptor del juego apagado. */
export function animacionesActivas(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (document.documentElement.dataset.animaciones === 'no') return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Profundidad de cada pantalla en el recorrido: sirve para decidir hacia dónde se desliza la transición. */
const NIVEL: Record<string, number> = {
  inicio: 0, agenda: 0, expediente: 0, profesorado: 0, encargos: 0,
  departamento: 1, practica: 1, apuntes: 2, encargo: 2, sesion: 2, resultado: 3,
}

export type Direccion = 'adelante' | 'atras' | 'lateral'

/** Entrar más adentro (panel → departamento → lección) desliza hacia la izquierda; volver, hacia la derecha; cambiar de pestaña, sube y funde. */
export function direccionNavegacion(de: string, a: string): Direccion {
  const d = (NIVEL[a] ?? 1) - (NIVEL[de] ?? 1)
  return d > 0 ? 'adelante' : d < 0 ? 'atras' : 'lateral'
}

interface Transicion { ready: Promise<void>; updateCallbackDone: Promise<void>; finished: Promise<void> }
type ConTransicion = Document & { startViewTransition?: (cb: () => void) => Transicion }

/** Si el navegador no llega a pintar (ventana oculta o en segundo plano), la transición no avanza: el cambio se aplica igualmente pasado este tiempo. */
const ESPERA_MAXIMA_MS = 450

/**
 * Ejecuta un cambio de pantalla con una transición suave (API View Transitions, disponible en Edge y Chrome).
 * Si el navegador no la tiene, o hay animaciones desactivadas, el cambio es instantáneo como siempre.
 */
export function conTransicion(cambiar: () => void, direccion: Direccion) {
  const doc = document as ConTransicion
  if (!animacionesActivas() || typeof doc.startViewTransition !== 'function' || document.visibilityState !== 'visible') {
    cambiar()
    return
  }
  document.documentElement.dataset.nav = direccion
  let aplicado = false
  // Pase lo que pase con la transición, el cambio de pantalla se aplica una sola vez.
  const aplicar = () => {
    if (aplicado) return
    aplicado = true
    flushSync(cambiar)
  }
  try {
    const t = doc.startViewTransition(aplicar)
    const respaldo = window.setTimeout(aplicar, ESPERA_MAXIMA_MS)
    const ignorar = () => undefined
    void t.ready.catch(ignorar)
    void t.updateCallbackDone.catch(ignorar).finally(() => window.clearTimeout(respaldo))
    void t.finished.catch(ignorar).finally(() => { delete document.documentElement.dataset.nav })
  } catch {
    aplicar()
    delete document.documentElement.dataset.nav
  }
}

/** Elementos sobre los que el brillo sigue al puntero. */
const SELECTOR_BRILLO = '.tarjeta-panel, .puesto, .trabajo-cliente, .resumen-unidad, .guia-rapida, .tarjeta-resultado, .panel'

let brilloIniciado = false

/** Un halo de luz sigue al puntero dentro de las tarjetas (variables CSS --mx y --my). Se instala una sola vez. */
export function iniciarBrillo() {
  if (brilloIniciado || typeof document === 'undefined') return
  brilloIniciado = true
  let espera = 0
  document.addEventListener('pointermove', (e) => {
    if (espera || e.pointerType === 'touch' || !animacionesActivas()) return
    espera = requestAnimationFrame(() => {
      espera = 0
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(SELECTOR_BRILLO)
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    })
  }, { passive: true })
}

/** Con el puntero sobre un contenedor, calcula su posición relativa (-1 a 1) para mover capas a distinta profundidad. */
export function paralaje(el: HTMLElement, e: { clientX: number; clientY: number }) {
  if (!animacionesActivas()) return
  const r = el.getBoundingClientRect()
  el.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3))
  el.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3))
}

export function reposoParalaje(el: HTMLElement) {
  el.style.setProperty('--px', '0')
  el.style.setProperty('--py', '0')
}
