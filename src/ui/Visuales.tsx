// Dibujos propios (SVG) del juego. Las zonas pulsables usan los ids de contenido/integridad.ts (ZONAS_VISUAL).
import type { ReactNode } from 'react'
import type { Visual } from '../contenido/esquema'
import { construirRed, DIMENSIONES, type Escenario, type Red } from '../motor/simred'

export interface PropsZonas {
  /** Si se pasa, las zonas se pueden pulsar. */
  onZona?: (id: string) => void
  zonasVistas?: Set<string>
  zonaActiva?: string
}

function Zona(props: PropsZonas & { id: string; children: ReactNode }) {
  const { id, onZona, zonasVistas, zonaActiva, children } = props
  if (!onZona) return <g>{children}</g>
  const clase = ['zona', zonasVistas?.has(id) ? 'vista' : 'pendiente', zonaActiva === id ? 'activa' : ''].join(' ')
  return (
    <g className={clase} onClick={() => onZona(id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onZona(id)} aria-label={id}>
      {children}
    </g>
  )
}

function Caja({ x, y, w, h, texto, sub, clase = '' }: { x: number; y: number; w: number; h: number; texto: string; sub?: string; clase?: string }) {
  return (
    <g className={`caja ${clase}`}>
      <rect x={x} y={y} width={w} height={h} rx={10} />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -4 : 5)} textAnchor="middle" className="t-caja">{texto}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 16} textAnchor="middle" className="t-sub">{sub}</text>}
    </g>
  )
}

export function VonNeumann(p: PropsZonas) {
  // Todos los componentes se comunican a través de los buses (no hay conexiones directas entre ellos).
  return (
    <svg viewBox="0 0 600 330" className="dibujo" role="img" aria-label="Arquitectura de Von Neumann">
      <rect x={20} y={20} width={230} height={210} rx={14} className="marco-cpu" />
      <text x={135} y={45} textAnchor="middle" className="t-titulo">CPU</text>
      <Zona {...p} id="uc"><Caja x={35} y={60} w={200} h={46} texto="Unidad de Control (UC)" /></Zona>
      <Zona {...p} id="alu"><Caja x={35} y={116} w={200} h={46} texto="ALU" sub="aritmética y lógica" /></Zona>
      <Zona {...p} id="registros"><Caja x={35} y={172} w={200} h={46} texto="Registros" /></Zona>
      <Zona {...p} id="ram"><Caja x={265} y={60} w={150} h={120} texto="Memoria (RAM)" sub="instrucciones + datos" clase="memoria" /></Zona>
      <Zona {...p} id="es"><Caja x={430} y={60} w={150} h={120} texto="Entrada/Salida" sub="teclado, pantalla…" clase="es" /></Zona>
      <Zona {...p} id="buses">
        <g className="bus-dibujo">
          <rect x={20} y={262} width={560} height={34} rx={8} />
          <text x={300} y={284} textAnchor="middle" className="t-caja">Buses: datos · direcciones · control</text>
          <line x1={135} y1={230} x2={135} y2={262} />
          <line x1={340} y1={180} x2={340} y2={262} />
          <line x1={505} y1={180} x2={505} y2={262} />
        </g>
      </Zona>
    </svg>
  )
}

export function CapasSO(p: PropsZonas) {
  const capas = [
    { id: 'usuario', t: 'Usuario', c: 'c1' },
    { id: 'aplicaciones', t: 'Aplicaciones', c: 'c2' },
    { id: 'so', t: 'Sistema Operativo', c: 'c3' },
    { id: 'hardware', t: 'Hardware', c: 'c4' },
  ]
  return (
    <svg viewBox="0 0 600 300" className="dibujo" role="img" aria-label="Capas: usuario, aplicaciones, sistema operativo, hardware">
      {capas.map((k, i) => (
        <Zona key={k.id} {...p} id={k.id}>
          <Caja x={60 + i * 25} y={20 + i * 68} w={480 - i * 50} h={56} texto={k.t} clase={k.c} />
        </Zona>
      ))}
    </svg>
  )
}

