import { useState } from 'react'
import { barajar } from '../motor/azar'
import { ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness, Check, Clock, FileText, Printer, RotateCcw, Send, Wrench } from 'lucide-react'
import type { Encargo, Unidad } from '../contenido/esquema'
import { lugarEnFuente } from '../contenido/texto'
import { useTienda } from '../estado/tienda'
import { catalogoEncargos, conoceEncargo, encargoVisible, opcionTablero, opcionTaller, pendientesParaEncargo, premioYaCobrado, siguienteEncargo, valorarEncargo, type EncargoDisponible } from '../motor/encargos'
import { EtiquetaModulo, Marco } from './comun'
import { colorModulo, useModulo } from './utilidades'
import { CabeceraEscena } from './Escenario'
import { TallerOficina } from './TallerOficina'
import { IlustracionPaso, TableroPaso } from './Tableros'
import { ELEMENTOS_OFICINA, revisarInventario } from '../motor/inventario-oficina'
import './trabajo-cliente.css'
import { Laboratorio } from './Laboratorio'
import { ID_LABORATORIO } from '../motor/laboratorio'

const ETIQUETAS = { satisfecho: 'Resuelto', parcial: 'Resuelto en parte', insatisfecho: 'No resuelto' }

/** Próximo caso práctico en Inicio: el que está en curso o el siguiente más cercano. */
export function TrabajoCliente() {
  const { indice, progreso, abrirEncargo, abrirCaso, ir } = useTienda()
  const catalogo = catalogoEncargos(indice?.unidades ?? []).filter(({ encargo }) => encargoVisible(encargo, progreso))
  const actual = catalogo.find(({ encargo }) => progreso.encargos[encargo.id] && !progreso.encargos[encargo.id].completado)
  const siguiente = actual ?? siguienteEncargo(indice?.unidades ?? [], progreso)
  if (!siguiente) return null
  const { encargo: e, unidad: u } = siguiente
  const pendientes = pendientesParaEncargo(siguiente, progreso)
  const falta = pendientes[0]
  const estado = progreso.encargos[e.id]
  const lab = e.id === 'cliente-redes-planta-sin-red' ? progreso.laboratorios?.[ID_LABORATORIO] : undefined
  const listo = !actual && conoceEncargo(e, progreso)
  return <section className="trabajo-cliente" aria-label="Próximo caso práctico">
    <div className="tc-ilustracion" aria-hidden="true"><span className="tc-trazo" />{e.pasos.some((p) => p.taller) ? <Printer size={50} /> : <BriefcaseBusiness size={50} />}</div>
    <div className="tc-contenido"><span className="sobretitulo">{actual ? 'Caso práctico en curso' : 'Próximo caso práctico'}</span><h2>{e.id === 'cliente-redes-planta-sin-red' ? 'Diagnóstico de una red de dos plantas' : e.asunto}</h2>
      <p>{lab ? `Laboratorio ${lab.fase === 'completado' ? 'completado' : 'en curso'}. Decisiones originales: ${estado?.respuestas.length ?? 0}/${e.pasos.length}.` : actual ? `${estado.respuestas.length}/${e.pasos.length} decisiones confirmadas.` : listo ? 'Ya puedes hacerlo con lo que has aprendido.' : 'Aplica lo que vas aprendiendo en una situación real.'}</p>
      {actual ? <button className="btn secundario" onClick={() => abrirEncargo(e.id)}>{lab ? lab.fase === 'completado' ? 'Ver laboratorio y entrega' : 'Continuar el laboratorio' : estado.respuestas.length || Object.keys(estado.borradores ?? {}).length ? 'Continuar el caso' : 'Empezar el caso'} <ArrowRight size={16} /></button>
        : listo ? <button className="btn secundario" onClick={() => abrirCaso(e.id)}>Empezar el caso <ArrowRight size={16} /></button>
        : falta ? <><small>Siguiente lección: «{indice?.concepto.get(falta)?.concepto.nombre}»{pendientes.length > 1 ? ` · ${pendientes.length} lecciones hasta este caso` : ''}.</small><button className="btn texto" onClick={() => ir({ id: 'departamento', moduloId: u.modulo, unidadId: u.id })}>Prepararme para este caso <ArrowRight size={16} /></button></>
          : null}
    </div>
  </section>
}

