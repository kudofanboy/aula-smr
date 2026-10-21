// Reproductor de sesiones: turno, práctica, examen o aprender.
import { useEffect, useRef, useState } from 'react'
import { corregir, type Item } from '../motor/items'
import { DOMINADO, nivel, rango, type Progreso } from '../motor/progreso'
import { estrellas, nota, puntosRespuesta, tiempoObjetivo, xpRespuesta } from '../motor/puntuacion'
import type { PasoSesion, Sesion as TSesion } from '../motor/sesiones'
import { MODO_COMPARTIR } from '../estado/almacen'
import { useTienda, type RespuestaSesion } from '../estado/tienda'
import { ArrowRight, BookOpenCheck, Check, Clock, Flag, Flame, Gamepad2, GraduationCap, Lightbulb, Star, Timer, X } from 'lucide-react'
import { EtiquetaModulo } from './comun'
import { colorModulo } from './utilidades'
import { Descubrir } from './Descubrir'
import { Motor } from './Motores'
import { sonar } from './sonido'
import { AyudaAprendizaje } from './AyudaAprendizaje'
import { animacionesActivas } from './efectos'
import './aprendizaje-claro.css'
import { TextoRico } from './TextoRico'
import { lugarEnFuente } from '../contenido/texto'

function nombreFuente(unidadId: string, doc: string, pag?: number): string {
  const u = useTienda.getState().indice?.unidades.find((x) => x.id === unidadId)
  const f = u?.fuentes.find((x) => x.id === doc)
  const m = useTienda.getState().curso?.modulos.find((x) => x.id === u?.modulo)
  const lugar = pag === undefined ? '' : f ? lugarEnFuente(f, pag) : `, pág. ${pag}`
  return (f ? `${m?.corto ?? u!.modulo} ${u!.codigo} · ${f.titulo}` : doc) + lugar
}