export function Disco(p: PropsZonas) {
  return (
    <svg viewBox="0 0 600 320" className="dibujo" role="img" aria-label="Estructura física de un disco duro">
      <Zona {...p} id="cilindro">
        <g className="cilindro">
          <ellipse cx={170} cy={90} rx={120} ry={34} />
          <ellipse cx={170} cy={170} rx={120} ry={34} />
          <ellipse cx={170} cy={250} rx={120} ry={34} />
          <ellipse cx={170} cy={90} rx={80} ry={22} className="pista-cil" />
          <ellipse cx={170} cy={170} rx={80} ry={22} className="pista-cil" />
          <ellipse cx={170} cy={250} rx={80} ry={22} className="pista-cil" />
          <text x={170} y={305} textAnchor="middle" className="t-sub">3 platos apilados</text>
        </g>
      </Zona>
      <Zona {...p} id="plato">
        <g className="plato"><circle cx={450} cy={150} r={125} /><circle cx={450} cy={150} r={12} className="eje" /></g>
      </Zona>
      <Zona {...p} id="pista">
        <circle cx={450} cy={150} r={85} className="pista" />
      </Zona>
      <Zona {...p} id="sector">
        {/* Un sector es un trozo de una pista (no una "porción de tarta" desde el centro) */}
        <path d="M 545 150 A 95 95 0 0 0 532.27 102.5 L 514.95 112.5 A 75 75 0 0 1 525 150 Z" className="sector" />
      </Zona>
    </svg>
  )
}

const POS_ESTADOS: Record<string, [number, number]> = {
  nuevo: [70, 60], listo: [230, 60], ejecucion: [320, 190], bloqueado: [510, 60], terminado: [510, 190],
}
const NOMBRES_ESTADOS: Record<string, string> = { nuevo: 'Nuevo', listo: 'Listo', ejecucion: 'En ejecución', bloqueado: 'Bloqueado', terminado: 'Terminado' }

export function EstadosProceso(p: PropsZonas & { resaltado?: string }) {
  // Transiciones del diagrama del tema (SOM UT1, pág. 3). Las flechas empiezan y acaban en el borde de las cajas.
  const flechas: { d: string; etiqueta: string; x: number; y: number }[] = [
    { d: 'M 132 60 L 164 60', etiqueta: 'admitido', x: 148, y: 30 },
    { d: 'M 205 82 Q 210 175 254 186', etiqueta: 'le toca la CPU', x: 150, y: 150 },
    { d: 'M 300 168 Q 300 120 266 86', etiqueta: 'fin de su turno', x: 345, y: 125 },
    { d: 'M 365 168 Q 420 115 474 86', etiqueta: 'espera E/S o evento', x: 470, y: 128 },
    { d: 'M 480 38 Q 385 0 285 36', etiqueta: 'llega la E/S o el evento', x: 385, y: 14 },
    { d: 'M 382 190 L 444 190', etiqueta: 'finaliza', x: 413, y: 180 },
  ]
  return (
    <svg viewBox="0 0 600 240" className="dibujo" role="img" aria-label="Estados de un proceso">
      <defs>
        <marker id="punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="punta" />
        </marker>
      </defs>
      <g className="flechas" style={{ pointerEvents: 'none' }}>
        {flechas.map((f) => (
          <g key={f.d}>
            <path d={f.d} className="flecha" markerEnd="url(#punta)" />
            <text x={f.x} y={f.y} textAnchor="middle" className="t-sub">{f.etiqueta}</text>
          </g>
        ))}
      </g>
      {Object.entries(POS_ESTADOS).map(([id, [x, y]]) => (
        <Zona key={id} {...p} id={id}>
          <Caja x={x - 62} y={y - 22} w={124} h={44} texto={NOMBRES_ESTADOS[id]} clase={p.resaltado === id ? 'resaltado' : ''} />
        </Zona>
      ))}
    </svg>
  )
}