function DecisionInventario({ valor }: { valor?: number }) {
  if (valor === undefined) return null
  const nombres = ELEMENTOS_OFICINA.filter((e) => Boolean(valor & e.bit)).map((e) => e.nombre)
  const revision = revisarInventario(valor)
  return <div className="inventario-elegido"><p><b>Tu inventario:</b> {nombres.length ? nombres.join(', ') : 'ningún elemento'}.</p>
    {revision.faltan.length > 0 && <p><b>Faltan nodos conectados:</b> {revision.faltan.join(', ')}.</p>}
    {revision.motivos.map((motivo) => <p key={motivo}>{motivo}</p>)}
  </div>
}

function FuenteDecision({ e, u, i }: { e: Encargo; u: Unidad; i: number }) {
  const p = e.pasos[i]
  return <div className="fuente-decision">
    <small>Fuente: {u.fuentes.find((f) => f.id === p.fuente.doc)?.titulo ?? p.fuente.doc}{lugarEnFuente(u.fuentes.find((f) => f.id === p.fuente.doc), p.fuente.pag)} · {p.nivel_verdad === 'temario' ? 'Temario' : p.nivel_verdad === 'realidad' ? 'Realidad técnica' : 'Simplificación del tema'}</small>
    {p.matiz && <><p><b>Para el examen:</b> {p.matiz.examen}</p><p><b>En la práctica real:</b> {p.matiz.real}</p></>}
  </div>
}

const ESTADO_CASO = { curso: 'En curso', nuevo: 'Sin empezar', listo: 'Listo para empezar', bloqueado: 'Bloqueado', resuelto: '' } as const
const ORDEN_CASO = { curso: 0, nuevo: 1, listo: 2, bloqueado: 3, resuelto: 4 } as const

function barajarOpciones(cantidad: number): number[] {
  return barajar(Array.from({ length: cantidad }, (_, n) => n))
}

