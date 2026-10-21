// Tableros interactivos de los encargos: cablear una red, diagnosticar una avería e ilustraciones de apoyo.
// La lógica (qué es correcto) está en src/motor/tableros.ts; aquí solo se dibuja y se recogen las acciones.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, Check, CircleHelp, ScanSearch, Cable as IconoCable, Cloud, Cpu, Eye, HardDrive, MemoryStick, MonitorCog, Network, RotateCcw, Undo2, X, Zap } from 'lucide-react'
import type { Encargo, Ilustracion, Tablero } from '../contenido/esquema'
import { ALCANCE_RED, claveCable, diagnosticoMaquina, equiposConectados, nombreReparto, evaluarConexion, evaluarEscena, evaluarMaquina, revisionCableado, pilotos, pruebaComunicacion, redDeDiagnostico, veredictoEscena, type Cable, type ConfigMaquina, type ModoRed } from '../motor/tableros'
import { SimuladorRed } from './SimuladorRed'
import { Nic, DibujoRed, MarcoDibujo } from './Visuales'
import { sonar } from './sonido'
import { ESCENAS } from './escenas'
import './tableros.css'

type Paso = Encargo['pasos'][number]
type Conectar = Extract<Tablero, { tipo: 'conectar' }>
type Diagnostico = Extract<Tablero, { tipo: 'diagnostico' }>
type Maquina = Extract<Tablero, { tipo: 'maquina-virtual' }>
type Escena = Extract<Tablero, { tipo: 'escena' }>

/* ---------------------------------------------------------------- Ilustraciones */

function Simulador({ ilustracion }: { ilustracion: Extract<Ilustracion, { tipo: 'simulador' }> }) {
  const [pestana, setPestana] = useState(0)
  const actual = ilustracion.pestanas[pestana]
  return (
    <div className="ilustracion-simulador">
      <p className="ilustracion-instruccion"><Eye size={16} /> {ilustracion.instruccion}</p>
      {ilustracion.pestanas.length > 1 && (
        <div className="pestanas-sim" role="tablist">
          {ilustracion.pestanas.map((p, i) => (
            <button key={p.etiqueta} role="tab" aria-selected={i === pestana} className={i === pestana ? 'activa' : ''} onClick={() => setPestana(i)}>{p.etiqueta}</button>
          ))}
        </div>
      )}
      <SimuladorRed key={pestana} escenario={actual.escenario} modo="enviar" onUsado={() => undefined} />
    </div>
  )
}

export function IlustracionPaso({ ilustracion }: { ilustracion: Ilustracion }) {
  if (ilustracion.tipo === 'simulador') return <Simulador ilustracion={ilustracion} />
  return (
    <figure className="ilustracion-pilotos">
      <Nic pilotos={{ enlace: ilustracion.enlace, actividad: ilustracion.actividad }} />
      <figcaption>
        <span><i className={`led-leyenda ${ilustracion.enlace === 'fijo' ? 'on' : 'off'}`} /> Piloto de enlace: <b>{ilustracion.enlace === 'fijo' ? 'encendido fijo' : 'apagado'}</b></span>
        <span><i className={`led-leyenda ${ilustracion.actividad === 'parpadea' ? 'on parpadeo' : 'off'}`} /> Piloto de actividad: <b>{ilustracion.actividad === 'parpadea' ? 'parpadea' : 'apagado'}</b></span>
        {ilustracion.pie && <em>{ilustracion.pie}</em>}
      </figcaption>
    </figure>
  )
}

/* ---------------------------------------------------------------- Cableado */