export function AlcanceRedes(p: PropsZonas) {
  const tipos = [
    { id: 'pan', t: 'PAN', s: 'unos metros', r: 30 },
    { id: 'lan', t: 'LAN', s: 'oficina / edificio', r: 48 },
    { id: 'man', t: 'MAN', s: 'ciudad', r: 66 },
    { id: 'wan', t: 'WAN', s: 'países / mundo', r: 84 },
  ]
  return (
    <svg viewBox="0 0 600 240" className="dibujo" role="img" aria-label="Redes por alcance geográfico">
      {tipos.map((k, i) => (
        <Zona key={k.id} {...p} id={k.id}>
          <g className={`alcance a${i}`}>
            <circle cx={75 + i * 150} cy={100} r={k.r} />
            <text x={75 + i * 150} y={106} textAnchor="middle" className="t-caja">{k.t}</text>
            <text x={75 + i * 150} y={210} textAnchor="middle" className="t-sub">{k.s}</text>
          </g>
        </Zona>
      ))}
    </svg>
  )
}

export function Nic(p: PropsZonas & { pilotos?: { enlace: 'fijo' | 'apagado'; actividad: 'parpadea' | 'apagado' } }) {
  // Sin `pilotos` se dibuja el caso normal (enlace fijo y actividad parpadeando), como en la fase de descubrir.
  const enlace = p.pilotos?.enlace ?? 'fijo'
  const actividad = p.pilotos?.actividad ?? 'parpadea'
  return (
    <svg viewBox="0 0 600 260" className="dibujo" role="img" aria-label="Tarjeta de red vista desde fuera">
      <rect x={100} y={40} width={400} height={180} rx={12} className="chapa" />
      <Zona {...p} id="rj45">
        <g className="rj45"><rect x={220} y={90} width={160} height={100} rx={6} /><rect x={270} y={165} width={60} height={25} className="lengueta" /><text x={300} y={80} textAnchor="middle" className="t-sub">Conector RJ-45</text></g>
      </Zona>
      <Zona {...p} id="led-link">
        <g className={`led ${enlace === 'fijo' ? 'fijo' : 'off'}`}><circle cx={240} cy={110} r={11} /><text x={170} y={114} textAnchor="middle" className="t-sub">Link</text></g>
      </Zona>
      <Zona {...p} id="led-act">
        <g className={`led ${actividad === 'parpadea' ? 'parpadeo' : 'off'}`}><circle cx={360} cy={110} r={11} /><text x={430} y={114} textAnchor="middle" className="t-sub">Activity</text></g>
      </Zona>
    </svg>
  )
}

export interface EstadoDibujoRed {
  marcados?: Set<string>
  llegan?: Set<string>
  acepta?: string
  origen?: string
  destino?: string
  averiados?: Set<string>
  conectados?: Set<string>
  aislados?: Set<string>
  /** Piloto de enlace de cada equipo (true = encendido). Solo se dibuja si se indica. */
  pilotos?: Record<string, boolean>
}