/** Todos los casos prácticos: se pueden empezar en cuanto se conocen los conceptos que necesitan. */
export function BandejaEncargos({ moduloId }: { moduloId?: string }) {
  const { indice, curso, progreso, abrirCaso, ir } = useTienda()
  const [filtro, setFiltro] = useState(moduloId ?? '')
  const catalogo = catalogoEncargos(indice?.unidades ?? []).filter(({ encargo }) => encargoVisible(encargo, progreso))
  const modulos = (curso?.modulos ?? []).filter((m) => catalogo.some((c) => c.unidad.modulo === m.id))
  const m = modulos.find((x) => x.id === filtro)
  const estadoDe = (f: EncargoDisponible) => {
    const guardado = progreso.encargos[f.encargo.id]
    if (guardado?.completado) return 'resuelto' as const
    if (guardado) return guardado.respuestas.length ? 'curso' as const : 'nuevo' as const
    return conoceEncargo(f.encargo, progreso) ? 'listo' as const : 'bloqueado' as const
  }
  const lista = catalogo.filter((f) => !filtro || f.unidad.modulo === filtro)
    .map((f) => ({ f, estado: estadoDe(f), faltan: pendientesParaEncargo(f, progreso) }))
    .sort((a, b) => ORDEN_CASO[a.estado] - ORDEN_CASO[b.estado] || a.faltan.length - b.faltan.length)
  const resueltos = lista.filter((x) => x.estado === 'resuelto').length
  return <Marco activa="encargos" estilo={colorModulo(m)}><div className="pagina">
    <CabeceraEscena sala={filtro || 'oficina'} tono={m?.tono} titulo="Casos prácticos" descripcion="Aplica lo que has aprendido en situaciones reales. Se abren cuando conoces los conceptos que necesitan." />
    <div className="chips-fila" role="radiogroup" aria-label="Asignatura">
      <button role="radio" aria-checked={!filtro} className={`chip-opcion ${!filtro ? 'activa' : ''}`} onClick={() => setFiltro('')}>Todas</button>
      {modulos.map((x) => <button key={x.id} role="radio" aria-checked={filtro === x.id} className={`chip-opcion ${filtro === x.id ? 'activa' : ''}`} style={colorModulo(x)} onClick={() => setFiltro(x.id)}>{x.corto ?? x.nombre}</button>)}
      <span className="resumen-casos">{resueltos} de {lista.length} resueltos</span>
    </div>
    <div className="lista-encargos">
      {lista.map(({ f: { encargo: e, unidad: u }, estado, faltan }) => {
        const guardado = progreso.encargos[e.id]
        const lab = e.id === 'cliente-redes-planta-sin-red' ? progreso.laboratorios?.[ID_LABORATORIO] : undefined
        const valoracion = valorarEncargo(e, guardado?.respuestas ?? [])
        return <article className={`panel tarjeta-encargo ${estado}`} key={e.id}>
          <div className="fila-encargo"><EtiquetaModulo unidadId={u.id} /><span className="insignia">{estado === 'resuelto' ? ETIQUETAS[valoracion.estado] : ESTADO_CASO[estado]}</span></div>
          <h2>{e.id === 'cliente-redes-planta-sin-red' ? 'Diagnóstico de una red de dos plantas' : e.asunto}</h2>
          {e.sustituido_por && <p className="nota-version"><b>Versión anterior.</b> Se conserva tal como la empezaste; hay una versión revisada de este caso.</p>}
          {e.sustituye && progreso.encargos[e.sustituye] && <p className="nota-version"><b>Versión revisada.</b> {premioYaCobrado(e, progreso) || guardado?.sinPremio ? 'Ya recibiste el premio con la versión anterior: esta no suma XP de nuevo.' : 'Comparte premio con la versión anterior: solo se cobra una vez.'}</p>}
          {lab && <p className="lab-estado-tarjeta"><b>Laboratorio: {lab.fase === 'completado' ? 'completado' : lab.fase === 'investigar' ? 'investigación en curso' : lab.fase === 'actuar' ? 'diagnóstico confirmado; falta actuar' : 'actuación realizada; falta verificar'}.</b> La entrega original se conserva aparte.</p>}
          {estado === 'bloqueado'
            ? <p className="bloqueo">Te faltan {faltan.length} {faltan.length === 1 ? 'lección' : 'lecciones'}: {faltan.slice(0, 3).map((id) => indice?.concepto.get(id)?.concepto.nombre ?? id).join(', ')}{faltan.length > 3 ? ` y ${faltan.length - 3} más` : ''}.</p>
            : <p>{e.id === 'cliente-redes-planta-sin-red' ? 'Investiga una avería, justifica el diagnóstico y comprueba la comunicación después de actuar. Hay tres variantes; las decisiones del caso original siguen disponibles dentro.' : e.mensaje}</p>}
          <div className="fila-encargo">
            <small>{lab ? 'Caso original: ' : ''}{estado === 'resuelto' ? `${valoracion.aciertos}/${valoracion.total} decisiones acertadas` : `${guardado?.respuestas.length ?? 0}/${e.pasos.length} decisiones`}</small>
            {estado === 'bloqueado'
              ? <button className="btn secundario" onClick={() => ir({ id: 'departamento', moduloId: u.modulo, unidadId: u.id })}>Ir a la asignatura <ArrowRight size={16} /></button>
              : <button className="btn principal" onClick={() => abrirCaso(e.id)}>{lab ? lab.fase === 'completado' ? 'Ver laboratorio y entrega' : 'Continuar el laboratorio' : estado === 'resuelto' ? 'Ver valoración' : estado === 'curso' ? 'Continuar el caso' : 'Empezar el caso'} <ArrowRight size={16} /></button>}
          </div>
        </article>
      })}
    </div>
    {lista.length === 0 && <section className="panel"><h2>No hay casos prácticos en esta asignatura todavía</h2></section>}
    <p className="ayuda"><Clock size={14} /> Son casos de práctica: no se envía nada ni se cambia ningún equipo real. Tu progreso se guarda al tomar cada decisión.</p>
  </div></Marco>
}

