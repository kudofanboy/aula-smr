// Inicio: saludo, la sesión de hoy (acción principal), las asignaturas y datos útiles sobre cómo vas.
import { useState, type ReactNode } from 'react'
import { tareasPendientes } from '../motor/calendario'
import { ArrowRight, Award, CalendarRange, Clock, GraduationCap, Inbox, Lock, Target, TrendingUp, X } from 'lucide-react'
import { useTienda } from '../estado/tienda'
import { actividadSemana, dominados, masFallados, menosTocada, pendientesRepaso, semanaXp } from '../motor/estadisticas'
import { DIAS_DE_REPASO_FINAL, examenesProximos } from '../motor/practica'
import { hoy, META_XP_DIA, nivel } from '../motor/progreso'
import { construirBreve, construirRefuerzo, construirTurno } from '../motor/sesiones'
import { Anillo, IconoModulo, Logo, Marco } from './comun'
import { colorModulo, diasHasta, fechaDeHoy, textoDias } from './utilidades'
import { AVATARES, IDS_AVATAR, urlRetrato, urlSala, type AvatarId } from './arte'
import { Escenario } from './Escenario'
import { Creditos } from './Pantallas'
import { TrabajoCliente } from './Encargos'
import './inicio-claro.css'
import './demostracion.css'

const plural = (n: number, s: string, p = s + 's') => `${n} ${n === 1 ? s : p}`

