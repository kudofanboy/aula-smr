// Pantallas secundarias: resultado de una partida, Mi ficha (expediente) y la agenda del curso.
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, BriefcaseBusiness, CalendarClock, ClipboardCopy, Download, FileCheck2, Flame, HelpCircle, Megaphone, PartyPopper, Pencil, Trophy, Upload } from 'lucide-react'
import { exportarProgreso, importarProgreso, informesGuardados, MODO_COMPARTIR, MODO_PROFESOR } from '../estado/almacen'
import { useTienda, type ResumenSesion } from '../estado/tienda'
import { DOMINADO, hoy, META_XP_DIA, nivel, retencion } from '../motor/progreso'
import { candidatosNuevos, construirLeccion, MAX_NUEVOS_DIA, nuevosHoy, sinResponder } from '../motor/sesiones'
import { catalogoEncargos, conoceEncargo, encargoVisible } from '../motor/encargos'
import { generarInforme } from '../motor/practica'
import { Anillo, Estrellas, EtiquetaModulo, IconoModulo, Marco } from './comun'
import { colorModulo, diasHasta, useModulo } from './utilidades'
import { avatarDe, AVATARES, IDS_AVATAR, urlRetrato } from './arte'
import { CabeceraEscena } from './Escenario'
import { animacionesActivas } from './efectos'
import './aprendizaje-claro.css'
import { RevisionRespuesta } from './Revision'

const plural = (n: number, s: string, p = s + 's') => `${n} ${n === 1 ? s : p}`

function Cifra({ valor, etiqueta, icono }: { valor: ReactNode; etiqueta: string; icono?: ReactNode }) {
  return (
    <div className="cifra">
      {icono && <span className="cifra-icono">{icono}</span>}
      <strong>{valor}</strong>
      <small>{etiqueta}</small>
    </div>
  )
}

/** Cuenta hacia arriba de 0 a `hasta` (para que la XP ganada se note). */
function useContador(hasta: number, ms = 900): number {
  const [v, setV] = useState(() => animacionesActivas() ? 0 : hasta)
  useEffect(() => {
    if (!animacionesActivas()) return
    const t0 = performance.now()
    let id = 0
    const paso = (t: number) => {
      const f = Math.min(1, (t - t0) / ms)
      setV(Math.round(hasta * (1 - (1 - f) ** 3)))
      if (f < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [hasta, ms])
  return animacionesActivas() ? v : hasta
}

/** Confeti con CSS (sin librerías). */
function Confeti() {
  // El azar se decide una sola vez al montar (un inicializador perezoso no se repite en cada pintado).
  const [piezas] = useState(() => Array.from({ length: 46 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, dur: 2.2 + Math.random() * 1.4, tono: [250, 150, 85, 330, 30, 290][i % 6], giro: Math.random() * 720 - 360,
  })))
  return (
    <div className="confeti" aria-hidden>
      {piezas.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, background: `oklch(0.75 0.16 ${p.tono})`, '--giro': `${p.giro}deg` } as React.CSSProperties} />
      ))}
    </div>
  )
}

/** En un examen manda la nota (aprobado con 5), no las estrellas. Si se acabó el tiempo, se dice primero. */
function fraseExamen(nota: number, pendientes: number): string {
  const tiempo = pendientes > 0 ? `Se acabó el tiempo con ${pendientes} ${pendientes === 1 ? 'pregunta' : 'preguntas'} sin responder. ` : ''
  if (nota >= 9) return `${tiempo}Examen superado con nota.`
  if (nota >= 5) return `${tiempo}Aprobado. Mira abajo lo que has fallado: es lo que más enseña.`
  return `${tiempo}Suspenso por ahora. Revisa abajo cada fallo y repasa esas lecciones antes de volver a intentarlo.`
}

/** Con menos de 3 respuestas las estrellas no dicen nada (un fallo bastaría para 0): se juzga por los aciertos. */
const MIN_PARA_ESTRELLAS = 3

