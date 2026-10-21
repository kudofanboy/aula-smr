// Ilustraciones de las escenas pulsables de los encargos (SVG propio, adaptado al tema claro y oscuro).
// Cada elemento tiene un id (el mismo que usa el contenido y `ELEMENTOS_ESCENA` en el motor), un área para pulsar y su dibujo.
import type { ReactNode } from 'react'

export interface ElementoDibujo {
  /** Área rectangular pulsable (también es donde se dibuja el marcador). */
  area: { x: number; y: number; w: number; h: number }
  dibujo: ReactNode
}

/** Fondo de un taller de reparación: pared con ventana, suelo, banco de trabajo y mesa con silla. */
const fondoTaller = (
  <g className="esc-fondo">
    <rect x="0" y="0" width="600" height="236" className="esc-pared" />
    <rect x="0" y="236" width="600" height="124" className="esc-suelo" />
    <rect x="0" y="230" width="600" height="8" className="esc-rodapie" />
    {/* ventana al lado izquierdo, con luz entrando */}
    <rect x="26" y="26" width="146" height="124" rx="6" className="esc-ventana" />
    <line x1="99" y1="26" x2="99" y2="150" className="esc-marco" /><line x1="26" y1="88" x2="172" y2="88" className="esc-marco" />
    <rect x="26" y="26" width="146" height="124" rx="6" className="esc-marco-ext" />
    <polygon points="172,40 250,140 250,210 172,150" className="esc-luz" />
    {/* mesa de la pantalla */}
    <rect x="44" y="190" width="168" height="10" rx="3" className="esc-mueble" />
    <rect x="56" y="200" width="8" height="38" className="esc-mueble" /><rect x="192" y="200" width="8" height="38" className="esc-mueble" />
    {/* banco de trabajo del centro */}
    <rect x="236" y="198" width="196" height="10" rx="3" className="esc-mueble" />
    <rect x="248" y="208" width="8" height="30" className="esc-mueble" /><rect x="412" y="208" width="8" height="30" className="esc-mueble" />
    {/* enchufe de pared */}
    <rect x="404" y="148" width="22" height="30" rx="4" className="esc-enchufe" />
  </g>
)

const taller: Record<string, ElementoDibujo> = {
  'pantalla-ventana': {
    area: { x: 62, y: 98, w: 114, h: 96 },
    dibujo: (
      <g>
        <rect x="78" y="106" width="86" height="62" rx="5" className="esc-monitor" />
        <rect x="84" y="112" width="74" height="50" rx="2" className="esc-pantalla" />
        <polygon points="86,114 112,114 92,160 86,160" className="esc-reflejo" />
        <rect x="112" y="168" width="18" height="22" className="esc-monitor" />
        <rect x="98" y="186" width="46" height="5" rx="2" className="esc-monitor" />
      </g>
    ),
  },
  'equipo-abierto': {
    area: { x: 246, y: 98, w: 190, h: 104 },
    dibujo: (
      <g>
        <rect x="260" y="118" width="52" height="78" rx="4" className="esc-torre" />
        <circle cx="274" cy="130" r="3" className="esc-led-encendido" />
        {/* tapa lateral abierta, con el interior a la vista */}
        <polygon points="312,118 346,104 346,182 312,196" className="esc-tapa" />
        <rect x="266" y="146" width="40" height="10" rx="2" className="esc-placa" /><rect x="266" y="162" width="40" height="22" rx="2" className="esc-placa" />
        {/* cable enchufado a la pared */}
        <path d="M 300 192 C 340 214, 380 190, 402 164" className="esc-cable-corriente" />
        <rect x="396" y="158" width="14" height="14" rx="2" className="esc-clavija" />
        <path d="M 328 160 l -6 12 h 8 l -5 12" className="esc-rayo" />
      </g>
    ),
  },
  'cable-suelo': {
    area: { x: 232, y: 284, w: 158, h: 58 },
    dibujo: (
      <g>
        <path d="M 240 316 C 270 290, 306 340, 336 314 S 366 298, 378 318" className="esc-cable-suelo" />
        {/* extremo pelado: hilos de cobre a la vista */}
        <line x1="378" y1="318" x2="388" y2="310" className="esc-cobre" /><line x1="378" y1="318" x2="390" y2="318" className="esc-cobre" /><line x1="378" y1="318" x2="388" y2="326" className="esc-cobre" />
      </g>
    ),
  },
  'caja-pesada': {
    area: { x: 462, y: 244, w: 94, h: 84 },
    dibujo: (
      <g>
        <rect x="470" y="252" width="78" height="70" rx="3" className="esc-caja" />
        <rect x="470" y="252" width="78" height="14" className="esc-caja-tapa" />
        <line x1="509" y1="252" x2="509" y2="266" className="esc-cinta" />
        <text x="509" y="298" textAnchor="middle" className="esc-peso">35 kg</text>
      </g>
    ),
  },
  'caja-ligera': {
    area: { x: 400, y: 280, w: 48, h: 50 },
    dibujo: (
      <g>
        <rect x="408" y="290" width="34" height="32" rx="3" className="esc-caja" />
        <rect x="408" y="290" width="34" height="8" className="esc-caja-tapa" />
        <text x="425" y="314" textAnchor="middle" className="esc-peso pequeno">8 kg</text>
      </g>
    ),
  },
  diferencial: {
    area: { x: 468, y: 30, w: 110, h: 94 },
    dibujo: (
      <g>
        <rect x="476" y="36" width="94" height="80" rx="6" className="esc-cuadro" />
        <rect x="486" y="46" width="22" height="30" rx="3" className="esc-interruptor" /><rect x="514" y="46" width="22" height="30" rx="3" className="esc-interruptor" /><rect x="542" y="46" width="18" height="30" rx="3" className="esc-interruptor" />
        <rect x="486" y="84" width="50" height="24" rx="3" className="esc-diferencial" />
        <text x="511" y="100" textAnchor="middle" className="esc-texto-cuadro">30 mA</text>
        <circle cx="552" cy="96" r="6" className="esc-test" />
      </g>
    ),
  },
}

export const ESCENAS: Record<'taller', { fondo: ReactNode; elementos: Record<string, ElementoDibujo> }> = {
  taller: { fondo: fondoTaller, elementos: taller },
}