function saludo(d = new Date()): string {
  const h = d.getHours()
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

function Puesto() {
  const { indice, progreso, calendario, ir } = useTienda()
  if (!indice) return null
  const breve = construirBreve(indice, progreso, calendario)
  const turno = construirTurno(indice, progreso, calendario)
  const hecho = Boolean(progreso.turnos[hoy()])
  const fecha = fechaDeHoy()
  return (
    <section className="inicio-hero" aria-label="Tu siguiente paso">
      <div className="inicio-escena">
        <Escenario sala="oficina" clase={`heroe puesto-escena ${hecho ? 'hecho' : ''}`} />
      </div>
      <div className="inicio-accion">
        <header className="saludo">
          <span className="sobretitulo">{fecha}</span>
          <h1>{saludo()}, {progreso.nombre || 'compañero'}.</h1>
        </header>
        <p className="inicio-etiqueta">Tu siguiente paso</p>
        <p className="inicio-objetivo">{breve.objetivo || 'Avanza una lección o repasa un concepto pendiente.'}</p>
        <p className="inicio-motivo">{breve.motivo || 'Un paso corto mantiene el temario en marcha.'}</p>
        <button className="boton-jornada inicio-breve" disabled={breve.pasos.length === 0} onClick={() => ir({ id: 'sesion', sesion: breve })}>
          <span className="boton-jornada-icono" aria-hidden><Clock size={24} /></span>
          <span className="boton-jornada-texto"><strong>{breve.pasos.length ? 'Tengo unos 5 minutos' : 'Todo al día'}</strong><small>{breve.pasos.length ? 'Una sesión breve, a tu ritmo' : 'No hay ningún paso breve disponible ahora'}</small></span>
          {breve.pasos.length > 0 && <ArrowRight size={21} className="flecha" />}
        </button>
        <button className="inicio-completa" disabled={turno.pasos.length === 0} onClick={() => ir({ id: 'sesion', sesion: turno })}>
          <span>{turno.pasos.length ? 'Hacer la sesión completa' : 'Sesión completa al día'}</span>{turno.pasos.length > 0 && <ArrowRight size={16} />}
        </button>
      </div>
    </section>
  )
}

/** Tarjeta del panel: un dato útil y, si procede, qué hacer con él. */
function Tarjeta({ titulo, icono, clase = '', children }: { titulo: string; icono: ReactNode; clase?: string; children: ReactNode }) {
  return (
    <section className={`tarjeta-panel ${clase}`}>
      <h2>{icono} {titulo}</h2>
      {children}
    </section>
  )
}

function Pendiente() {
  const { indice, progreso, calendario, curso, ir } = useTienda()
  if (!indice) return null
  const tickets = pendientesRepaso(indice, progreso)
  const hechas = new Set(progreso.encargosHechos)
  const proximas = tareasPendientes(calendario, hechas).slice(0, 2)
  const jornadaHecha = Boolean(progreso.turnos[hoy()])
  return (
    <Tarjeta titulo="Pendiente" icono={<Inbox size={19} />} clase="pendiente">
      <div className="dato-grande">
        <strong className="numero">{tickets}</strong>
        <span>{tickets === 1 ? 'repaso pendiente' : 'repasos pendientes'}<small>{tickets ? (jornadaHecha ? 'disponibles al seguir estudiando o mañana' : 'se hacen en la sesión de hoy') : 'nada que repasar ahora'}</small></span>
      </div>
      {proximas.length > 0 && (
        <ul className="lista-fechas">
          {proximas.map((e) => {
            const m = curso?.modulos.find((x) => x.id === e.modulo)
            const d = diasHasta(e.fecha)
            return (
              <li key={e.id} style={colorModulo(m)}>
                <span className="punto-mod" aria-hidden />
                <span className="lf-texto"><b>{m?.corto ?? e.modulo}</b> {e.titulo}</span>
                <span className={`plazo ${d <= 1 ? 'urgente' : d <= 7 ? 'pronto' : ''}`}>{d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${d} días`}</span>
              </li>
            )
          })}
        </ul>
      )}
      <button className="btn texto" onClick={() => ir({ id: 'agenda' })}>Agenda ficticia de ejemplo <ArrowRight size={15} /></button>
    </Tarjeta>
  )
}

function Fallos() {
  const { indice, progreso, curso, ir, avisar } = useTienda()
  if (!indice) return null
  const lista = masFallados(indice, progreso)
  return (
    <Tarjeta titulo="Donde más fallas" icono={<Target size={19} />} clase="fallos">
      {lista.length === 0 ? (
        <p className="vacio">Aún no hay fallos que destacar. Cuando te equivoques varias veces en algo, aparecerá aquí para que lo refuerces.</p>
      ) : (
        <ul className="lista-conceptos-panel">
          {lista.map((d) => {
            const m = curso?.modulos.find((x) => x.id === d.modulo)
            return (
              <li key={d.id} style={colorModulo(m)}>
                <button onClick={() => { const s = construirRefuerzo(indice, progreso, d.id); if ('error' in s) avisar(s.error); else ir({ id: 'sesion', sesion: s, unidadId: d.unidadId }) }}>
                  <span className="punto-mod" aria-hidden />
                  <span className="lc-texto"><b>{d.nombre}</b><small>{m?.corto} · {d.fallos} de {d.aciertos + d.fallos} fallados</small></span>
                  <span className="lc-accion">Reforzar <ArrowRight size={14} /></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Tarjeta>
  )
}

function Semana() {
  const { indice, progreso, curso, ir } = useTienda()
  if (!indice || !curso) return null
  const abiertos = curso.modulos.filter((m) => indice.unidades.some((u) => u.modulo === m.id))
  const act = actividadSemana(progreso, abiertos.map((m) => m.id))
  const max = Math.max(1, ...Object.values(act))
  const menos = menosTocada(indice, progreso)
  const mm = curso.modulos.find((m) => m.id === menos?.modulo)
  return (
    <Tarjeta titulo="Lo que menos has tocado esta semana" icono={<CalendarRange size={19} />} clase="semana">
      {mm && menos && (
        <p className="frase">
          <b style={colorModulo(mm)} className="texto-mod">{mm.corto}</b>: {menos.ejercicios === 0 ? 'ni un ejercicio en 7 días.' : `solo ${plural(menos.ejercicios, 'ejercicio')} en 7 días.`}
        </p>
      )}
      <small className="leyenda-semana">Ejercicios respondidos en los últimos 7 días</small>
      <ul className="barras-modulo">
        {abiertos.map((m) => (
          <li key={m.id} style={colorModulo(m)}>
            <span className="bm-nombre">{m.corto}</span>
            <span className="bm-barra"><i style={{ width: `${(act[m.id] / max) * 100}%` }} /></span>
            <span className="bm-num">{act[m.id]}</span>
          </li>
        ))}
      </ul>
      {mm && <button className="btn texto" onClick={() => ir({ id: 'departamento', moduloId: mm.id })}>Ir a {mm.corto} <ArrowRight size={15} /></button>}
    </Tarjeta>
  )
}

function Dominas() {
  const { indice, progreso, ir } = useTienda()
  if (!indice) return null
  const lista = dominados(indice, progreso)
  const total = indice.concepto.size
  return (
    <Tarjeta titulo="Ya dominas" icono={<Award size={19} />} clase="dominas">
      <div className="dato-grande">
        <Anillo valor={lista.length} total={total} tam={64} grosor={7} clase="ok">{Math.round((lista.length / total) * 100)}%</Anillo>
        <span><strong>{lista.length}</strong> de {total} conceptos<small>Dominado = nivel 3 de 5 o más</small></span>
      </div>
      {lista.length > 0
        ? <div className="chips-dominados">{lista.slice(0, 5).map((d) => <span key={d.id} className="chip ok">{d.nombre}</span>)}{lista.length > 5 && <span className="chip">+{lista.length - 5}</span>}</div>
        : <p className="vacio">Un concepto se domina al acertarlo varias veces en días distintos. La sesión de hoy te lo pregunta en el momento justo.</p>}
      <button className="btn texto" onClick={() => ir({ id: 'expediente' })}>Ver mi ficha completa <ArrowRight size={15} /></button>
    </Tarjeta>
  )
}

function GraficoSemana() {
  const { progreso } = useTienda()
  const dias = semanaXp(progreso)
  const max = Math.max(META_XP_DIA, ...dias.map((d) => d.xp))
  const nombreDia = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')
  const cumplidos = dias.filter((d) => d.xp >= META_XP_DIA).length
  return (
    <Tarjeta titulo="Tu semana" icono={<TrendingUp size={19} />} clase="grafico">
      <p className="frase">{cumplidos === 0 ? 'Todavía ningún día con el objetivo cumplido esta semana.' : `Objetivo diario cumplido ${plural(cumplidos, 'día')} de 7.`}</p>
      <div className="grafico-barras" role="img" aria-label="XP de los últimos 7 días">
        <span className="linea-meta" style={{ bottom: `${(META_XP_DIA / max) * 100}%` }}><small>meta {META_XP_DIA} XP</small></span>
        {dias.map((d, i) => (
          <div key={d.dia} className={`gb-col ${i === 6 ? 'hoy' : ''} ${d.xp >= META_XP_DIA ? 'cumplido' : ''}`}>
            <span className="gb-hueco"><span className="gb-barra" style={{ height: `${(d.xp / max) * 100}%` }} title={`${d.xp} XP`} /></span>
            <small>{i === 6 ? 'hoy' : nombreDia(d.dia)}</small>
          </div>
        ))}
      </div>
    </Tarjeta>
  )
}

/** Personaje a elegir: tarjetas con el retrato (sonríe al pasar el ratón o al elegirlo). */
function OpcionesPersonaje({ elegido, alElegir }: { elegido?: AvatarId; alElegir: (id: AvatarId) => void }) {
  const [encima, setEncima] = useState<AvatarId>()
  return (
    <div className="avatares-opciones" role="radiogroup" aria-label="Personaje">
      {IDS_AVATAR.map((id) => (
        <button key={id} role="radio" aria-checked={elegido === id} className={`avatar-opcion ${elegido === id ? 'elegido' : ''}`}
          onClick={() => alElegir(id)} onPointerEnter={() => setEncima(id)} onPointerLeave={() => setEncima(undefined)}>
          <img src={urlRetrato(id, elegido === id || encima === id ? 'feliz' : 'neutra')} alt="" />
          <strong>{AVATARES[id].nombre}</strong>
        </button>
      ))}
    </div>
  )
}

/** Primera vez: nombre y personaje. */
export function Bienvenida() {
  const { cambiar } = useTienda()
  const [nombre, setNombre] = useState('')
  const [personaje, setPersonaje] = useState<AvatarId>()
  const valido = nombre.trim().length >= 2 && Boolean(personaje)
  const entrar = () => {
    if (valido) cambiar((p) => ({ ...p, nombre: nombre.trim().slice(0, 24), avatar: personaje }))
  }
  return (
    <div className="bienvenida">
      <div className="bienvenida-foto" style={{ backgroundImage: `url(${urlSala('entrada')})` }} aria-hidden />
      <div className="bienvenida-caja">
        <Logo />
        <h1>Bienvenido/a</h1>
        <p className="bienvenida-texto">Estudia y practica los contenidos de 1º de SMR: lecciones, repasos y casos prácticos.</p>
        <label className="campo">
          <span>¿Cómo te llamas?</span>
          <input autoFocus value={nombre} maxLength={24} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && entrar()} placeholder="Tu nombre" />
        </label>
        <div className="campo">
          <span>Elige tu personaje</span>
          <OpcionesPersonaje elegido={personaje} alElegir={setPersonaje} />
        </div>
        <button className="btn principal grande" disabled={!valido} onClick={entrar}>Empezar <ArrowRight size={18} /></button>
        <p className="nota-privacidad">Tu nombre y tu progreso se guardan solo en este dispositivo.</p>
      </div>
    </div>
  )
}

/** Para quien ya tenía nombre de una versión anterior y aún no ha elegido personaje. */
export function ElegirAvatar() {
  const { cambiar, progreso } = useTienda()
  const [elegido, setElegido] = useState<AvatarId>()
  return (
    <div className="elegir-avatar" style={{ backgroundImage: `url(${urlSala('entrada')})` }}>
      <div className="elegir-caja">
        <Logo />
        <h1>Elige tu personaje, {progreso.nombre}.</h1>
        <p>Podrás cambiarlo cuando quieras en <b>Mi ficha</b>.</p>
        <OpcionesPersonaje elegido={elegido} alElegir={setElegido} />
        <button className="btn principal grande" disabled={!elegido} onClick={() => elegido && cambiar((p) => ({ ...p, avatar: elegido }))}>Continuar <ArrowRight size={18} /></button>
      </div>
    </div>
  )
}

/** Guía de tres pasos que se muestra una sola vez, justo después de la bienvenida. */
function GuiaRapida() {
  const { progreso, cambiar } = useTienda()
  if (progreso.ajustes.guiaVista) return null
  const cerrar = () => cambiar((p) => ({ ...p, ajustes: { ...p.ajustes, guiaVista: true } }))
  return (
    <section className="guia-rapida" aria-label="Guía rápida">
      <header><h2>Cómo funciona</h2><button className="icono-btn" aria-label="Cerrar la guía" onClick={cerrar}><X size={18} /></button></header>
      <ol>
        <li><span className="guia-num">1</span><div><b>Empieza con un paso breve.</b> Pulsa <i>Tengo unos 5 minutos</i> para trabajar un objetivo concreto; la sesión completa sigue disponible debajo.</div></li>
        <li><span className="guia-num">2</span><div><b>Asignaturas.</b> Entra por las tarjetas de debajo. Las lecciones se desbloquean de una en una y cada una se entiende jugando.</div></li>
        <li><span className="guia-num">3</span><div><b>Casos prácticos.</b> Cuando sepas lo suficiente se abren casos para aplicar lo aprendido: cablear una red, diagnosticar una avería, configurar una máquina virtual.</div></li>
      </ol>
      <button className="btn principal" onClick={cerrar}>Entendido, a trabajar</button>
    </section>
  )
}

/** Las asignaturas como tarjetas grandes con la foto de su sala. */
function Dock() {
  const { curso, indice, progreso, ir } = useTienda()
  if (!curso || !indice) return null
  return (
    <section className="dock" aria-label="Asignaturas">
      {curso.modulos.map((m) => {
        const conceptos = indice.unidades.filter((u) => u.modulo === m.id).flatMap((u) => u.conceptos)
        const vistos = conceptos.filter((c) => nivel(progreso.conceptos[c.id]) >= 1).length
        const cerrado = conceptos.length === 0
        return (
          <button key={m.id} className={`dock-tarjeta ${cerrado ? 'cerrada' : ''}`} style={colorModulo(m)} onClick={() => ir({ id: 'departamento', moduloId: m.id })}>
            <span className="dock-foto" style={{ backgroundImage: `url(${urlSala(m.id)})` }} aria-hidden />
            <span className="dock-icono" aria-hidden><IconoModulo id={m.id} size={26} /></span>
            <span className="dock-texto">
              <strong>{m.corto ?? m.nombre}</strong>
              <small>{cerrado ? 'Próximamente' : `${vistos} de ${conceptos.length} lecciones vistas`}</small>
            </span>
            {cerrado ? <Lock size={16} className="dock-candado" aria-hidden /> : <span className="mini-barra" aria-hidden><i style={{ width: `${(vistos / conceptos.length) * 100}%` }} /></span>}
          </button>
        )
      })}
    </section>
  )
}

/** Próximo examen del calendario con la preparación estimada y el ritmo para llegar con tiempo. */
function ProximoExamen() {
  const { indice, progreso, calendario, curso, ir } = useTienda()
  if (!indice) return null
  const e = examenesProximos(indice, progreso, calendario)[0]
  if (!e) return null
  const m = curso?.modulos.find((x) => x.id === e.evento.modulo)
  const fecha = new Date(e.evento.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  return (
    <Tarjeta titulo="Próximo examen" icono={<GraduationCap size={19} />} clase="examen-proximo">
      <div className="examen-datos" style={colorModulo(m)}>
        <Anillo valor={e.prep.preparado} total={1} tam={76} grosor={8} clase="mod"><b>{Math.round(e.prep.preparado * 100)}%</b></Anillo>
        <span><strong>{m?.corto ?? e.evento.modulo} · {e.evento.titulo}</strong><small>{textoDias(e.dias)} · {fecha}</small></span>
      </div>
      <p className="frase">{e.prep.restantes === 0
        ? 'Ya has visto todas las lecciones: ahora toca repasar y hacer simulacros.'
        : `Te faltan ${plural(e.prep.restantes, 'lección', 'lecciones')}. Para llegar con ${DIAS_DE_REPASO_FINAL} días de repaso: ${plural(e.ritmo, 'lección nueva', 'lecciones nuevas')} al día.`}</p>
      <small className="leyenda-semana">La preparación es una estimación: recuerdo medio de lo aprendido sobre el total de lecciones.</small>
      <button className="btn texto" onClick={() => ir({ id: 'practica', moduloId: e.evento.modulo })}>Practicar y hacer un simulacro <ArrowRight size={15} /></button>
    </Tarjeta>
  )
}

export function Escritorio() {
  const ir = useTienda((s) => s.ir)
  return (
    <Marco activa="inicio">
      <div className="panel-personal inicio-claro">
        <Puesto />
        <GuiaRapida />
        <Dock />
        <TrabajoCliente />
        <section className="inicio-datos" aria-label="Fechas y tareas próximas">
          <ProximoExamen />
          <Pendiente />
        </section>
        <details className="inicio-como-voy">
          <summary><span><TrendingUp size={19} /> Cómo voy</span><small>Progreso, repasos y actividad</small></summary>
          <div className="rejilla-panel">
            <Fallos />
            <Semana />
            <Dominas />
            <GraficoSemana />
          </div>
        </details>
        <section className="inicio-demostracion"><div><h2>Para enseñar el proyecto y revisar sus fuentes</h2><p>Un recorrido breve por la explicación, el laboratorio y el informe.</p></div><button className="btn secundario" onClick={() => ir({ id: 'demostracion' })}><GraduationCap size={18} /> Ver demostración</button></section>
        <Creditos />
      </div>
    </Marco>
  )
}