/** Dibujo de una topología. Los nodos y enlaces se pueden pulsar (simulador) o se pueden pulsar zonas (explorar). */
export function DibujoRed(props: PropsZonas & { red?: Red; escenario?: Escenario; estado?: EstadoDibujoRed; onNodo?: (id: string) => void; onEnlace?: (id: string) => void }) {
  const red = props.red ?? construirRed(props.escenario!)
  const { estado = {}, onNodo, onEnlace } = props
  const pos = Object.fromEntries(red.nodos.map((n) => [n.id, n]))
  const z = (id: string, hijo: ReactNode) => (props.onZona ? <Zona {...props} id={id}>{hijo}</Zona> : hijo)
  const topo = red.escenario.topologia
  return (
    <MarcoDibujo>
    <svg viewBox={`0 0 ${DIMENSIONES.ancho} ${DIMENSIONES.alto}`} className="dibujo red" role={onNodo || onEnlace ? 'group' : 'img'} aria-label={`Red en ${topo}`}>
      {topo === 'bus' && z('troncal', (
        <g>
          {red.enlaces.map((e) => (
            <line key={e.id} x1={pos[e.a].x} y1={DIMENSIONES.alto / 2} x2={pos[e.b].x} y2={DIMENSIONES.alto / 2}
              className={`troncal ${estado.averiados?.has(e.id) ? 'roto' : ''} ${onEnlace ? 'pulsable' : ''}`}
              onClick={() => onEnlace?.(e.id)} />
          ))}
        </g>
      ))}
      {topo === 'bus' && red.pcs.map((pc) => (
        <line key={`d-${pc}`} x1={pos[pc].x} y1={pos[pc].y} x2={pos[pc].x} y2={DIMENSIONES.alto / 2} className="bajada" />
      ))}
      {topo !== 'bus' && red.enlaces.map((e) => (
        <line key={e.id} x1={pos[e.a].x} y1={pos[e.a].y} x2={pos[e.b].x} y2={pos[e.b].y}
          className={`cable ${estado.averiados?.has(e.id) ? 'roto' : ''} ${estado.llegan?.has(e.a) || estado.llegan?.has(e.b) ? 'activo' : ''} ${onEnlace ? 'pulsable' : ''}`}
          onClick={() => onEnlace?.(e.id)} />
      ))}
      {red.nodos.map((n) => {
        const clases = ['nodo', n.tipo]
        if (estado.origen === n.id) clases.push('origen')
        if (estado.destino === n.id) clases.push('destino')
        if (estado.llegan?.has(n.id)) clases.push(estado.acepta === n.id ? 'acepta' : 'llega')
        if (estado.marcados?.has(n.id)) clases.push('marcado')
        if (estado.averiados?.has(n.id)) clases.push('averiado')
        if (estado.conectados?.has(n.id)) clases.push('conectado')
        if (estado.aislados?.has(n.id)) clases.push('aislado')
        if (onNodo && n.tipo !== 'terminador') clases.push('pulsable')
        const cuerpo = n.tipo === 'terminador'
          ? <rect x={n.x - 9} y={n.y - 14} width={18} height={28} rx={3} />
          : n.tipo === 'pc'
            ? <g><rect x={n.x - 26} y={n.y - 20} width={52} height={34} rx={5} /><rect x={n.x - 12} y={n.y + 15} width={24} height={6} rx={2} className="pie" /></g>
            : <rect x={n.x - 42} y={n.y - 18} width={84} height={36} rx={8} />
        const zona = n.tipo === 'pc' ? 'equipo' : n.tipo === 'terminador' ? 'terminador' : n.id === 'R' ? 'raiz' : n.id.startsWith('S') ? 'intermedio' : 'centro'
        const nodo = (
          <g key={n.id} className={clases.join(' ')} onClick={() => onNodo?.(n.id)}
            {...(onNodo && n.tipo !== 'terminador' ? {
              role: 'button', tabIndex: 0,
              'aria-label': estado.pilotos && n.id in estado.pilotos ? `${n.etiqueta}, piloto de enlace ${estado.pilotos[n.id] ? 'encendido' : 'apagado'}` : n.etiqueta,
              onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNodo(n.id) } },
            } : {})}>
            {cuerpo}
            <text x={n.x} y={n.tipo === 'pc' ? n.y + 2 : n.y + 5} textAnchor="middle" className="t-nodo">{n.tipo === 'terminador' ? '' : n.etiqueta}</text>
            {n.tipo === 'terminador' && <text x={n.x} y={n.y + 32} textAnchor="middle" className="t-sub">Terminador</text>}
            {estado.pilotos && n.id in estado.pilotos && <circle cx={n.x + 22} cy={n.y - 17} r={5.5} className={`piloto ${estado.pilotos[n.id] ? 'on' : 'off'}`} />}
          </g>
        )
        return props.onZona ? <Zona key={n.id} {...props} id={zona}>{nodo}</Zona> : nodo
      })}
    </svg>
    </MarcoDibujo>
  )
}

/* ---------- Siluetas de equipos (compartidas por los esquemas) ---------- */
// Tamaño base 64 × 52; (x, y) es la esquina superior izquierda y `escala` amplía desde ahí.
type Silueta = { x: number; y: number; escala?: number; clase?: string }
const situar = (x: number, y: number, escala = 1) => `translate(${x} ${y}) scale(${escala})`

export function SiluetaPC({ x, y, escala, clase = '' }: Silueta) {
  return (
    <g className={`equipo-svg ${clase}`} transform={situar(x, y, escala)}>
      <rect x={4} y={0} width={56} height={38} rx={5} className="eq-cuerpo" />
      <rect x={9} y={5} width={46} height={27} rx={2} className="eq-pantalla" />
      <path d="M27 38h10l3 8H24z" className="eq-cuerpo" />
      <rect x={16} y={46} width={32} height={5} rx={2.5} className="eq-cuerpo" />
    </g>
  )
}

