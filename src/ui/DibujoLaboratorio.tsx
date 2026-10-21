// Esquema del laboratorio «Dos plantas, una avería». Variante visual propia: los nodos y los enlaces salen del
// mismo modelo (construirRed) que usa el motor; aquí solo cambia dónde y cómo se dibujan. Nunca recibe la avería:
// solo lo que el alumno ya puede ver (origen elegido, última pareja probada y pilotos consultados).
import type { KeyboardEvent } from 'react'
import type { Red } from '../motor/simred'

type Punto = { x: number; y: number }
type Plano = { ancho: number; alto: number; pos: Record<string, Punto>; plantas: { id: string; texto: string; x: number; y: number; w: number; h: number }[] }

/** Portátil y escritorio: el switch raíz arriba y una planta a cada lado. */
const HORIZONTAL: Plano = {
  ancho: 620, alto: 400,
  pos: {
    R: { x: 310, y: 48 }, S1: { x: 164, y: 172 }, S2: { x: 470, y: 172 },
    PC1: { x: 68, y: 298 }, PC2: { x: 164, y: 298 }, PC3: { x: 260, y: 298 }, PC4: { x: 410, y: 298 }, PC5: { x: 530, y: 298 },
  },
  plantas: [
    { id: 'S1', texto: 'Planta baja', x: 10, y: 104, w: 308, h: 288 },
    { id: 'S2', texto: 'Planta alta', x: 330, y: 104, w: 280, h: 288 },
  ],
}

/** Móvil: planta alta arriba, el switch raíz entre las dos y planta baja abajo. */
const VERTICAL: Plano = {
  ancho: 360, alto: 600,
  pos: {
    S2: { x: 180, y: 74 }, PC4: { x: 115, y: 172 }, PC5: { x: 245, y: 172 },
    R: { x: 180, y: 290 },
    S1: { x: 180, y: 402 }, PC1: { x: 66, y: 500 }, PC2: { x: 180, y: 500 }, PC3: { x: 294, y: 500 },
  },
  plantas: [
    { id: 'S2', texto: 'Planta alta', x: 6, y: 10, w: 348, h: 230 },
    { id: 'S1', texto: 'Planta baja', x: 6, y: 340, w: 348, h: 250 },
  ],
}

const PLANTA: Record<string, string> = { PC1: 'planta baja', PC2: 'planta baja', PC3: 'planta baja', PC4: 'planta alta', PC5: 'planta alta' }

export interface PropsDibujoLaboratorio {
  red: Red
  /** PC elegido como emisor (primer toque). */
  origen?: string
  /** Última pareja probada, tal como se anotó en el cuaderno. */
  ultima?: { a: string; b: string }
  pilotos?: Record<string, boolean>
  /** Si se pasa, los PCs se pueden elegir. */
  onPc?: (id: string) => void
}

function Esquema({ plano, clase, red, origen, ultima, pilotos, onPc }: PropsDibujoLaboratorio & { plano: Plano; clase: string }) {
  const p = plano.pos
  const media = (id: string) => (red.nodos.find((n) => n.id === id)?.tipo === 'pc' ? 34 : 22)
  return (
    <svg viewBox={`0 0 ${plano.ancho} ${plano.alto}`} className={`dibujo lab-esquema ${clase}`} role="group" aria-label="Red de dos plantas: switch raíz, Switch A con PC1 a PC3 en la planta baja y Switch B con PC4 y PC5 en la planta alta">
      {plano.plantas.map((z) => (
        <g key={z.id} className="lab-planta">
          <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={18} />
          <text x={z.x + 16} y={z.y + 26} className="t-planta">{z.texto}</text>
        </g>
      ))}
      {red.enlaces.map((e) => {
        const a = p[e.a], b = p[e.b]
        if (!a || !b) return null
        const [arriba, abajo] = a.y <= b.y ? [e.a, e.b] : [e.b, e.a]
        return <line key={e.id} x1={p[arriba].x} y1={p[arriba].y + media(arriba)} x2={p[abajo].x} y2={p[abajo].y - media(abajo)} className="lab-cable" />
      })}
      {red.nodos.filter((n) => n.tipo === 'switch').map((n) => (
        <g key={n.id} className={`lab-switch ${n.id === 'R' ? 'raiz' : ''}`} transform={`translate(${p[n.id].x} ${p[n.id].y})`}>
          <rect x={-66} y={-22} width={132} height={44} rx={9} className="sw-cuerpo" />
          <text x={-6} y={-2} textAnchor="middle" className="t-switch">{n.etiqueta}</text>
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x={-50 + i * 15} y={6} width={11} height={8} rx={1.5} className="sw-puerto" />)}
          <circle cx={52} cy={-6} r={3.5} className="sw-led" />
          <circle cx={52} cy={6} r={3.5} className="sw-led" />
        </g>
      ))}
      {red.pcs.map((id) => {
        const { x, y } = p[id]
        const esOrigen = origen === id
        const rol = !origen && ultima ? (ultima.a === id ? 'Desde' : ultima.b === id ? 'Hacia' : undefined) : esOrigen ? 'Desde' : undefined
        const piloto = pilotos && id in pilotos ? pilotos[id] : undefined
        const etiqueta = `${id}, ${PLANTA[id]}${piloto === undefined ? '' : `, piloto de enlace ${piloto ? 'encendido' : 'apagado'}`}${esOrigen ? ', elegido como emisor' : ''}`
        const interaccion = onPc ? {
          role: 'button', tabIndex: 0, 'aria-label': etiqueta, 'aria-pressed': esOrigen,
          onClick: () => onPc(id),
          onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPc(id) } },
        } : { role: 'img', 'aria-label': etiqueta }
        return (
          <g key={id} className={`lab-pc ${onPc ? 'pulsable' : ''} ${esOrigen ? 'origen' : ''} ${rol && !esOrigen ? 'probado' : ''}`} transform={`translate(${x} ${y})`} {...interaccion}>
            <rect x={-46} y={-48} width={92} height={106} rx={16} className="pc-zona" />
            <rect x={-38} y={-34} width={76} height={52} rx={7} className="pc-monitor" />
            <rect x={-31} y={-27} width={62} height={38} rx={3} className="pc-pantalla" />
            <text x={0} y={-2} textAnchor="middle" className="t-pc">{id}</text>
            <path d="M-8 18h16l3 10h-22z" className="pc-monitor" />
            <rect x={-22} y={28} width={44} height={6} rx={3} className="pc-monitor" />
            {piloto !== undefined && <circle cx={30} cy={-34} r={7} className={`piloto ${piloto ? 'on' : 'off'}`} />}
            {rol && <g className="pc-rol" transform="translate(0 46)"><rect x={-28} y={0} width={56} height={20} rx={10} /><text x={0} y={14.5} textAnchor="middle">{rol}</text></g>}
          </g>
        )
      })}
    </svg>
  )
}

/** Dibuja la composición que cabe (CSS): horizontal en pantallas anchas y vertical en móvil. La oculta no se anuncia. */
export function DibujoLaboratorio(props: PropsDibujoLaboratorio) {
  return (
    <div className="lab-dibujo">
      <Esquema {...props} plano={HORIZONTAL} clase="horizontal" />
      <Esquema {...props} plano={VERTICAL} clase="vertical" />
    </div>
  )
}
