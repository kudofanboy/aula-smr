import type { ReactNode } from 'react'
import { ELEMENTOS_OFICINA } from '../motor/inventario-oficina'
import './taller-oficina.css'

export type FaseTallerOficina = 'conexion' | 'inventario' | 'alcance'

export interface TallerOficinaProps {
  fase: FaseTallerOficina
  valor: number | undefined
  bloqueado: boolean
  alCambiar: (valor: number) => void
  conexion?: number
  alcance?: number
}

type Punto = { x: number; y: number }

function proyectar(x: number, y: number, z = 0): Punto {
  return { x: 370 + (x - y) * 0.72, y: 145 + (x + y) * 0.34 - z }
}

function puntosSvg(puntos: Punto[]) {
  return puntos.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

function trayectoSvg(puntos: Punto[], cerrar = false) {
  if (puntos.length === 0) return ''
  return `M${puntosSvg([puntos[0]])} ${puntos.slice(1).map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}${cerrar ? 'Z' : ''}`
}

function cara(x: number, y: number, z: number, puntos: [number, number, number][]) {
  return puntosSvg(puntos.map(([dx, dy, dz]) => proyectar(x + dx, y + dy, z + dz)))
}

function Caja({ x, y, w, d, h, z = 0, clase = '', children }: { x: number; y: number; w: number; d: number; h: number; z?: number; clase?: string; children?: ReactNode }) {
  return <g className={`to-caja ${clase}`}>
    <polygon className="to-caja-lado-x" points={cara(x, y, z, [[w, 0, 0], [w, d, 0], [w, d, h], [w, 0, h]])} />
    <polygon className="to-caja-lado-y" points={cara(x, y, z, [[0, d, 0], [w, d, 0], [w, d, h], [0, d, h]])} />
    <polygon className="to-caja-tapa" points={cara(x, y, z, [[0, 0, h], [w, 0, h], [w, d, h], [0, d, h]])} />
    {children}
  </g>
}

function Mesa({ x, y }: { x: number; y: number }) {
  const patas = [[5, 5], [86, 5], [5, 52], [86, 52]] as const
  return <g className="to-mesa">
    {patas.map(([dx, dy], i) => <Caja key={i} x={x + dx} y={y + dy} w={9} d={8} h={34} clase="to-pata" />)}
    <Caja x={x} y={y} w={100} d={65} h={5} z={34} clase="to-tablero" />
  </g>
}

function Monitor({ x, y }: { x: number; y: number }) {
  return <g className="to-monitor">
    <Caja x={x + 18} y={y + 13} w={9} d={6} h={7} z={39} clase="to-pie-monitor" />
    <Caja x={x + 9} y={y + 14} w={28} d={8} h={2} z={37} clase="to-base-monitor" />
    <Caja x={x + 6} y={y + 9} w={42} d={8} h={29} z={46} clase="to-carcasa-monitor">
      <polygon className="to-pantalla" points={puntosSvg([
        proyectar(x + 10, y + 17, 69), proyectar(x + 44, y + 17, 69),
        proyectar(x + 44, y + 17, 51), proyectar(x + 10, y + 17, 51),
      ])} />
      <path className="to-ui-pantalla" d={`M${proyectar(x + 13, y + 17, 64).x},${proyectar(x + 13, y + 17, 64).y} l18 -6 m-18 11 24 -8 m-24 13 14 -5`} />
    </Caja>
  </g>
}

function Silla({ x, y }: { x: number; y: number }) {
  return <g className="to-silla">
    <Caja x={x + 7} y={y + 5} w={26} d={25} h={5} z={17} clase="to-asiento" />
    <Caja x={x + 8} y={y + 28} w={24} d={4} h={27} z={22} clase="to-respaldo" />
    {[[9, 7], [30, 7], [9, 24], [30, 24]].map(([dx, dy], i) => <Caja key={i} x={x + dx} y={y + dy} w={3} d={3} h={17} clase="to-pata-silla" />)}
  </g>
}

function Puesto({ x, y, id, bit, inventario }: { x: number; y: number; id: string; bit: number; inventario: number }) {
  const activo = inventario >= 0 && (inventario & bit) !== 0
  const marca = proyectar(x + 29, y + 17, 62)
  const rotulo = proyectar(x + 54, y + 53, 41)
  return <g className={`to-puesto ${activo ? 'seleccionado' : ''}`}>
    <Mesa x={x} y={y} />
    <Monitor x={x + 20} y={y} />
    <Caja x={x + 28} y={y + 37} w={34} d={12} h={2} z={39} clase="to-teclado" />
    <path className="to-teclas" d={trayectoSvg([proyectar(x + 31, y + 40, 41), proyectar(x + 57, y + 40, 41)])} />
    <path className="to-documento" d={trayectoSvg([proyectar(x + 67, y + 31, 40), proyectar(x + 88, y + 31, 40), proyectar(x + 88, y + 48, 40), proyectar(x + 67, y + 48, 40)], true)} />
    <path className="to-lineas-documento" d={`M${proyectar(x + 70, y + 35, 40).x},${proyectar(x + 70, y + 35, 40).y} l9 -3 m-9 8 13 -4`} />
    <text className="to-rotulo" x={rotulo.x} y={rotulo.y} textAnchor="middle">{id}</text>
    <Silla x={x + 33} y={y + 68} />
    {inventario >= 0 && <g className={`to-marca ${activo ? 'seleccionado' : ''}`}><circle cx={marca.x} cy={marca.y} r="13" /><text x={marca.x} y={marca.y + 4} textAnchor="middle">{activo ? '✓' : '?'}</text></g>}
  </g>
}

function Impresora({ x, y, inventario }: { x: number; y: number; inventario: number }) {
  const activo = inventario >= 0 && (inventario & 8) !== 0
  const marca = proyectar(x + 52, y + 23, 59)
  const rotulo = proyectar(x + 55, y + 60, 50)
  return <g className={`to-impresora ${activo ? 'seleccionado' : ''}`}>
    <Caja x={x} y={y} w={108} d={69} h={43} clase="to-archivo" />
    <path className="to-puertas-archivo" d={trayectoSvg([proyectar(x + 54, y + 69, 6), proyectar(x + 54, y + 69, 39)])} />
    <path className="to-tiradores-archivo" d={trayectoSvg([proyectar(x + 42, y + 69, 24), proyectar(x + 48, y + 69, 24)]) + ' ' + trayectoSvg([proyectar(x + 60, y + 69, 24), proyectar(x + 66, y + 69, 24)])} />
    <Caja x={x + 21} y={y + 8} w={61} d={49} h={28} z={43} clase="to-carcasa-impresora">
      <polygon className="to-panel-impresora" points={puntosSvg([proyectar(x + 67, y + 57, 63), proyectar(x + 79, y + 57, 63), proyectar(x + 79, y + 57, 56), proyectar(x + 67, y + 57, 56)])} />
      <path className="to-ranura" d={trayectoSvg([proyectar(x + 30, y + 57, 55), proyectar(x + 59, y + 57, 55)])} />
    </Caja>
    <path className="to-papel-impresora" d={trayectoSvg([proyectar(x + 38, y + 12, 72), proyectar(x + 62, y + 12, 72), proyectar(x + 62, y + 34, 72), proyectar(x + 38, y + 34, 72)], true)} />
    <path className="to-lineas-papel" d={`M${proyectar(x + 42, y + 17, 72).x},${proyectar(x + 42, y + 17, 72).y} l11 -4 m-11 9 15 -5`} />
    <circle className="to-led" cx={proyectar(x + 73, y + 57, 59).x} cy={proyectar(x + 73, y + 57, 59).y} r="2.5" />
    <text className="to-rotulo to-rotulo-imp" x={rotulo.x} y={rotulo.y} textAnchor="middle">IMP</text>
    {inventario >= 0 && <g className={`to-marca ${activo ? 'seleccionado' : ''}`}><circle cx={marca.x} cy={marca.y} r="13" /><text x={marca.x} y={marca.y + 4} textAnchor="middle">{activo ? '✓' : '?'}</text></g>}
  </g>
}

function ReservaOficina({ inventario }: { inventario: number }) {
  const laptop = proyectar(333, 267, 14)
  const cable = proyectar(385, 298, 8)
  const laptopActivo = (inventario & 16) !== 0
  const cableActivo = (inventario & 32) !== 0
  return <g className="to-reserva" aria-hidden="true">
    <g className={laptopActivo ? 'seleccionado' : ''}>
      <path className="to-portatil" d={`M${laptop.x - 18},${laptop.y - 12} l25 -9 19 7 -25 10Z M${laptop.x - 18},${laptop.y - 12} l-3 6 23 8 3 -6Z`} />
      <path className="to-pantalla-portatil" d={`M${laptop.x - 13},${laptop.y - 12} l18 -7 12 5 -18 7Z`} />
      <text className="to-rotulo to-rotulo-reserva" x={laptop.x + 4} y={laptop.y + 14} textAnchor="middle">RES</text>
      <g className="to-marca"><circle cx={laptop.x + 24} cy={laptop.y - 17} r="10" /><text x={laptop.x + 24} y={laptop.y - 13} textAnchor="middle">{laptopActivo ? '✓' : '?'}</text></g>
    </g>
    <g className={cableActivo ? 'seleccionado' : ''}>
      <path className="to-cable-reserva" d={`M${cable.x - 13},${cable.y} c-8 -10 8 -16 13 -6 5 10 -9 14 -13 6 m2 -1 c-5 -8 5 -11 8 -4 3 6 -5 9 -8 4 M${cable.x},${cable.y} l12 -8`} />
      <text className="to-rotulo to-rotulo-reserva" x={cable.x + 11} y={cable.y + 12} textAnchor="middle">CAB</text>
      <g className="to-marca"><circle cx={cable.x + 27} cy={cable.y - 12} r="10" /><text x={cable.x + 27} y={cable.y - 8} textAnchor="middle">{cableActivo ? '✓' : '?'}</text></g>
    </g>
  </g>
}

function Escena({ conexion, inventario, alcance, fase }: { conexion?: number; inventario: number; alcance?: number; fase: FaseTallerOficina }) {
  const red = conexion === 1 || fase === 'inventario'
  const usb = conexion === 0
  const editor = conexion === 2
  const puestos = [
    { x: 40, y: 200, id: 'PC 01', bit: 1 },
    { x: 205, y: 200, id: 'PC 02', bit: 2 },
    { x: 40, y: 45, id: 'PC 03', bit: 4 },
  ].sort((a, b) => a.x + a.y - (b.x + b.y))
  const impresora = { x: 375, y: 55 }
  const izq = proyectar(0, 0), der = proyectar(500, 0), frenteDer = proyectar(500, 340), frenteIzq = proyectar(0, 340)
  const puestosP = puestos.map((p) => proyectar(p.x + 40, p.y + 24, 1))
  const impresoraP = proyectar(impresora.x + 52, impresora.y + 35, 1)
  return <div className={`to-escena ${red ? 'modo-red' : ''} ${usb ? 'modo-usb' : ''} ${editor ? 'modo-editor' : ''} ${fase === 'alcance' ? `modo-alcance alcance-${alcance ?? 0}` : ''}`} aria-describedby="to-descripcion-escena">
    <svg viewBox="0 0 800 470" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="to-wall" x1="0" x2="0" y1="0" y2="1"><stop stopColor="var(--to-muro-arriba)" /><stop offset="1" stopColor="var(--to-muro-abajo)" /></linearGradient>
        <linearGradient id="to-floor" x1="0" x2="0" y1="0" y2="1"><stop stopColor="var(--to-suelo-arriba)" /><stop offset="1" stopColor="var(--to-suelo-abajo)" /></linearGradient>
      </defs>
      <path d={`M${izq.x},${izq.y} ${der.x},${der.y} ${frenteDer.x},${frenteDer.y} ${frenteIzq.x},${frenteIzq.y}Z`} className="to-suelo" />
      {Array.from({ length: 6 }, (_, i) => (i + 1) * 50).map((y) => <path key={y} d={trayectoSvg([proyectar(0, y), proyectar(500, y)])} className="to-juntas" />)}
      <path d={`M${izq.x},${izq.y} ${der.x},${der.y} ${proyectar(500, 0, 85).x},${proyectar(500, 0, 85).y} ${proyectar(0, 0, 85).x},${proyectar(0, 0, 85).y}Z M${izq.x},${izq.y} ${frenteIzq.x},${frenteIzq.y} ${proyectar(0, 340, 85).x},${proyectar(0, 340, 85).y} ${proyectar(0, 0, 85).x},${proyectar(0, 0, 85).y}Z`} className="to-pared" />
      <g className="to-ventanas">
        <path d={trayectoSvg([proyectar(82, 0, 23), proyectar(187, 0, 23), proyectar(187, 0, 70), proyectar(82, 0, 70)], true)} />
        <path d={trayectoSvg([proyectar(265, 0, 23), proyectar(366, 0, 23), proyectar(366, 0, 70), proyectar(265, 0, 70)], true)} />
        <path d={trayectoSvg([proyectar(0, 56, 22), proyectar(0, 132, 22), proyectar(0, 132, 66), proyectar(0, 56, 66)], true)} />
        <path d={trayectoSvg([proyectar(82, 0, 46), proyectar(187, 0, 46)])} /><path d={trayectoSvg([proyectar(134, 0, 23), proyectar(134, 0, 70)])} />
        <path d={trayectoSvg([proyectar(0, 56, 44), proyectar(0, 132, 44)])} /><path d={trayectoSvg([proyectar(0, 95, 22), proyectar(0, 95, 66)])} />
      </g>
      <path className="to-zocalo" d={`M${proyectar(0, 0, 5).x},${proyectar(0, 0, 5).y} ${proyectar(500, 0, 5).x},${proyectar(500, 0, 5).y} M${proyectar(0, 0, 5).x},${proyectar(0, 0, 5).y} ${proyectar(0, 340, 5).x},${proyectar(0, 340, 5).y}`} />
      <path className="to-cables to-cable-red" d={`M${puestosP[0].x},${puestosP[0].y} Q390 385 ${impresoraP.x},${impresoraP.y} M${puestosP[1].x},${puestosP[1].y} Q480 350 ${impresoraP.x},${impresoraP.y} M${puestosP[2].x},${puestosP[2].y} Q420 292 ${impresoraP.x},${impresoraP.y}`} />
      <path className="to-usb" d={`M${puestosP[0].x},${puestosP[0].y} Q365 409 ${impresoraP.x},${impresoraP.y}`} />
      {puestos.map((p) => <Puesto key={p.bit} x={p.x} y={p.y} id={p.id} bit={p.bit} inventario={fase === 'inventario' ? inventario : -1} />)}
      <Impresora x={impresora.x} y={impresora.y} inventario={fase === 'inventario' ? inventario : -1} />
      {fase === 'inventario' && <ReservaOficina inventario={inventario} />}
      <g className="to-planta"><Caja x={444} y={275} w={28} d={28} h={16} clase="to-maceta" />
        <path d={`M${proyectar(452, 289, 16).x},${proyectar(452, 289, 16).y} Q${proyectar(430, 282, 65).x} ${proyectar(430, 282, 65).y} ${proyectar(437, 271, 61).x} ${proyectar(437, 271, 61).y} Q${proyectar(452, 289, 76).x} ${proyectar(452, 289, 76).y} ${proyectar(452, 289, 16).x} ${proyectar(452, 289, 16).y} M${proyectar(458, 290, 16).x},${proyectar(458, 290, 16).y} Q${proyectar(480, 283, 66).x} ${proyectar(480, 283, 66).y} ${proyectar(480, 270, 64).x} ${proyectar(480, 270, 64).y} Q${proyectar(463, 285, 76).x} ${proyectar(463, 285, 76).y} ${proyectar(458, 290, 16).x} ${proyectar(458, 290, 16).y}`} />
      </g>
      <g className="to-alcance to-local"><path d={`M${izq.x},${izq.y} ${der.x},${der.y} ${frenteDer.x},${frenteDer.y} ${frenteIzq.x},${frenteIzq.y}Z`} /></g>
      <g className="to-alcance to-sedes"><path d="M730 222 754 205" /><path d="M742 198v-28l25 -9 25 9v29Z" /><path d="M742 170l25 9 25 -9m-25 9v29m-15 -6v-15l9 3v15m15 4v-16l8 3v15" /><path d="m778 166 17 -6" /></g>
      <g className="to-alcance to-aislados"><path d="M383 122l5 -5m7 0 5 5m-123 49 5 -5m7 0 5 5m126 59 5 -5m7 0 5 5m229 17 5 -5m7 0 5 5" /></g>
      <text x="409" y="111" className="to-marca-estudio">ESTUDIO NORTE</text>
    </svg>
  </div>
}

function Conexion({ valor, bloqueado, alCambiar }: TallerOficinaProps) {
  const opciones = [
    ['USB', 'Trayecto manual entre un puesto y la impresora.'],
    ['Red', 'Conexiones simbólicas entre equipos dentro de la oficina.'],
    ['Editor', 'Documentos abiertos en cada puesto, sin compartirlos.'],
  ]
  return <><div className="to-controles" role="group" aria-label="Propuesta de conexión">
    {opciones.map(([titulo, texto], i) => <button key={titulo} className={valor === i ? 'activa' : ''} aria-pressed={valor === i} disabled={bloqueado} onClick={() => alCambiar(i)}><b>{titulo}</b><small>{texto}</small></button>)}
  </div><p className="to-nota">{valor === 1 ? 'Plano conceptual · configuración de impresión pendiente.' : 'Elige una propuesta para observar su recorrido en la oficina.'}</p></>
}

function Inventario({ valor = 0, bloqueado, alCambiar }: TallerOficinaProps) {
  const marcar = (bit: number) => alCambiar(valor ^ bit)
  const total = ELEMENTOS_OFICINA.filter((e) => (valor & e.bit) !== 0).length
  return <><div className="to-inventario-cabecera"><span>Elementos marcados</span><b>{total} {total === 1 ? 'seleccionado' : 'seleccionados'}</b></div><div className="to-inventario" role="group" aria-label="Elementos observados en la oficina">
    {ELEMENTOS_OFICINA.map((e) => { const activo = (valor & e.bit) !== 0; return <button key={e.bit} className={activo ? 'activa' : ''} aria-pressed={activo} disabled={bloqueado} onClick={() => marcar(e.bit)}><span aria-hidden="true">{activo ? '✓' : '+'}</span><b>{e.corto}</b><small>{e.nombre}</small><small className="to-estado-elemento">{e.estado}</small></button> })}
  </div><p className="to-nota">Observa la conexión y la función de cada elemento antes de marcarlo. Puedes cambiar la selección antes de confirmarla.</p></>
}

function Alcance({ valor, bloqueado, alCambiar }: TallerOficinaProps) {
  const opciones = [['Local', 'El estudio comparte recursos en la misma oficina.'], ['Sedes', 'El estudio conecta oficinas de distintos países.'], ['Aislados', 'Cada puesto mantiene su trabajo separado.']]
  return <><div className="to-controles tres" role="group" aria-label="Alcance de la propuesta">
    {opciones.map(([titulo, texto], i) => <button key={titulo} className={valor === i ? 'activa' : ''} aria-pressed={valor === i} disabled={bloqueado} onClick={() => alCambiar(i)}><b>{titulo}</b><small>{texto}</small></button>)}
  </div><p className="to-nota">El plano cambia para representar el alcance elegido; aún no valida la decisión.</p></>
}

export function TallerOficina({ fase, valor, bloqueado, alCambiar, conexion, alcance }: TallerOficinaProps) {
  const inventario = fase === 'inventario' ? (valor ?? 0) : 0
  const titulo = fase === 'conexion' ? 'Conexión' : fase === 'inventario' ? 'Inventario' : 'Alcance'
  const descripcion = fase === 'conexion' ? 'Elige una forma de trabajar con los documentos.' : fase === 'inventario' ? 'Inventario de nodos de la red que está funcionando ahora; no de todo lo que hay en la oficina.' : 'Elige el ámbito que representa la propuesta revisada.'
  return <section className="taller-oficina" aria-labelledby="to-titulo">
    <header><span className="to-kicker">CASO PRÁCTICO</span><h3 id="to-titulo" className="to-sr-only">{titulo}</h3><p>{descripcion}</p></header>
    <p className="to-descripcion-escena" id="to-descripcion-escena">{fase === 'conexion' ? valor === 0 ? 'Tres ordenadores y una impresora en el estudio. La propuesta seleccionada representa llevar trabajos manualmente entre un puesto y la impresora.' : valor === 1 ? 'Tres ordenadores y una impresora unidos por trazos que representan conexiones de red dentro de la oficina.' : valor === 2 ? 'Tres ordenadores y una impresora en un estudio donde cada puesto conserva sus documentos sin compartirlos.' : 'Oficina en perspectiva con tres puestos y una impresora.' : fase === 'inventario' ? 'Tres ordenadores y una impresora aparecen conectados simbólicamente. En un lateral se ve un portátil de reserva guardado, sin conexión, y un cable enrollado en el almacén.' : valor === 1 ? 'La propuesta de red revisada representa una oficina principal conectada con una sede pequeña en otro país.' : valor === 2 ? 'La propuesta de red revisada representa equipos aislados, sin enlaces entre los puestos.' : 'La propuesta de red revisada representa recursos compartidos dentro del perímetro de una sola oficina.'}</p>
    <Escena fase={fase} conexion={fase === 'conexion' ? valor : fase === 'alcance' || fase === 'inventario' ? 1 : conexion} inventario={inventario} alcance={fase === 'alcance' ? valor : alcance} />
    <div className="to-interaccion">{fase === 'conexion' ? <Conexion fase={fase} valor={valor} bloqueado={bloqueado} alCambiar={alCambiar} /> : fase === 'inventario' ? <Inventario fase={fase} valor={valor} bloqueado={bloqueado} alCambiar={alCambiar} /> : <Alcance fase={fase} valor={valor} bloqueado={bloqueado} alCambiar={alCambiar} />}</div>
  </section>
}