function Informe({ item, onCerrar }: { item: Item; onCerrar: () => void }) {
  const informar = useTienda((s) => s.informar)
  const [tipo, setTipo] = useState<'error' | 'no-entiendo'>('error')
  const [texto, setTexto] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {enviado ? (
          <>
            <h3>¡Gracias!</h3>
            <p>{tipo === 'error' ? 'El ejercicio queda retirado hasta que se revise.' : 'El aviso queda guardado para revisar la explicación.'}</p>
            {MODO_COMPARTIR && <p>Se ha guardado en este navegador. Para que llegue a quien mantiene el juego, cópialo desde <b>Mi ficha → Copiar mis avisos de error</b> y envíaselo.</p>}
            <button className="btn principal" onClick={onCerrar}>Cerrar</button>
          </>
        ) : (
          <>
            <h3>Informar de este ejercicio</h3>
            <div className="opciones fila">
              <button className={`opcion ${tipo === 'error' ? 'elegida' : ''}`} onClick={() => setTipo('error')}>Creo que está mal</button>
              <button className={`opcion ${tipo === 'no-entiendo' ? 'elegida' : ''}`} onClick={() => setTipo('no-entiendo')}>No lo entiendo</button>
            </div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cuéntalo con tus palabras (opcional)" rows={4} />
            {error && <p role="alert">{error}</p>}
            <div className="fila-botones">
              <button className="btn secundario" onClick={onCerrar}>Cancelar</button>
              <button className="btn principal" disabled={enviando} onClick={async () => {
                setEnviando(true)
                setError('')
                try { await informar(item, tipo, texto); setEnviado(true) }
                catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el aviso. Vuelve a intentarlo.') }
                finally { setEnviando(false) }
              }}>{enviando ? 'Guardando…' : 'Enviar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function contarDominados(p: Progreso): number {
  const ix = useTienda.getState().indice
  return Object.entries(p.conceptos).filter(([id, e]) => ix?.concepto.has(id) && nivel(e) >= DOMINADO).length
}

/** Qué tipo de ejercicio es: examen, práctica de una lección, reto final o repaso. */
function Encabezado({ paso, sesion, final }: { paso: Extract<PasoSesion, { tipo: 'item' }>; sesion: TSesion; final: boolean }) {
  const item = paso.item
  const extra = (
    <>
      <EtiquetaModulo unidadId={item.unidadId} />
      {item.origen === 'profesor' && <span className="insignia profe"><BookOpenCheck size={13} /> Banco del profesor</span>}
    </>
  )
  if (sesion.tipo === 'examen')
    return <div className="contexto-paso"><span className="insignia auditoria"><GraduationCap size={13} /> Examen</span>{extra}</div>
  if (sesion.tipo === 'aprender')
    return (
      <div className="contexto-paso"><span className="insignia">Ahora practícalo tú</span>{extra}</div>
    )
  if (sesion.tipo === 'practica')
    return <div className="contexto-paso"><span className="insignia">{sesion.juegoId ? <Gamepad2 size={13} /> : <BookOpenCheck size={13} />} {sesion.juegoId ? 'Reto' : 'Práctica'}</span>{extra}</div>
  if (sesion.tipo === 'turno' && final && !paso.repaso)
    return (
      <div className="contexto-paso"><span className="insignia"><Gamepad2 size={13} /> Reto final</span>{extra}</div>
    )
  return <div className="contexto-paso"><span className="insignia"><Flag size={13} /> Repaso</span>{extra}</div>
}

export function Sesion({ sesion, unidadId }: { sesion: TSesion; unidadId?: string }) {
  const { responder, descubrir, terminarSesion, ir, progreso, preguntar, indice, curso, registrar } = useTienda()
  const examen = sesion.tipo === 'examen'
  const [i, setI] = useState(0)
  // Orden de los pasos. En el examen, «Saltar» manda la pregunta al final para retomarla después.
  const [orden, setOrden] = useState(() => sesion.pasos.map((_, k) => k))
  const [respuestas, setRespuestas] = useState<RespuestaSesion[]>([])
  const [ultima, setUltima] = useState<RespuestaSesion>()
  const [combo, setCombo] = useState(0)
  const [descubiertos, setDescubiertos] = useState<string[]>([])
  const [informe, setInforme] = useState(false)
  const [ayudas, setAyudas] = useState(sesion.guiada ? 1 : 0)
  const [recuperaciones, setRecuperaciones] = useState<{ conceptos: string[]; acierto: boolean }[]>([])
  const [restante, setRestante] = useState(sesion.tiempo)
  const inicio = useRef(Date.now())
  const refCorreccion = useRef<HTMLDivElement>(null)
  // Niveles al empezar, para mostrar después qué conceptos han subido.
  const [nivelesIniciales] = useState(() => {
    const ids = new Set(sesion.pasos.flatMap((p) => (p.tipo === 'item' ? p.item.conceptos : [p.concepto.id])))
    return Object.fromEntries([...ids].map((id) => [id, nivel(progreso.conceptos[id])]))
  })

  // Conceptos dominados al empezar, para detectar un ascenso de rango al terminar.
  const [dominadosIniciales] = useState(() => contarDominados(progreso))

  const paso = sesion.pasos[orden[i]]
  const totalItems = sesion.pasos.filter((p) => p.tipo === 'item').length
  const puntos = respuestas.reduce((s, r) => s + r.puntos, 0)

  useEffect(() => {
    inicio.current = Date.now()
    window.scrollTo({ top: 0 })
  }, [i, orden])

  // La corrección puede quedar debajo del ejercicio: se desplaza para que se vea sin buscarla.
  useEffect(() => {
    if (ultima) refCorreccion.current?.scrollIntoView({ behavior: animacionesActivas() ? 'smooth' : 'instant', block: 'nearest' })
  }, [ultima])

  const terminar = (lista: RespuestaSesion[], desc = descubiertos) => {
    const aciertos = lista.filter((r) => r.acierto && !r.ayudas).length
    const final = useTienda.getState().progreso
    const subidasNivel = Object.entries(nivelesIniciales).filter(([id, n]) => n > 0 && nivel(final.conceptos[id]) > n).map(([id]) => id)
    const resumen = terminarSesion({
      sesion,
      respuestas: lista,
      puntos: lista.reduce((s, r) => s + r.puntos, 0),
      // En el examen, las preguntas sin responder (se acabó el tiempo) cuentan como falladas, igual que en la nota.
      estrellas: estrellas(aciertos, examen ? totalItems : lista.length),
      nota: examen ? nota(aciertos, totalItems) : undefined,
      xp: lista.reduce((s, r) => s + (r.ayudas ? 0 : xpRespuesta(r.acierto, r.item.dificultad)), 0) + (lista.length === 0 || lista.some((r) => r.acierto && !r.ayudas) ? desc.length * 10 : 0),
      descubiertos: desc,
      subidasNivel,
      recuperaciones,
      ascenso: (() => {
        const antes = rango(dominadosIniciales).actual.nombre
        const ahora = rango(contarDominados(final)).actual.nombre
        return ahora !== antes ? ahora : undefined
      })(),
    })
    sonar(resumen.ascenso ? 'ascenso' : resumen.record ? 'record' : 'fin')
    // Si se acaba el tiempo con el diálogo «¿Salir?» abierto, se cierra: si no, quedaría encima del resultado.
    useTienda.setState({ dialogo: null })
    ir({ id: 'resultado', resumen, unidadId })
  }

  // Cronómetro de examen
  useEffect(() => {
    if (!examen || restante === undefined) return
    if (restante <= 0) {
      terminar(respuestas)
      return
    }
    const t = window.setTimeout(() => setRestante((r) => (r ?? 0) - 1), 1000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante, examen])

  const siguiente = (lista: RespuestaSesion[], desc = descubiertos) => {
    setUltima(undefined)
    setAyudas(sesion.guiada ? 1 : 0)
    if (i + 1 >= sesion.pasos.length) terminar(lista, desc)
    else setI(i + 1)
  }

  if (!paso) return null
  const saltar = () => setOrden((o) => [...o.slice(0, i), ...o.slice(i + 1), o[i]])

  const alResponder = (item: Item, respuesta: unknown) => {
    if (ultima) return
    const segundos = (Date.now() - inicio.current) / 1000
    const acierto = corregir(item.vista, respuesta)
    const objetivo = tiempoObjetivo(item.vista)
    const p = ayudas > 0 ? 0 : puntosRespuesta({ acierto, segundos, objetivo, dificultad: item.dificultad }, combo)
    const r: RespuestaSesion = { item, respuesta, acierto, segundos, puntos: p, ayudas }
    if (!ayudas || !acierto) responder(sesion, item, acierto, segundos, objetivo)
    if (!examen) registrar({ tipo: 'practica', unidadId: item.unidadId, conceptos: item.conceptos, actividad: item.clave,
      acierto, ayudas, detalle: item.vista.motor === 'vf' ? item.vista.afirmacion : item.vista.enunciado })
    setCombo(acierto && !ayudas ? combo + 1 : 0)
    const lista = [...respuestas, r]
    setRespuestas(lista)
    if (examen) {
      sonar('clic')
      siguiente(lista)
    } else {
      sonar(acierto ? 'bien' : 'mal', combo)
      setUltima(r)
    }
  }

  const salir = () => {
    const u = unidadId ? useTienda.getState().indice?.unidades.find((x) => x.id === unidadId) : undefined
    preguntar('¿Salir? Lo que ya has respondido se guarda, pero la partida no contará para récords ni para la racha.', 'Salir', () => ir(u ? { id: 'departamento', moduloId: u.modulo, unidadId: u.id } : { id: 'inicio' }))
  }

  const numItem = sesion.pasos.slice(0, i + 1).filter((p) => p.tipo === 'item').length

  const tipos = {
    turno: { texto: 'Sesión de hoy', icono: Clock },
    practica: { texto: sesion.juegoId ? 'Reto' : 'Práctica', icono: sesion.juegoId ? Gamepad2 : BookOpenCheck },
    examen: { texto: 'Examen', icono: GraduationCap },
    aprender: { texto: 'Lección', icono: Lightbulb },
    breve: { texto: 'Un objetivo', icono: Clock },
  } as const
  const T = tipos[sesion.tipo]
  const unidadPaso = paso.tipo === 'descubrir' ? paso.unidadId : paso.item.unidadId
  const moduloPaso = indice?.unidades.find((x) => x.id === unidadPaso)?.modulo

  return (
    <div className="app sesion-app" style={colorModulo(curso?.modulos.find((m) => m.id === moduloPaso))}>
      <header className="barra-sesion">
        <div className="barra-sesion-dentro">
          <button className="btn texto salir" onClick={salir}><X size={18} /> Salir</button>
          <div className="titulo-sesion">
            <span className={`tipo-sesion ${sesion.tipo}`}><T.icono size={15} /> {T.texto}</span>
            <span className="titulo-sesion-texto">{sesion.tipo === 'aprender' ? sesion.titulo.replace(/^Lección: /, '') : sesion.titulo}</span>
          </div>
          <div className="marcadores">
            {!examen && <span className="marcador" title="Puntos"><Star size={15} /> {puntos}</span>}
            {!examen && combo >= 2 && <span className="marcador combo" title="Aciertos seguidos"><Flame size={15} /> x{combo}</span>}
            {examen && restante !== undefined && <span className={`marcador reloj ${restante < 60 ? 'alerta' : ''}`} title="Tiempo restante"><Timer size={15} /> {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}</span>}
            <span className="marcador" title="Pregunta actual / total">{Math.max(numItem, 0)}/{totalItems}</span>
          </div>
        </div>
        <div className="progreso-sesion" aria-hidden><div style={{ width: `${(i / sesion.pasos.length) * 100}%` }} /></div>
      </header>

      <main className="panel-sesion" key={orden[i]}>
        {sesion.objetivo && <div className="objetivo-sesion"><small>Tu objetivo</small><strong>{sesion.objetivo}</strong></div>}
        {paso.tipo === 'descubrir' ? (
          <Descubrir concepto={paso.concepto} unidadId={paso.unidadId} nombreFuente={nombreFuente(paso.unidadId, paso.concepto.fuente.doc, paso.concepto.fuente.pag)}
            onFin={() => { descubrir(paso.concepto.id); const d = [...descubiertos, paso.concepto.id]; setDescubiertos(d); siguiente(respuestas, d) }} />
        ) : (
          <>
            <Encabezado paso={paso} sesion={sesion} final={i === sesion.pasos.length - 1} />
            <Motor vista={paso.item.vista} bloqueado={Boolean(ultima)} mostrarSolucion={!examen} confirmar={examen} onResponder={(r) => alResponder(paso.item, r)} />
            {examen && i < orden.length - 1 && <button className="btn texto saltar-pregunta" onClick={saltar}>Saltar y volver a ella al final <ArrowRight size={16} /></button>}
            {!examen && !ultima && <AyudaAprendizaje item={paso.item} alAyudar={setAyudas} />}
            {ultima && (
              <div ref={refCorreccion} className={`correccion ${ultima.acierto ? 'bien' : 'mal'}`} role="status">
                <div className="correccion-cabecera">
                  <span className="correccion-icono" aria-hidden>{ultima.acierto ? <Check size={22} /> : <X size={22} />}</span>
                  <strong>{ultima.acierto ? ultima.ayudas ? 'Correcto con ayuda' : '¡Correcto!' : 'Vamos a entender el error'}</strong>
                  {ultima.acierto && <span className="puntos-ganados">+{ultima.puntos} pts</span>}
                </div>
                <TextoRico texto={ultima.item.explicacion} />
                {!ultima.acierto && <AyudaAprendizaje key={`recuperar-${i}`} item={ultima.item} recuperar alComprobar={(item, acierto) => setRecuperaciones((lista) => [...lista, { conceptos: item.conceptos, acierto }])} />}
                <div className="correccion-pie">
                  <span className="fuente">Fuente: {nombreFuente(ultima.item.unidadId, ultima.item.fuente.doc, ultima.item.fuente.pag)}</span>
                  <div className="fila-botones">
                    <button className="btn texto" onClick={() => setInforme(true)}><Flag size={16} /> Informar</button>
                    <button className="btn principal" autoFocus onClick={() => siguiente(respuestas)}>{ultima.acierto ? 'Continuar' : 'Seguir · queda anotado para repasar'} <ArrowRight size={17} /></button>
                  </div>
                </div>
              </div>
            )}
            {informe && <Informe item={paso.item} onCerrar={() => setInforme(false)} />}
          </>
        )}
      </main>
    </div>
  )
}