/** Cierra la opción con un punto si no lo lleva ya (las frases en inglés del caso de Inglés ya terminan en punto). */
const conPunto = (t = '') => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)

export function EncargoCliente({ id }: { id: string }) {
  const { indice, progreso, prepararCliente, decidirCliente, entregarCliente, ir } = useTienda()
  const ficha = catalogoEncargos(indice?.unidades ?? []).find((x) => x.encargo.id === id)
  const guardado = progreso.encargos[id]
  const [i, setI] = useState(Math.min(guardado?.respuestas.length ?? 0, (ficha?.encargo.pasos.length ?? 1) - 1))
  const numOpciones = ficha?.encargo.pasos[i]?.opciones.length ?? 0
  const [orden, setOrden] = useState(() => barajarOpciones(numOpciones))
  const [elegida, setElegida] = useState<number>()
  const [ensayo, setEnsayo] = useState<number[] | null>(null)
  const [ensayoTerminado, setEnsayoTerminado] = useState(false)
  const [borradoresEnsayo, setBorradoresEnsayo] = useState<Record<string, number>>({})
  const [valorTablero, setValorTablero] = useState<number>()
  // Orden de las opciones de texto: se baraja una vez por decisión y por intento (la correcta no debe ser siempre la misma).
  const m = useModulo(ficha?.unidad.modulo)
  if (!ficha || !guardado) return <Marco activa="encargos"><div className="pagina"><h1>Este caso no está disponible</h1><button className="btn principal" onClick={() => ir({ id: 'encargos' })}>Volver a los casos</button></div></Marco>
  const { encargo: e, unidad: u } = ficha
  const respuestas = ensayo ?? guardado.respuestas
  const terminado = ensayo !== null ? ensayoTerminado : Boolean(guardado.completado)
  const paso = e.pasos[i]
  const confirmada = respuestas[i]
  const borradores = ensayo !== null ? borradoresEnsayo : guardado.borradores ?? {}
  const valor = borradores[i] ?? (confirmada !== undefined ? paso.opciones[confirmada]?.valor_taller : undefined)
  const valorPreparado = paso.taller === 'inventario' ? valor ?? 0 : valor
  const opcion = paso.tablero ? opcionTablero(paso, valorTablero) : paso.taller && valorPreparado !== undefined ? opcionTaller(paso, valorPreparado) : elegida
  const valoracion = valorarEncargo(e, respuestas)
  const fuenteNombre = (indicePaso: number) => u.fuentes.find((f) => f.id === e.pasos[indicePaso].fuente.doc)?.titulo
  const laboratorio = id === 'cliente-redes-planta-sin-red'
  return <Marco activa="encargos" estilo={colorModulo(m)}><div className={`pagina encargo-partida ${e.pasos.some((p) => p.taller || p.tablero) ? 'encargo-taller' : ''}`}>
    <button className="btn texto" onClick={() => ir({ id: 'encargos' })}><ArrowLeft size={16} /> Volver a los casos</button>
    <header className="cabecera-pagina"><div><span className="sobretitulo">{ensayo !== null ? 'Repetición · sin premio adicional' : 'Caso práctico'}</span><h1>{laboratorio ? 'Diagnóstico de una red de dos plantas' : e.asunto}</h1><EtiquetaModulo unidadId={u.id} /></div>{paso.taller && <span className="tc-sello"><Printer size={23} /> TALLER DE REDES</span>}{paso.tablero && <span className="tc-sello"><Wrench size={23} /> PRÁCTICA</span>}</header>
    {laboratorio && <Laboratorio unidadId={u.id} />}
    <details className="caso-original" open={!laboratorio}><summary>{laboratorio ? 'Decisiones del caso original · entrega conservada' : 'Decisiones del caso'}</summary>
    {terminado ? <>
      <section className={`panel valoracion-cliente ${valoracion.estado}`}>
        <span className="icono-valoracion">{valoracion.estado === 'satisfecho' ? <Check size={36} /> : <BriefcaseBusiness size={36} />}</span>
        <h2>{ETIQUETAS[valoracion.estado]}{ensayo !== null && ' · repetición'}</h2><p className="mensaje-cliente">{valoracion.mensaje}</p>
        <div className="cifras"><span><b>{valoracion.aciertos}/{valoracion.total}</b> decisiones acertadas</span><span><b>+{ensayo !== null || guardado.sinPremio ? 0 : valoracion.xp} XP</b>{guardado.sinPremio && ensayo === null && ' · premio ya cobrado con la versión anterior'}</span></div>
        <button className="btn secundario" onClick={() => { setEnsayo([]); setBorradoresEnsayo({}); setEnsayoTerminado(false); setI(0); setOrden(barajarOpciones(e.pasos[0]?.opciones.length ?? 0)); setElegida(undefined); setValorTablero(undefined) }}><RotateCcw size={16} /> Repetir sin premio</button>
      </section>
      <section className="panel"><h2>Tu informe</h2>{e.pasos.map((p, n) => <details className="decision-revisada" key={n} open={!p.opciones[respuestas[n]]?.correcta}><summary>{p.opciones[respuestas[n]]?.correcta ? '✓' : '↺'} {p.titulo}</summary><p><b>Tu decisión:</b> {p.opciones[respuestas[n]]?.texto}</p>{p.taller === 'inventario' && <DecisionInventario valor={borradores[n]} />}<p>{p.opciones[respuestas[n]]?.consecuencia}</p>{!p.opciones[respuestas[n]]?.correcta && <p><b>Mejor solución:</b> {conPunto(p.opciones.find((o) => o.correcta)?.texto)} {p.opciones.find((o) => o.correcta)?.consecuencia}</p>}<FuenteDecision e={e} u={u} i={n} /></details>)}{e.pasos.some((p) => p.taller) && <p className="ayuda">Has preparado una propuesta y un inventario. La conexión física, las direcciones y la configuración de impresión quedan fuera de este caso.</p>}</section>
    </> : <>
      <section className="panel correo-cliente"><p>{e.mensaje}</p>{e.pasos.some((p) => p.datos) && <small className="sello-ficticio">Las propuestas, licencias y cifras de este caso son datos inventados para el ejercicio, no productos ni condiciones reales.</small>}{premioYaCobrado(e, progreso) && <small className="nota-version">Ya recibiste el premio con la otra versión de este caso: al entregar esta no sumarás XP.</small>}</section>
      <ol className="pasos-encargo" aria-label="Avance del caso">{e.pasos.map((p, n) => <li className={n === i ? 'actual' : n < respuestas.length ? 'hecho' : ''} key={n} aria-current={n === i ? 'step' : undefined}><span>{n < respuestas.length ? '✓' : n + 1}</span>{p.titulo}</li>)}</ol>
      <section className="panel decision-cliente"><span className="sobretitulo">Decisión {i + 1} de {e.pasos.length}</span><h2>{paso.titulo}</h2><p className="mensaje-cliente">{paso.mensaje}</p>
        {i > 0 && <p className="contexto-decision">Antes decidiste: {e.pasos[i - 1].opciones[respuestas[i - 1]]?.texto}</p>}
        {paso.explicacion && <div className="explicacion-decision"><b><BookOpen size={16} aria-hidden /> Antes de decidir</b><p>{paso.explicacion}</p></div>}
        {paso.datos && <figure className="datos-ficticios"><figcaption><FileText size={16} aria-hidden /> {paso.datos.titulo} <span className="sello-ficticio">Datos ficticios del ejercicio</span></figcaption>
          <dl>{paso.datos.filas.map((f) => <div key={f.nombre}><dt>{f.nombre}</dt><dd>{f.detalle}</dd></div>)}</dl></figure>}
        {paso.ilustracion && <IlustracionPaso ilustracion={paso.ilustracion} />}
        {paso.tablero ? <TableroPaso key={`${id}-${i}-${ensayo !== null ? 'ensayo' : 'real'}`} paso={paso} bloqueado={confirmada !== undefined} onValor={setValorTablero} /> : paso.taller ? <TallerOficina fase={paso.taller} valor={valorPreparado} bloqueado={confirmada !== undefined} conexion={1} alCambiar={(v) => {
          if (ensayo !== null) setBorradoresEnsayo({ ...borradoresEnsayo, [i]: v })
          else prepararCliente(id, i, v)
        }} /> : <div className="opciones-decision" role="group" aria-label="Opciones de la decisión">{orden.map((n) => <button key={n} className={`opcion ${elegida === n || confirmada === n ? 'elegida' : ''}`} disabled={confirmada !== undefined} aria-pressed={elegida === n || confirmada === n} onClick={() => setElegida(n)}>{paso.opciones[n].texto}</button>)}</div>}
        {confirmada === undefined ? <div className="tc-confirmar"><button className="btn principal" disabled={opcion === undefined || !conoceEncargo(e, progreso)} onClick={() => {
          if (opcion === undefined) return
          if (ensayo !== null) { setEnsayo([...ensayo, opcion]); if (paso.taller) setBorradoresEnsayo({ ...borradoresEnsayo, [i]: valorPreparado! }) }
          else { if (paso.taller) prepararCliente(id, i, valorPreparado!); decidirCliente(id, i, opcion) }
        }}>{paso.taller === 'inventario' ? 'Confirmar inventario' : paso.tablero?.tipo === 'conectar' ? 'Dar el cableado por terminado' : paso.tablero?.tipo === 'diagnostico' ? 'Confirmar diagnóstico' : paso.tablero?.tipo === 'maquina-virtual' ? 'Confirmar configuración' : paso.tablero?.tipo === 'escena' ? 'Confirmar mi revisión' : 'Confirmar decisión'} <Check size={17} /></button>{paso.taller && <small>{ensayo !== null ? 'Este ensayo no modifica tu entrega ni concede otro premio.' : 'La preparación se guarda. La decisión queda fijada al confirmar.'}</small>}</div>
        : <div className={`correccion ${paso.opciones[confirmada]?.correcta ? 'bien' : 'mal'}`} role="status"><b>{paso.opciones[confirmada]?.correcta ? 'La solución encaja con lo que se pide' : 'Esta decisión deja un problema por resolver'}</b><p>{paso.opciones[confirmada]?.consecuencia}</p>{!paso.opciones[confirmada]?.correcta && <p><b>Cómo corregirlo:</b> {conPunto(paso.opciones.find((o) => o.correcta)?.texto)} {paso.opciones.find((o) => o.correcta)?.consecuencia}</p>}<FuenteDecision e={e} u={u} i={i} /><button className="btn principal" onClick={() => {
          setElegida(undefined)
          setValorTablero(undefined)
          if (i + 1 < e.pasos.length) {
            const siguiente = i + 1
            setI(siguiente)
            setOrden(barajarOpciones(e.pasos[siguiente]?.opciones.length ?? 0))
          }
          else if (ensayo !== null) setEnsayoTerminado(true)
          else entregarCliente(id)
        }}>{i + 1 === e.pasos.length ? <>Entregar solución <Send size={16} /></> : <>Siguiente decisión <ArrowRight size={16} /></>}</button></div>}
        {confirmada !== undefined && paso.taller === 'inventario' && <DecisionInventario valor={borradores[i]} />}
        {confirmada === undefined && <small className="fuente">Caso basado en {fuenteNombre(i)}. Verás la explicación y la página al decidir.</small>}
      </section>
    </>}
    </details>
  </div></Marco>
}