/** Dibujo de un equipo en el tablero de cableado. (x, y) es el centro. */
function Equipo({ clase, x, y }: { clase: Conectar['nodos'][number]['clase']; x: number; y: number }) {
  switch (clase) {
    case 'pc':
      return <g className="eq pc"><rect x={x - 28} y={y - 24} width={56} height={38} rx={5} /><rect x={x - 22} y={y - 18} width={44} height={26} rx={2} className="pantalla-eq" /><rect x={x - 12} y={y + 15} width={24} height={6} rx={2} className="pie" /></g>
    case 'impresora':
      return <g className="eq impresora"><rect x={x - 22} y={y - 28} width={44} height={16} rx={2} className="papel" /><rect x={x - 32} y={y - 14} width={64} height={30} rx={6} /><rect x={x - 20} y={y + 6} width={40} height={14} rx={2} className="papel" /></g>
    case 'switch':
    case 'hub':
      return (
        <g className={`eq ${clase}`}>
          <rect x={x - 48} y={y - 16} width={96} height={32} rx={6} />
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={x - 38 + i * 14} y={y - 3} width={9} height={10} rx={1.5} className="puerto" />)}
        </g>
      )
    case 'router':
      return (
        <g className="eq router">
          <line x1={x - 20} y1={y - 16} x2={x - 26} y2={y - 34} className="antena" /><line x1={x + 20} y1={y - 16} x2={x + 26} y2={y - 34} className="antena" />
          <rect x={x - 38} y={y - 16} width={76} height={32} rx={6} />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={x - 21 + i * 14} cy={y} r={2.8} className="mini-led" />)}
        </g>
      )
    case 'internet':
      return <g className="eq internet"><path d={`M ${x - 30} ${y + 14} a 14 14 0 0 1 4 -27 a 20 20 0 0 1 38 -4 a 15 15 0 0 1 14 31 Z`} /></g>
  }
}