export function SiluetaImpresora({ x, y, escala, clase = '' }: Silueta) {
  return (
    <g className={`equipo-svg ${clase}`} transform={situar(x, y, escala)}>
      <rect x={16} y={0} width={32} height={14} rx={2} className="eq-papel" />
      <rect x={2} y={12} width={60} height={26} rx={6} className="eq-cuerpo" />
      <rect x={14} y={31} width={36} height={19} rx={2} className="eq-papel" />
      <line x1={20} y1={39} x2={44} y2={39} className="eq-linea" />
      <line x1={20} y1={44} x2={38} y2={44} className="eq-linea" />
      <circle cx={52} cy={21} r={2.6} className="eq-led" />
    </g>
  )
}

export function SiluetaPortatil({ x, y, escala, clase = '' }: Silueta) {
  return (
    <g className={`equipo-svg ${clase}`} transform={situar(x, y, escala)}>
      <rect x={10} y={4} width={44} height={31} rx={3} className="eq-cuerpo" />
      <rect x={14} y={8} width={36} height={23} rx={1.5} className="eq-pantalla" />
      <path d="M2 37h60l-4 8H6z" className="eq-cuerpo" />
    </g>
  )
}

/** Insignia de texto con icono: la clasificación se lee sin depender del color. */
function Insignia({ cx, y, texto, si }: { cx: number; y: number; texto: string; si: boolean }) {
  const ancho = texto.length * 8.2 + 44
  const izq = cx - ancho / 2
  return (
    <g className={`insignia-svg ${si ? 'si' : 'no'}`}>
      <rect x={izq} y={y} width={ancho} height={26} rx={13} />
      <text x={izq + 32} y={y + 18}>{texto}</text>
      {si
        ? <path d={`M${izq + 12} ${y + 13.5}l4 4 7-8`} className="insignia-icono" />
        : <path d={`M${izq + 13} ${y + 8.5}l8 9m0-9l-8 9`} className="insignia-icono" />}
    </g>
  )
}

/** Un equipo con su nombre, su clasificación y una nota breve, centrado en `cx`. */
function Rotulo({ cx, y, nombre, insignia, si, nota }: { cx: number; y: number; nombre: string; insignia: string; si: boolean; nota: string }) {
  return (
    <g>
      <text x={cx} y={y} textAnchor="middle" className="t-equipo">{nombre}</text>
      <Insignia cx={cx} y={y + 10} texto={insignia} si={si} />
      <text x={cx} y={y + 56} textAnchor="middle" className="t-nota">{nota}</text>
    </g>
  )
}