function frase(estrellas: number, total: number, tipo: string, aciertos: number): string {
  if (total === 0) return 'Has visto la explicación. Aún falta comprobarla con una actividad.'
  if (aciertos === 0) return 'Hoy no ha salido. Repasa la explicación en los apuntes y vuelve a intentarlo cuando quieras.'
  if (total < MIN_PARA_ESTRELLAS) return aciertos === total ? '¡Bien hecho! Ya lo has practicado sin fallos.' : 'Ya has empezado a practicarlo. Revisa lo que ha fallado para consolidarlo.'
  if (estrellas === 3) return tipo === 'examen' ? 'Examen superado con nota. Impecable.' : '¡Impecable! Ni un fallo.'
  if (estrellas === 2) return 'Buen trabajo. Un par de detalles y lo tienes.'
  if (estrellas === 1) return 'Vas bien. Mira abajo lo que ha fallado: es lo que más enseña.'
  return 'Hoy ha costado, pero cada fallo queda anotado y volverá a salir cuando toque.'
}

export function Resultado({ resumen, unidadId }: { resumen: ResumenSesion; unidadId?: string }) {
  const { ir, indice, progreso, calendario, avisar, preguntar, sentir, abrirCaso } = useTienda()
  const aciertos = resumen.respuestas.filter((r) => r.acierto && !r.ayudas).length
  const conAyuda = resumen.respuestas.filter((r) => r.acierto && r.ayudas).length
  const recuperados = resumen.recuperaciones?.filter((r) => r.acierto).length ?? 0
  const avatarId = avatarDe(progreso)
  const esExamen = resumen.sesion.tipo === 'examen'
  const animo = esExamen
    ? ((resumen.nota ?? 0) >= 5 ? 'feliz' : 'preocupada')
    : resumen.estrellas >= 2 || resumen.record || Boolean(resumen.ascenso) ? 'feliz' : resumen.respuestas.length > 0 && aciertos === 0 ? 'preocupada' : resumen.respuestas.length >= MIN_PARA_ESTRELLAS && resumen.estrellas === 0 ? 'preocupada' : 'neutra'
  useEffect(() => { sentir(animo) }, [sentir, animo])
  const nombre = (id: string) => indice?.concepto.get(id)?.concepto.nombre ?? id
  const tipo = resumen.sesion.tipo
  const examen = tipo === 'examen'
  const u = unidadId ? indice?.unidades.find((x) => x.id === unidadId) : undefined
  const m = useModulo(u?.modulo)
  const xp = useContador(resumen.xp)
  const xpHoy = progreso.xpDia[hoy()] ?? 0
  const metaAhora = xpHoy >= META_XP_DIA && xpHoy - resumen.xp < META_XP_DIA
  // Sin confeti si el resultado ha sido malo, aunque se cumpla la meta diaria de XP (fallar también da XP).
  const buenResultado = examen ? (resumen.nota ?? 0) >= 5 : resumen.respuestas.length === 0 || aciertos / resumen.respuestas.length >= 0.6
  const fiesta = buenResultado && ((resumen.estrellas === 3 && resumen.respuestas.length >= MIN_PARA_ESTRELLAS) || resumen.record || Boolean(resumen.ascenso) || metaAhora)
  const titulo = tipo === 'breve' ? 'Tu paso de hoy' : tipo === 'turno' ? 'Sesión terminada' : examen ? 'Resultado del examen' : tipo === 'aprender' ? 'Lección practicada' : resumen.sesion.juegoId ? 'Reto terminado' : 'Práctica terminada'
  const fallos = resumen.respuestas.filter((r) => !r.acierto)
  // Si el examen termina por tiempo, las preguntas a las que no se llegó cuentan como falladas en la nota: se enseñan también.
  const pendientes = sinResponder(resumen.sesion, resumen.respuestas.map((r) => r.item))
  const totalExamen = resumen.respuestas.length + pendientes.length
  const pendiente = [...new Set(fallos.flatMap((r) => r.item.conceptos))].find((id) => progreso.conceptos[id]?.aplicacion?.estado === 'pendiente')
  const recuperar = pendiente && indice ? () => {
    const s = construirLeccion(indice, progreso, pendiente)
    if ('error' in s) avisar(s.error)
    else ir({ id: 'sesion', sesion: s, unidadId: indice.concepto.get(pendiente)?.unidad.id })
  } : undefined
  const siguiente = indice && u ? candidatosNuevos(indice, progreso, calendario, u.id)[0] : undefined
  // Casos prácticos que esta sesión acaba de dejar listos (todos sus conceptos aprendidos y alguno aprendido ahora).
  const casosNuevos = indice ? catalogoEncargos(indice.unidades).filter(({ encargo }) => !progreso.encargos[encargo.id] && encargoVisible(encargo, progreso) && conoceEncargo(encargo, progreso) && encargo.pasos.some((p) => p.conceptos.some((c) => resumen.descubiertos.includes(c)))) : []
  return (
    <div className="resultado-fondo" style={u ? colorModulo(m) : undefined}>
      {fiesta && animacionesActivas() && <Confeti />}
      <main className="resultado">
        <section className="panel tarjeta-resultado">
          {avatarId && <img className="resultado-retrato" src={urlRetrato(avatarId, animo)} alt="" />}
          <span className="sobretitulo">{resumen.sesion.titulo}</span>
          <h1>{titulo}</h1>
          {!examen && resumen.respuestas.length >= MIN_PARA_ESTRELLAS && <Estrellas n={resumen.estrellas} grande />}
          {examen && <div className="nota-grande">{resumen.nota?.toFixed(1)}<small>/10</small></div>}
          {examen && <p className={`veredicto-examen ${(resumen.nota ?? 0) >= 5 ? 'bien' : 'mal'}`}>{(resumen.nota ?? 0) >= 5 ? 'Aprobado' : 'Suspenso'}</p>}
          <p className="frase-resultado">{recuperados > 0 ? `Tras revisar los errores, has resuelto ${recuperados} ${recuperados === 1 ? 'situación nueva' : 'situaciones nuevas'} con ayuda. El primer intento sigue registrado; el siguiente paso será practicar sin apoyo.` : conAyuda > 0 ? `Has aplicado ${conAyuda} ${conAyuda === 1 ? 'actividad' : 'actividades'} con ayuda. Volver a hacerlo sin apoyo será el siguiente paso.` : examen ? fraseExamen(resumen.nota ?? 0, pendientes.length) : frase(resumen.estrellas, resumen.respuestas.length, tipo, aciertos)}</p>
          {resumen.sesion.objetivo && <div className="objetivo-sesion"><small>Objetivo trabajado</small><strong>{resumen.sesion.objetivo}</strong><small>{pendiente ? 'Queda una comprobación pendiente. Puedes parar aquí y retomarla desde Inicio.' : 'Este bloque ha terminado. Puedes parar aquí o seguir voluntariamente.'}</small></div>}
          {resumen.ascenso && <div className="logro ascenso"><PartyPopper size={20} /> ¡Subes al <b>{resumen.ascenso}</b>!</div>}
          {resumen.record && <div className="logro record"><Trophy size={20} /> {examen ? <>¡Tu mejor nota en este examen! {resumen.nota?.toFixed(1)}{resumen.recordAnterior !== undefined ? ` (antes ${resumen.recordAnterior.toFixed(1)})` : ''}</> : <>¡Nuevo récord! {resumen.puntos} pts{resumen.recordAnterior ? ` (antes ${resumen.recordAnterior})` : ''}</>}</div>}
          {metaAhora && <div className="logro meta"><Flame size={20} /> ¡Objetivo del día cumplido!</div>}
          <div className="cifras">
            <div className="cifra xp-ganada"><strong>+{xp}</strong><small>XP</small></div>
            {resumen.respuestas.length > 0 && <Cifra valor={`${aciertos}/${examen ? totalExamen : resumen.respuestas.length}`} etiqueta={examen ? 'aciertos' : 'aciertos sin ayuda'} />}
            {!examen && resumen.respuestas.length > 0 && <Cifra valor={resumen.puntos} etiqueta="puntos" />}
            <div className="cifra meta-dia">
              <Anillo valor={xpHoy} total={META_XP_DIA} tam={46} grosor={6}>{xpHoy >= META_XP_DIA ? '✓' : ''}</Anillo>
              <small>{Math.min(xpHoy, META_XP_DIA)}/{META_XP_DIA} XP hoy</small>
            </div>
          </div>
          {resumen.descubiertos.length > 0 && (
            <div className="lista-chips"><span>Explicación vista:</span>{resumen.descubiertos.map((id) => <span key={id} className="chip nuevo">{nombre(id)}</span>)}</div>
          )}
          {resumen.descubiertos.map((id) => {
            const estado = progreso.conceptos[id]?.aplicacion?.estado
            return <p key={`estado-${id}`} className="estado-aprendizaje"><b>{nombre(id)}:</b> {estado === 'sin-ayuda' ? 'última actividad acertada sin ayuda' : estado === 'con-ayuda' ? 'aplicado con ayuda; falta probar sin apoyo' : 'pendiente de comprobar o repasar'}. El recuerdo se comprobará en futuros repasos.</p>
          })}
          {resumen.subidasNivel.length > 0 && (
            <div className="lista-chips"><span>Suben de nivel:</span>{resumen.subidasNivel.map((id) => <span key={id} className="chip ok">{nombre(id)}</span>)}</div>
          )}
          {casosNuevos.map(({ encargo }) => (
            <div className="logro caso" key={encargo.id}><BriefcaseBusiness size={20} /> <span>Caso práctico desbloqueado: <b>{encargo.asunto}</b></span> <button className="btn secundario" onClick={() => abrirCaso(encargo.id)}>Empezar</button></div>
          ))}
          <div className="fila-botones">
            {recuperar && pendiente && <button className="btn principal grande" onClick={recuperar}>Repasar la lección: {nombre(pendiente)} <ArrowRight size={18} /></button>}
            {siguiente && indice && u && (
              <button className={`btn ${recuperar ? 'secundario' : 'principal'} grande`} autoFocus={!recuperar} onClick={() => {
                const empezar = () => {
                  const s = construirLeccion(indice, progreso, siguiente.id)
                  if ('error' in s) avisar(s.error)
                  else ir({ id: 'sesion', sesion: s, unidadId: u.id })
                }
                if (nuevosHoy(progreso) >= MAX_NUEVOS_DIA)
                  preguntar(`Hoy ya has hecho ${MAX_NUEVOS_DIA} lecciones nuevas. Puedes repasar y dejar lo nuevo para mañana. ¿Seguir igualmente?`, 'Seguir', empezar)
                else empezar()
              }}>
                Siguiente lección: {siguiente.nombre} <ArrowRight size={18} />
              </button>
            )}
            {u && <button className={`btn ${siguiente ? 'secundario' : 'principal'}`} autoFocus={!siguiente} onClick={() => ir({ id: 'departamento', moduloId: u.modulo, unidadId: u.id })}>Volver a la asignatura</button>}
            <button className={`btn ${u ? 'secundario' : 'principal'}`} autoFocus={!u} onClick={() => ir({ id: 'inicio' })}>Ir a mi panel</button>
          </div>
        </section>
        {(examen || fallos.length > 0) && (
          <section className="panel">
            <header className="panel-cabecera"><h2>{examen ? 'Corrección' : 'Para repasar'}</h2><span className="nota-lateral">{examen ? `${aciertos} de ${totalExamen} bien${pendientes.length ? ` · ${pendientes.length} sin responder` : ''}` : plural(fallos.length, 'fallo')}</span></header>
            <ul className="revision">
              {resumen.respuestas.filter((r) => examen || !r.acierto).map((r, k) => (
                <li key={k} className={r.acierto ? 'bien' : 'mal'}>
                  <span className="marca-revision" role="img" aria-label={r.acierto ? 'Bien' : 'Mal'}>{r.acierto ? '✓' : '✗'}</span>
                  <div className="cuerpo-revision">
                    <EtiquetaModulo unidadId={r.item.unidadId} />
                    <RevisionRespuesta item={r.item} respuesta={r.respuesta} />
                  </div>
                </li>
              ))}
              {pendientes.map((item, k) => (
                <li key={`sin-${k}`} className="sin-responder">
                  <span className="marca-revision" role="img" aria-label="Sin responder">–</span>
                  <div className="cuerpo-revision">
                    <EtiquetaModulo unidadId={item.unidadId} />
                    <RevisionRespuesta item={item} respondida={false} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

function CopiaSeguridad() {
  const { progreso, cambiar, avisar, preguntar, indice } = useTienda()
  const importar = async () => {
    try {
      const datos = await importarProgreso(indice?.unidades ?? [])
      preguntar('Esto sustituye tu progreso actual por el del archivo. ¿Seguir?', 'Importar', () => {
        cambiar(() => datos)
        avisar('Progreso importado.')
      })
    } catch (e) {
      avisar(`No se pudo importar: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return (
    <section className="panel">
      <header className="panel-cabecera"><h2><Download size={20} /> Copia de seguridad</h2></header>
      <p className="ayuda">
        {MODO_COMPARTIR
          ? 'Tu progreso se guarda en este navegador. Si borras los datos del navegador o cambias de ordenador, se pierde: exporta una copia de vez en cuando y la importas en el otro equipo.'
          : 'Tu progreso se guarda en la carpeta del juego (datos/progreso.json), con copias diarias automáticas.'}
      </p>
      <div className="fila-botones izquierda">
        <button className="btn secundario" onClick={() => exportarProgreso(progreso)}><Download size={17} /> Exportar progreso</button>
        <button className="btn secundario" onClick={importar}><Upload size={17} /> Importar progreso</button>
      </div>
    </section>
  )
}

export function Creditos() {
  return (
    <footer className="creditos">
      <p>
        Aula SMR · Unofficial study material for the Spanish vocational course SMR, created by kudofanboy.
        Public demo with fictional course data and original example activities. It is not an official curriculum.
      </p>
    </footer>
  )
}

const NIVELES_MAPA = [
  { id: 'nd', texto: 'Sin descubrir' },
  { id: 'visto', texto: 'Vista, sin practicar' },
  { id: 'flojo', texto: 'Flojo (recuerdo < 70 %)' },
  { id: 'regular', texto: 'Regular (70–85 %)' },
  { id: 'bien', texto: 'Bien (> 85 %)' },
  { id: 'dominado', texto: 'Dominado' },
] as const

function CambiarAvatar() {
  const { progreso, cambiar } = useTienda()
  const actual = avatarDe(progreso)
  return (
    <div className="cambiar-avatar" role="radiogroup" aria-label="Tu personaje">
      {IDS_AVATAR.map((id) => (
        <button key={id} role="radio" aria-checked={actual === id} className={actual === id ? 'activo' : ''} title={AVATARES[id].nombre} onClick={() => cambiar((p) => ({ ...p, avatar: id }))}>
          <img src={urlRetrato(id)} alt={AVATARES[id].nombre} />
        </button>
      ))}
    </div>
  )
}

function CambiarNombre() {
  const { progreso, cambiar } = useTienda()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(progreso.nombre)
  const guardar = () => {
    if (nombre.trim().length >= 2) cambiar((p) => ({ ...p, nombre: nombre.trim().slice(0, 24) }))
    setEditando(false)
  }
  if (!editando) return <button className="btn texto" onClick={() => { setNombre(progreso.nombre); setEditando(true) }}><Pencil size={15} /> Cambiar nombre</button>
  return (
    <span className="editar-nombre">
      <input autoFocus value={nombre} maxLength={24} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guardar()} aria-label="Tu nombre" />
      <button className="btn principal" onClick={guardar}>Guardar</button>
    </span>
  )
}

function InformeProgreso() {
  const { indice, progreso, calendario, curso } = useTienda()
  const [aviso, setAviso] = useState('')
  if (!indice) return null
  const texto = () => (MODO_PROFESOR ? 'DEMOSTRACIÓN FICTICIA · NO ES EL PROGRESO DE UN ALUMNO\nLas lecciones están desbloqueadas para revisión. La actividad de esta pestaña no se guarda.\n\n' : '') + generarInforme(indice, progreso, calendario, (curso?.modulos ?? []).map((m) => ({ id: m.id, nombre: m.nombre })))
  const copiar = (contenido: string, mensaje: string) => {
    void navigator.clipboard.writeText(contenido).then(() => setAviso(mensaje), () => setAviso('No se pudo copiar: usa Descargar.'))
  }
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([texto()], { type: 'text/plain;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'informe-progreso.txt' })
    a.click()
    URL.revokeObjectURL(url)
  }
  const avisos = MODO_COMPARTIR ? informesGuardados() : []
  return (
    <section className="panel informe">
      <h2>Informe para el profesorado</h2>
      <p>Un resumen de tu progreso para enviarlo a la tutora o al profesorado. Se genera en tu dispositivo y no se envía solo.</p>
      <details><summary>Revisar el contenido antes de compartirlo</summary><pre className="informe-vista">{texto()}</pre></details>
      <div className="fila-botones">
        <button className="btn principal" onClick={() => copiar(texto(), 'Informe copiado: pégalo en un correo o mensaje.')}><ClipboardCopy size={16} /> Copiar el informe</button>
        <button className="btn secundario" onClick={descargar}><Download size={16} /> Descargar como texto</button>
        {avisos.length > 0 && <button className="btn texto" onClick={() => copiar(JSON.stringify(avisos, null, 1), 'Avisos de error copiados: envíaselos a quien mantiene el juego.')}>Copiar mis avisos de error ({avisos.length})</button>}
      </div>
      <small role="status">{aviso}</small>
    </section>
  )
}

export function Expediente() {
  const { indice, progreso, curso, calendario, ir } = useTienda()
  if (!indice) return null
  const todos = indice.unidades.flatMap((u) => u.conceptos)
  const dominadosN = todos.filter((c) => nivel(progreso.conceptos[c.id]) >= DOMINADO).length
  const vistos = todos.filter((c) => nivel(progreso.conceptos[c.id]) >= 1).length
  const turnos = Object.keys(progreso.turnos).length
  const proximo = calendario.filter((e) => e.tipo === 'examen' && diasHasta(e.fecha) >= 0).sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
  return (
    <Marco activa="expediente">
      <div className="pagina">
        <CabeceraEscena titulo={`Ficha de ${progreso.nombre || 'alumno/a'}`} descripcion="Cómo vas en cada asignatura. El recuerdo es la probabilidad estimada de que recuerdes el concepto hoy." />
        <section className="panel perfil-ficha"><div className="acciones-ficha"><CambiarAvatar /><CambiarNombre /></div></section>
        <div className="cifras-expediente">
          <Cifra valor={<>{dominadosN}<small>/{todos.length}</small></>} etiqueta="conceptos dominados" />
          <Cifra valor={vistos} etiqueta="conceptos aprendidos" />
          <Cifra valor={progreso.xp} etiqueta="XP total" />
          <Cifra valor={turnos} etiqueta={turnos === 1 ? 'día con sesión completa' : 'días con sesión completa'} />
          <Cifra valor={progreso.racha.mejor} etiqueta="mejor racha (días)" />
          {proximo && <Cifra icono={<CalendarClock size={18} />} valor={`${diasHasta(proximo.fecha)} d`} etiqueta={`examen de ${curso?.modulos.find((x) => x.id === proximo.modulo)?.corto ?? proximo.modulo}`} />}
        </div>
        <div className="leyenda-mapa" aria-label="Leyenda">
          {NIVELES_MAPA.map((n) => <span key={n.id} className={`ley-mapa ${n.id}`}><i /> {n.texto}</span>)}
        </div>
        {(curso?.modulos ?? []).map((m) => {
          const unidades = indice.unidades.filter((u) => u.modulo === m.id)
          if (unidades.length === 0) return null
          return (
            <section key={m.id} className="panel modulo-expediente" style={colorModulo(m)}>
              <header className="panel-cabecera"><h2><IconoModulo id={m.id} size={20} /> {m.nombre}</h2></header>
              {unidades.map((u) => (
                <div key={u.id} className="unidad-expediente">
                  <h3><button className="enlace" onClick={() => ir({ id: 'departamento', moduloId: m.id, unidadId: u.id })}>{u.codigo} · {u.titulo}</button></h3>
                  <div className="mapa-calor">
                    {u.conceptos.map((c) => {
                      const e = progreso.conceptos[c.id]
                      const n = nivel(e)
                      // Vista pero sin ninguna respuesta todavía: aún no hay recuerdo que medir.
                      const sinPracticar = Boolean(e?.descubierto) && e!.aciertos + e!.fallos === 0
                      const r = e && n > 0 ? retencion(e) : 0
                      const clase = n === 0 ? 'nd' : sinPracticar ? 'visto' : r < 0.7 ? 'flojo' : n >= DOMINADO ? 'dominado' : r < 0.85 ? 'regular' : 'bien'
                      return (
                        <button type="button" key={c.id} className={`celda ${clase}`} onClick={() => ir(n > 0 ? { id: 'apuntes', conceptoId: c.id } : { id: 'departamento', moduloId: m.id, unidadId: u.id })} title={`${c.nombre}\nNivel ${n}/5${n ? ` · recuerdo ${Math.round(r * 100)} %` : ' · sin descubrir'}${e ? ` · ${e.aciertos} aciertos, ${e.fallos} fallos` : ''}`}>
                          <span className="celda-nombre">{c.nombre}</span>
                          {n > 0 && <span className="celda-dato">{sinPracticar ? 'vista' : `${Math.round(r * 100)} %`}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>
          )
        })}
        <CopiaSeguridad />
        <InformeProgreso />
        <Creditos />
      </div>
    </Marco>
  )
}

export function Agenda() {
  const { calendario, progreso, cambiar, curso } = useTienda()
  const eventos = [...calendario].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const proximos = eventos.filter((e) => diasHasta(e.fecha) >= 0)
  const pasados = eventos.filter((e) => diasHasta(e.fecha) < 0).reverse()
  const hecho = (id: string) => progreso.encargosHechos.includes(id)
  const alternar = (id: string) => cambiar((p) => ({ ...p, encargosHechos: hecho(id) ? p.encargosHechos.filter((x) => x !== id) : [...p.encargosHechos, id] }))
  const tipos = {
    entrega: { icono: Upload, texto: 'Entrega' },
    examen: { icono: FileCheck2, texto: 'Examen' },
    cuestionario: { icono: HelpCircle, texto: 'Cuestionario' },
    aviso: { icono: Megaphone, texto: 'Aviso' },
  } as const
  const fila = (e: (typeof eventos)[number], pasado: boolean) => {
    const d = diasHasta(e.fecha)
    const m = curso?.modulos.find((x) => x.id === e.modulo)
    const T = tipos[e.tipo]
    const fecha = new Date(e.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    return (
      <li key={e.id} className={`evento ${hecho(e.id) ? 'hecho' : ''} ${pasado ? 'pasado' : d <= 1 ? 'urgente' : d <= 7 ? 'pronto' : ''}`} style={colorModulo(m)}>
        <span className="evento-fecha"><b>{fecha}</b>{e.hora && <small>{e.hora}</small>}</span>
        <span className="evento-tipo" title={T.texto}><T.icono size={18} /></span>
        <span className="evento-texto">
          <span className="evento-titulo"><span className="asignatura">{m?.corto ?? e.modulo}</span> {e.titulo}</span>
          <small>{T.texto}{e.detalle ? ` · ${e.detalle}` : ''}</small>
          {e.fuente && <small><a href={e.fuente.url} target="_blank" rel="noreferrer">{e.fuente.titulo}</a> · Comprobado el {new Date(e.fuente.revisado + 'T12:00:00').toLocaleDateString('es-ES')}</small>}
        </span>
        {!pasado && <span className="plazo">{d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${d} días`}</span>}
        {(e.tipo === 'entrega' || e.tipo === 'cuestionario') && !pasado && (
          <label className="marcar-hecho"><input type="checkbox" checked={hecho(e.id)} onChange={() => alternar(e.id)} /> Hecho</label>
        )}
      </li>
    )
  }
  return (
    <Marco activa="agenda">
      <div className="pagina">
        <CabeceraEscena titulo="Fechas reales" descripcion="Entregas, cuestionarios y exámenes que ha publicado el profesorado en material del curso. Si algo cambia, manda lo que diga material del curso." />
        <section className="panel">
          <ul className="agenda">{proximos.length ? proximos.map((e) => fila(e, false)) : <li className="vacio">No hay fechas próximas.</li>}</ul>
        </section>
        {pasados.length > 0 && (
          <details className="panel pasados">
            <summary>Fechas pasadas ({pasados.length})</summary>
            <ul className="agenda">{pasados.map((e) => fila(e, true))}</ul>
          </details>
        )}
      </div>
    </Marco>
  )
}