export function TableroConectar({ tablero, bloqueado, onValor }: { tablero: Conectar; bloqueado: boolean; onValor: (v: number | undefined) => void }) {
  const [cables, setCables] = useState<Cable[]>([])
  const [seleccion, setSeleccion] = useState<string>()
  const [aviso, setAviso] = useState('')
  const encendidos = useMemo(() => equiposConectados(cables), [cables])
  const nodo = (id: string) => tablero.nodos.find((n) => n.id === id)!

  useEffect(() => { onValor(cables.length ? evaluarConexion(tablero, cables) : undefined) }, [cables, tablero, onValor])

  const pulsar = (id: string) => {
    if (bloqueado) return
    if (!seleccion) { setSeleccion(id); sonar('clic'); return }
    if (seleccion === id) { setSeleccion(undefined); return }
    const k = claveCable(seleccion, id)
    const hay = cables.some(([a, b]) => claveCable(a, b) === k)
    setCables(hay ? cables.filter(([a, b]) => claveCable(a, b) !== k) : [...cables, [seleccion, id]])
    setAviso(hay ? `Has quitado el cable entre ${nodo(seleccion).etiqueta} y ${nodo(id).etiqueta}.` : '')
    sonar(hay ? 'suave' : 'paso')
    setSeleccion(undefined)
  }
  const quitar = (k: string) => {
    if (bloqueado) return
    setCables(cables.filter(([a, b]) => claveCable(a, b) !== k))
    setAviso(`Has quitado un cable (${k.split('|').map((n) => nodo(n).etiqueta).join(' con ')}).`)
  }

  return (
    <div className="tablero tablero-conectar">
      <p className="tablero-instruccion"><IconoCable size={17} /> {tablero.instruccion}</p>
      <svg viewBox="0 0 600 360" className="lienzo" role="group" aria-label="Tablero de cableado">
        {cables.map(([a, b]) => {
          const A = nodo(a)
          const B = nodo(b)
          const k = claveCable(a, b)
          return (
            <g key={k} className="cable-tablero" onClick={() => quitar(k)}>
              <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} className="cable-hit" />
              <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} className="cable-linea" />
            </g>
          )
        })}
        {tablero.nodos.map((n) => (
          <g key={n.id} className={`equipo-tablero ${seleccion === n.id ? 'seleccionado' : ''} ${encendidos.has(n.id) ? 'enlazado' : ''}`} role="button" tabIndex={bloqueado ? -1 : 0}
            aria-label={`${n.etiqueta}${encendidos.has(n.id) ? ', con cable' : ', sin cable'}${seleccion === n.id ? ', seleccionado' : ''}`}
            onClick={() => pulsar(n.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pulsar(n.id) } }}>
            <rect x={n.x - 50} y={n.y - 42} width={100} height={92} rx={14} className="zona-clic" />
            <Equipo clase={n.clase} x={n.x} y={n.y} />
            <circle cx={n.x + 36} cy={n.y - 26} r={5.5} className={`piloto ${encendidos.has(n.id) ? 'on' : 'off'}`} />
            <text x={n.x} y={n.y + 44} textAnchor="middle" className="etiqueta-eq">{n.etiqueta}</text>
          </g>
        ))}
      </svg>
      <div className="tablero-barra">
        <span className="tablero-estado" aria-live="polite">
          <Zap size={15} /> {encendidos.size} de {tablero.nodos.length} equipos con el piloto de enlace encendido · {cables.length} {cables.length === 1 ? 'cable' : 'cables'}
        </span>
        {!bloqueado && (
          <span className="tablero-acciones">
            <button className="btn texto" disabled={!cables.length} onClick={() => setCables(cables.slice(0, -1))}><Undo2 size={15} /> Quitar el último</button>
            <button className="btn texto" disabled={!cables.length} onClick={() => { setCables([]); setSeleccion(undefined) }}><RotateCcw size={15} /> Empezar de nuevo</button>
          </span>
        )}
      </div>
      {!bloqueado && <p className="ayuda" aria-live="polite">{seleccion ? <>Has elegido <b>{nodo(seleccion).etiqueta}</b>. Pulsa el equipo con el que quieres unirlo.</> : aviso || 'Pulsa un equipo y luego otro para unirlos con un cable. Pulsa un cable (o repite la unión) para quitarlo.'}</p>}
      {bloqueado && cables.length > 0 && (
        <ul className="veredicto-escena" aria-label="Revisión de tu cableado">
          {revisionCableado(tablero, cables).map((l) => <li key={l.texto} className={l.ok ? 'ok' : 'ko'}><b>{l.ok ? '✓' : '✗'}</b> {l.texto}</li>)}
        </ul>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Diagnóstico */

interface Prueba { a: string; b: string; ok: boolean }

export function TableroDiagnostico({ tablero, bloqueado, onValor }: { tablero: Diagnostico; bloqueado: boolean; onValor: (v: number | undefined) => void }) {
  const red = useMemo(() => redDeDiagnostico(tablero), [tablero])
  const [modoPrueba, setModoPrueba] = useState(false)
  const [origen, setOrigen] = useState<string>()
  const [pruebas, setPruebas] = useState<Prueba[]>([])
  const [verPilotos, setVerPilotos] = useState(false)
  const [causa, setCausa] = useState<number>()
  const quedan = tablero.pruebas - pruebas.length
  const estadoPilotos = useMemo(() => pilotos(tablero), [tablero])

  const investigado = verPilotos || pruebas.length > 0
  // No se puede confirmar sin haber investigado: mirar los pilotos o hacer al menos una prueba.
  useEffect(() => { onValor(investigado ? causa : undefined) }, [causa, investigado, onValor])

  const pulsarEquipo = (id: string) => {
    if (bloqueado || !modoPrueba || !red.pcs.includes(id) || quedan <= 0) return
    if (!origen) { setOrigen(id); sonar('clic'); return }
    if (origen === id) { setOrigen(undefined); return }
    const ok = pruebaComunicacion(tablero, origen, id)
    setPruebas([...pruebas, { a: origen, b: id, ok }])
    sonar(ok ? 'paso' : 'suave')
    setOrigen(undefined)
    if (quedan - 1 <= 0) setModoPrueba(false)
  }

  return (
    <div className="tablero tablero-diagnostico">
      <p className="tablero-instruccion"><Activity size={17} /> {tablero.instruccion}</p>
      <DibujoRed red={red} onNodo={pulsarEquipo}
        estado={{ origen, pilotos: verPilotos ? estadoPilotos : undefined, marcados: origen ? new Set([origen]) : undefined }} />
      {!bloqueado && (
        <div className="herramientas-diagnostico">
          <button className={`btn secundario ${verPilotos ? 'activo' : ''}`} aria-pressed={verPilotos} onClick={() => { setVerPilotos(!verPilotos); sonar('clic') }}>
            <Eye size={16} /> {verPilotos ? 'Ocultar pilotos de enlace' : 'Mirar los pilotos de enlace'}
          </button>
          <button className={`btn secundario ${modoPrueba ? 'activo' : ''}`} aria-pressed={modoPrueba} disabled={quedan <= 0}
            onClick={() => { setModoPrueba(!modoPrueba); setOrigen(undefined) }}>
            <Zap size={16} /> Probar comunicación <span className="contador-pruebas">{quedan} {quedan === 1 ? 'prueba' : 'pruebas'}</span>
          </button>
        </div>
      )}
      {!bloqueado && quedan <= 0 && <p className="ayuda" aria-live="polite">Has usado todas las pruebas. Decide con lo que has averiguado.</p>}
      {!bloqueado && !investigado && <p className="ayuda">Antes de decidir, investiga: mira los pilotos o haz una prueba de comunicación.</p>}
      {modoPrueba && !bloqueado && <p className="ayuda" aria-live="polite">{origen ? <>Elige el equipo al que <b>{origen}</b> intentará hablar.</> : 'Elige el equipo que envía y después el que recibe.'}</p>}
      {pruebas.length > 0 && (
        <ul className="registro-pruebas" aria-label="Resultados de tus pruebas">
          {pruebas.map((p, i) => (
            <li key={i} className={p.ok ? 'ok' : 'ko'}><b>{p.ok ? '✓' : '✗'}</b> {p.a} → {p.b}: {p.ok ? 'se comunican' : 'no hay comunicación'}</li>
          ))}
        </ul>
      )}
      <fieldset className="causas" disabled={bloqueado}>
        <legend><CircleHelp size={16} /> ¿Qué ha fallado?</legend>
        {tablero.sospechosos.map((s, i) => (
          <button key={s.id} type="button" className={`opcion ${causa === i ? 'elegida' : ''}`} aria-pressed={causa === i} onClick={() => { setCausa(i); sonar('clic') }}>{s.etiqueta}</button>
        ))}
      </fieldset>
    </div>
  )
}

/* ---------------------------------------------------------------- Máquina virtual */

const REDES: ModoRed[] = ['nat', 'nat-network', 'interna', 'solo-anfitrion', 'puente']

/** Esquema de a qué llega la VM con cada modo de red: línea continua = se comunica, discontinua = no, punteada = el tema no lo dice. */
function EsquemaRed({ modo }: { modo: ModoRed }) {
  const a = ALCANCE_RED[modo]
  const enlaces: { clave: string; etiqueta: string; ok: boolean | null; x: number; y: number }[] = [
    { clave: 'internet', etiqueta: 'Internet', ok: a.internet, x: 150, y: 28 },
    { clave: 'anfitrion', etiqueta: 'Anfitrión', ok: a.anfitrion, x: 44, y: 128 },
    { clave: 'vm', etiqueta: 'Otras VM', ok: a.otrasVm, x: 256, y: 128 },
  ]
  const clase = (ok: boolean | null) => (ok === true ? 'si' : ok === false ? 'no' : 'nd')
  return (
    <svg viewBox="0 0 300 170" className="esquema-red" role="img" aria-label={`Alcance de la máquina virtual con ${a.nombre}`}>
      {enlaces.map((e) => (
        <line key={e.clave} x1={150} y1={92} x2={e.x} y2={e.y + (e.y < 90 ? 16 : -16)} className={`enlace-vm ${clase(e.ok)}`} />
      ))}
      {enlaces.map((e) => (
        <g key={`n-${e.clave}`} className={`nodo-vm ${clase(e.ok)}`}>
          <rect x={e.x - 38} y={e.y - 16} width={76} height={32} rx={9} />
          <text x={e.x} y={e.y + 5} textAnchor="middle">{e.etiqueta}</text>
          <text x={e.x + 30} y={e.y - 20} textAnchor="middle" className="marca-vm">{e.ok === true ? '✓' : e.ok === false ? '✗' : '?'}</text>
        </g>
      ))}
      <g className="nodo-vm yo"><rect x={110} y={74} width={80} height={36} rx={10} /><text x={150} y={97} textAnchor="middle">Tu VM</text></g>
    </svg>
  )
}

function Barra({ icono, titulo, total, usado, unidad, hueco, aviso, limite }: { icono: ReactNode; titulo: string; total: number; usado: number; unidad: string; hueco?: number; aviso?: string; limite?: number }) {
  const pct = (n: number) => `${Math.min(100, (n / total) * 100)}%`
  return (
    <div className="barra-recurso">
      <div className="br-cabecera"><span>{icono} {titulo}</span><span><b>{usado} {unidad}</b> de {total} {unidad}</span></div>
      <div className="br-pista" role="img" aria-label={`${titulo}: ${usado} de ${total} ${unidad} para la máquina virtual`}>
        <span className="br-vm" style={{ width: pct(usado) }} />
        {hueco !== undefined && hueco > 0 && <span className="br-hueco" style={{ left: pct(usado), width: pct(hueco) }} />}
        {limite !== undefined && <span className="br-limite" style={{ left: pct(limite) }} title="Límite de este caso para no dejar sin recursos al portátil" />}
      </div>
      {aviso && <small>{aviso}</small>}
    </div>
  )
}

export function TableroMaquina({ tablero: t, bloqueado, onValor }: { tablero: Maquina; bloqueado: boolean; onValor: (v: number | undefined) => void }) {
  const nucleosPosibles = [1, 2, 3, 4, 6, 8, 12, 16].filter((n) => n <= t.host.nucleos)
  const [cfg, setCfg] = useState<ConfigMaquina>({ ram: t.opciones_ram[0], nucleos: 1, disco: t.opciones_disco[0], tipoDisco: 'dinamico', red: 'nat' })
  const [tocado, setTocado] = useState(false)
  const cambiar = (parte: Partial<ConfigMaquina>) => { if (bloqueado) return; setCfg({ ...cfg, ...parte }); setTocado(true); sonar('clic') }

  useEffect(() => { onValor(tocado ? evaluarMaquina(t, cfg) : undefined) }, [cfg, tocado, t, onValor])

  const a = ALCANCE_RED[cfg.red]
  // Un disco dinámico solo ocupa al principio una parte; uno fijo reserva todo de golpe (tema SOM UT3, pág. 2).
  const inicial = cfg.tipoDisco === 'fijo' ? cfg.disco : Math.max(1, Math.round(cfg.disco * 0.1))
  const icono = (v: boolean | null) => (v === true ? <Check size={15} /> : v === false ? <X size={15} /> : <CircleHelp size={15} />)
  return (
    <div className="tablero tablero-maquina">
      <p className="tablero-instruccion"><MonitorCog size={17} /> {t.instruccion}</p>
      <div className="datos-host">
        <span><b>Equipo anfitrión</b> (el físico)</span>
        <span><MemoryStick size={15} /> {t.host.ram_gb} GB de RAM</span>
        <span><Cpu size={15} /> {t.host.nucleos} núcleos</span>
        <span><HardDrive size={15} /> {t.host.disco_libre_gb} GB libres</span>
      </div>
      <div className="rejilla-maquina">
        <div className="controles-vm">
          <fieldset disabled={bloqueado}>
            <legend>Memoria RAM</legend>
            <div className="chips-vm">{t.opciones_ram.map((n) => <button key={n} type="button" className={cfg.ram === n ? 'activo' : ''} aria-pressed={cfg.ram === n} onClick={() => cambiar({ ram: n })}>{n} GB</button>)}</div>
          </fieldset>
          <fieldset disabled={bloqueado}>
            <legend>Núcleos de procesador</legend>
            <div className="chips-vm">{nucleosPosibles.map((n) => <button key={n} type="button" className={cfg.nucleos === n ? 'activo' : ''} aria-pressed={cfg.nucleos === n} onClick={() => cambiar({ nucleos: n })}>{n}</button>)}</div>
          </fieldset>
          <fieldset disabled={bloqueado}>
            <legend>Disco virtual</legend>
            <div className="chips-vm">{t.opciones_disco.map((n) => <button key={n} type="button" className={cfg.disco === n ? 'activo' : ''} aria-pressed={cfg.disco === n} onClick={() => cambiar({ disco: n })}>{n} GB</button>)}</div>
            <div className="chips-vm tipo">
              {(['dinamico', 'fijo'] as const).map((tipo) => <button key={tipo} type="button" className={cfg.tipoDisco === tipo ? 'activo' : ''} aria-pressed={cfg.tipoDisco === tipo} onClick={() => cambiar({ tipoDisco: tipo })}>{tipo === 'dinamico' ? 'Dinámico' : 'Fijo'}</button>)}
            </div>
            <small>{cfg.tipoDisco === 'dinamico' ? 'Dinámico: ahorra espacio al principio y crece según se usa.' : 'Fijo: mejor rendimiento, pero reserva todo el espacio de golpe.'}</small>
          </fieldset>
        </div>
        <div className="resumen-vm" aria-live="polite">
          <Barra icono={<MemoryStick size={15} />} titulo="RAM" total={t.host.ram_gb} usado={cfg.ram} unidad="GB" limite={t.host.ram_gb * t.reparto_max} />
          <Barra icono={<Cpu size={15} />} titulo="Núcleos" total={t.host.nucleos} usado={cfg.nucleos} unidad="" limite={t.host.nucleos * t.reparto_max} />
          <Barra icono={<HardDrive size={15} />} titulo="Espacio libre" total={t.host.disco_libre_gb} usado={Math.min(inicial, t.host.disco_libre_gb)} unidad="GB"
            limite={cfg.tipoDisco === 'fijo' ? t.host.disco_libre_gb * t.reparto_max : undefined}
            hueco={cfg.tipoDisco === 'dinamico' ? Math.min(cfg.disco, t.host.disco_libre_gb) - inicial : 0}
            aviso={cfg.tipoDisco === 'dinamico' ? `Ahora ocupa ${inicial} GB y puede crecer hasta ${cfg.disco} GB (zona rayada).` : `Reserva ${cfg.disco} GB desde el primer momento.`} />
        </div>
      </div>
      <fieldset className="redes-vm" disabled={bloqueado}>
        <legend><Network size={16} /> Modo de red de la máquina virtual</legend>
        <div className="tarjetas-red">
          {REDES.map((r) => (
            <button key={r} type="button" className={cfg.red === r ? 'activo' : ''} aria-pressed={cfg.red === r} onClick={() => cambiar({ red: r })}>
              <b>{ALCANCE_RED[r].nombre}</b>
              <small>{ALCANCE_RED[r].resumen}</small>
            </button>
          ))}
        </div>
        <div className="alcance-vm">
          <EsquemaRed modo={cfg.red} />
          <ul className="alcance-lista">
            <li className={a.internet ? 'si' : 'no'}>{icono(a.internet)} <Cloud size={15} /> Sale a Internet</li>
            <li className={a.anfitrion === true ? 'si' : a.anfitrion === false ? 'no' : 'nd'}>{icono(a.anfitrion)} La ve el equipo anfitrión</li>
            <li className={a.otrasVm ? 'si' : 'no'}>{icono(a.otrasVm)} La ven otras máquinas virtuales</li>
            <li className={cfg.red === 'puente' ? 'si' : 'no'}>{icono(cfg.red === 'puente')} Aparece en la red física con su propia IP</li>
          </ul>
        </div>
      </fieldset>
      {!bloqueado && <p className="ayuda"><b>Regla de este caso:</b> no cedas a la máquina virtual más de {nombreReparto(t.reparto_max)} de la RAM ni de los núcleos del portátil (ni del disco libre, si el disco es fijo). La marca vertical de cada barra señala ese límite.{!tocado && ' La VM empieza con valores mínimos y la red NAT, como en VirtualBox.'}</p>}
      {bloqueado && (
        <ul className="veredicto-escena" aria-label="Revisión de tu configuración">
          {diagnosticoMaquina(t, cfg).map((l) => <li key={l.texto} className={l.ok ? 'ok' : 'ko'}><b>{l.ok ? '✓' : '✗'}</b> {l.texto}</li>)}
        </ul>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Escena con riesgos */

export function TableroEscena({ tablero: t, bloqueado, onValor }: { tablero: Escena; bloqueado: boolean; onValor: (v: number | undefined) => void }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const escena = ESCENAS[t.escena]
  useEffect(() => { onValor(marcados.size ? evaluarEscena(t, marcados) : undefined) }, [marcados, t, onValor])

  const alternar = (id: string) => {
    if (bloqueado) return
    const n = new Set(marcados)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setMarcados(n)
    sonar(n.has(id) ? 'paso' : 'suave')
  }
  const veredicto = bloqueado ? veredictoEscena(t, marcados) : []
  const resultado = (id: string) => veredicto.find((v) => v.id === id)

  return (
    <div className="tablero tablero-escena">
      <p className="tablero-instruccion"><ScanSearch size={17} /> {t.instruccion}</p>
      <MarcoDibujo>
      <svg viewBox="0 0 600 360" className="lienzo escena-riesgos" role="group" aria-label="Escena del taller: pulsa lo que sea un riesgo">
        {escena.fondo}
        {t.elementos.map((e) => {
          const arte = escena.elementos[e.id]
          if (!arte) return null
          const { x, y, w, h } = arte.area
          const v = resultado(e.id)
          const estado = v ? (v.acierto ? 'acierto' : 'fallo') : marcados.has(e.id) ? 'marcado' : ''
          return (
            <g key={e.id} className={`elemento-escena ${estado}`} role="button" tabIndex={bloqueado ? -1 : 0} aria-pressed={marcados.has(e.id)}
              aria-label={`${e.etiqueta}${marcados.has(e.id) ? ', marcado como riesgo' : ''}`}
              onClick={() => alternar(e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alternar(e.id) } }}>
              {arte.dibujo}
              <rect x={x} y={y} width={w} height={h} rx={10} className="area-escena" />
              <text x={x + w / 2} y={y + h + 14} textAnchor="middle" className="etiqueta-escena">{e.etiqueta}</text>
              {(marcados.has(e.id) || (v && e.riesgo)) && (
                <g className="insignia-escena" transform={`translate(${x + w - 6} ${y + 6})`}>
                  <circle r="11" /><text textAnchor="middle" y="5">{v ? (v.acierto ? '✓' : '✗') : '!'}</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
      </MarcoDibujo>
      {!bloqueado && (
        <div className="zonas-botones" role="group" aria-label="Elementos del taller">
          {t.elementos.map((e) => (
            <button key={e.id} type="button" className={`chip-zona ${marcados.has(e.id) ? 'activa' : ''}`} aria-pressed={marcados.has(e.id)} onClick={() => alternar(e.id)}>
              {marcados.has(e.id) ? '! ' : ''}{e.etiqueta}
            </button>
          ))}
        </div>
      )}
      {!bloqueado && <p className="ayuda" aria-live="polite">{marcados.size ? `Has marcado ${marcados.size} ${marcados.size === 1 ? 'elemento' : 'elementos'}. Pulsa otra vez para quitar la marca.` : 'Pulsa los elementos que consideres un riesgo. Algunos están bien: no los marques.'}</p>}
      {bloqueado && veredicto.length > 0 && (
        <ul className="veredicto-escena" aria-label="Revisión de cada elemento">
          {veredicto.map((v) => (
            <li key={v.id} className={v.acierto ? 'ok' : 'ko'}>
              <b>{v.acierto ? '✓' : '✗'} {v.etiqueta}</b> — {v.riesgo ? (v.marcado ? 'Riesgo detectado.' : 'Riesgo que no viste.') : (v.marcado ? 'Estaba bien: no era un riesgo.' : 'Bien, no era un riesgo.')} {v.explicacion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TableroPaso({ paso, bloqueado, onValor }: { paso: Paso; bloqueado: boolean; onValor: (v: number | undefined) => void }) {
  const t = paso.tablero
  if (!t) return null
  if (t.tipo === 'conectar') return <TableroConectar tablero={t} bloqueado={bloqueado} onValor={onValor} />
  if (t.tipo === 'maquina-virtual') return <TableroMaquina tablero={t} bloqueado={bloqueado} onValor={onValor} />
  if (t.tipo === 'escena') return <TableroEscena tablero={t} bloqueado={bloqueado} onValor={onValor} />
  return <TableroDiagnostico tablero={t} bloqueado={bloqueado} onValor={onValor} />
}