/** Cable que baja desde la franja de la red hasta el equipo, con su conector. */
function Cable({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return (
    <g className="cable-svg">
      <line x1={x} y1={y1} x2={x} y2={y2 - 7} />
      <rect x={x - 5} y={y2 - 9} width={10} height={9} rx={2} className="conector" />
    </g>
  )
}

const DESCRIPCION_NODOS = 'Esquema conceptual. Dentro de esta red, un PC y una impresora conectados mediante cables: los dos son nodos. '
  + 'El cable es el medio de conexión y no es un nodo. Fuera de la red, un portátil sin conexión: no es un nodo de esta red.'

/**
 * Qué es un nodo: dos equipos conectados (nodos), el cable (medio de conexión) y un portátil desconectado.
 * Es un esquema conceptual: la franja «Esta red» no representa ningún aparato ni una topología concreta.
 * Hay dos composiciones (horizontal y vertical) y el CSS muestra la que cabe; la oculta no se anuncia.
 */
export function NodosRed() {
  return (
    <div className="esquema-nodos">
      <svg viewBox="0 0 760 300" className="dibujo nodos-red horizontal" role="img" aria-label={DESCRIPCION_NODOS}>
        <rect x={14} y={14} width={486} height={272} rx={20} className="region-red" />
        <rect x={30} y={28} width={454} height={34} rx={17} className="banda-red" />
        <text x={257} y={50} textAnchor="middle" className="t-red">Esta red</text>
        <Cable x={112} y1={62} y2={126} />
        <Cable x={402} y1={62} y2={128} />
        <SiluetaPC x={72} y={126} escala={1.25} />
        <SiluetaImpresora x={362} y={128} escala={1.25} />
        <g className="llamada-cable">
          <line x1={186} y1={95} x2={120} y2={95} />
          <circle cx={116} cy={95} r={4} />
          <text x={257} y={90} textAnchor="middle" className="t-equipo">Cable</text>
          <text x={257} y={110} textAnchor="middle" className="t-nota">Medio de conexión:</text>
          <text x={257} y={128} textAnchor="middle" className="t-nota">no es un nodo</text>
        </g>
        <Rotulo cx={112} y={214} nombre="PC" insignia="Nodo" si nota="Equipo conectado" />
        <Rotulo cx={402} y={214} nombre="Impresora" insignia="Nodo" si nota="Equipo conectado" />
        <SiluetaPortatil x={590} y={130} escala={1.25} clase="desconectado" />
        <Rotulo cx={630} y={214} nombre="Portátil" insignia="No es nodo" si={false} nota="Desconectado de esta red" />
      </svg>
      <svg viewBox="0 0 340 480" className="dibujo nodos-red vertical" role="img" aria-label={DESCRIPCION_NODOS}>
        <rect x={6} y={6} width={328} height={300} rx={18} className="region-red" />
        <rect x={20} y={18} width={300} height={32} rx={16} className="banda-red" />
        <text x={170} y={39} textAnchor="middle" className="t-red">Esta red</text>
        <Cable x={78} y1={50} y2={128} />
        <Cable x={262} y1={50} y2={130} />
        <SiluetaPC x={46} y={128} />
        <SiluetaImpresora x={230} y={130} />
        <g className="llamada-cable">
          <line x1={118} y1={82} x2={86} y2={82} />
          <circle cx={82} cy={82} r={4} />
          <text x={170} y={78} textAnchor="middle" className="t-equipo">Cable</text>
          <text x={170} y={97} textAnchor="middle" className="t-nota">Medio de</text>
          <text x={170} y={113} textAnchor="middle" className="t-nota">conexión: no</text>
          <text x={170} y={129} textAnchor="middle" className="t-nota">es un nodo</text>
        </g>
        <Rotulo cx={78} y={210} nombre="PC" insignia="Nodo" si nota="Conectado" />
        <Rotulo cx={262} y={210} nombre="Impresora" insignia="Nodo" si nota="Conectada" />
        <SiluetaPortatil x={138} y={330} clase="desconectado" />
        <Rotulo cx={170} y={404} nombre="Portátil" insignia="No es nodo" si={false} nota="Desconectado de esta red" />
      </svg>
    </div>
  )
}

/**
 * Envoltorio de los dibujos: en pantallas estrechas el dibujo mantiene un ancho mínimo y se desliza de lado,
 * para que sus textos se lean y sus zonas se puedan tocar (a 375 px, un viewBox de 600 dejaba textos de 6 px).
 */
export function MarcoDibujo({ children }: { children: ReactNode }) {
  return <div className="dibujo-marco">{children}</div>
}

export function DibujoVisual({ visual, ...zonas }: PropsZonas & { visual: Visual }) {
  if (visual.tipo === 'topologia' || visual.tipo === 'nodos-red' || visual.tipo === 'emoji') return <DibujoSinMarco visual={visual} {...zonas} />
  return <MarcoDibujo><DibujoSinMarco visual={visual} {...zonas} /></MarcoDibujo>
}

function DibujoSinMarco({ visual, ...zonas }: PropsZonas & { visual: Visual }) {
  switch (visual.tipo) {
    case 'topologia':
      return <DibujoRed escenario={visual.escenario} {...zonas} />
    case 'vonneumann':
      return <VonNeumann {...zonas} />
    case 'capas-so':
      return <CapasSO {...zonas} />
    case 'disco':
      return <Disco {...zonas} />
    case 'estados-proceso':
      return <EstadosProceso {...zonas} />
    case 'alcance-redes':
      return <AlcanceRedes {...zonas} />
    case 'nic':
      return <Nic {...zonas} />
    case 'nodos-red':
      return <NodosRed />
    case 'emoji':
      return <div className="emoji-grande" aria-hidden>{visual.emoji}</div>
  }
}
