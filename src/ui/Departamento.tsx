// Asignatura: cada unidad es una rejilla de lecciones (un concepto cada una) con retos (minijuegos) entre medias
// y el examen de la unidad al final.
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, BookOpenCheck, BriefcaseBusiness, Check, ClipboardCheck, Gamepad2, GraduationCap, Lock, Play, RotateCcw, Star, X } from 'lucide-react'
import type { Concepto, Juego, Unidad } from '../contenido/esquema'
import { useTienda } from '../estado/tienda'
import { DOMINADO, nivel, retencion, vencido } from '../motor/progreso'
import { candidatosNuevos, construirJuego, construirLeccion, construirRefuerzo, MAX_NUEVOS_DIA, nuevosHoy, poolJuego } from '../motor/sesiones'
import { Anillo, Estrellas, IconoModulo, Marco } from './comun'
import { colorModulo, useModulo, type Modulo } from './utilidades'
import { sonar } from './sonido'
import { urlSala } from './arte'
import { Escenario, type PuntoEscena } from './Escenario'
import { ZONAS } from './zonas'

type Nodo =
  | { tipo: 'concepto'; id: string; c: Concepto; numero: number }
  | { tipo: 'juego'; id: string; j: Juego }

/** Coloca los retos justo después del último concepto que necesitan; exámenes y banco del profesor, al final. */
function nodosDe(u: Unidad): Nodo[] {
  const pos = new Map<string, number>(u.conceptos.map((c, i) => [c.id, i]))
  const despues = new Map<number, Juego[]>()
  for (const j of u.juegos) {
    const k = j.tipo === 'practica' && j.conceptos?.length ? Math.max(...j.conceptos.map((c) => pos.get(c) ?? u.conceptos.length - 1)) : u.conceptos.length - 1
    despues.set(k, [...(despues.get(k) ?? []), j])
  }
  const orden = { practica: 0, 'banco-profesor': 1, examen: 2 } as const
  const res: Nodo[] = []
  u.conceptos.forEach((c, i) => {
    res.push({ tipo: 'concepto', id: c.id, c, numero: i + 1 })
    for (const j of (despues.get(i) ?? []).sort((a, b) => orden[a.tipo] - orden[b.tipo])) res.push({ tipo: 'juego', id: j.id, j })
  })
  return res
}

/** Empieza la formación de un concepto (con aviso si hoy ya se han hecho muchas). */
function useIniciarFormacion(unidadId: string) {
  const { indice, progreso, ir, avisar, preguntar } = useTienda()
  return (conceptoId: string) => {
    if (!indice) return
    const go = () => {
      const s = construirLeccion(indice, progreso, conceptoId)
      if ('error' in s) return avisar(s.error)
      sonar('clic')
      ir({ id: 'sesion', sesion: s, unidadId })
    }
    if (nuevosHoy(progreso) >= MAX_NUEVOS_DIA)
      return preguntar(`Hoy ya has hecho ${MAX_NUEVOS_DIA} lecciones nuevas. Aprender demasiado el mismo día hace que se olvide antes. ¿Seguir igualmente?`, 'Seguir', go)
    go()
  }
}

/** Resumen de la unidad abierta y botón para seguir donde lo dejaste. */
function ResumenUnidad({ u, proxima }: { u: Unidad; proxima?: Unidad }) {
  const { indice, progreso, calendario, ir } = useTienda()
  const aprender = useIniciarFormacion(u.id)
  if (!indice) return null
  const total = u.conceptos.length
  const vistos = u.conceptos.filter((c) => nivel(progreso.conceptos[c.id]) >= 1).length
  const dominados = u.conceptos.filter((c) => nivel(progreso.conceptos[c.id]) >= DOMINADO).length
  const repasar = u.conceptos.filter((c) => progreso.conceptos[c.id] && vencido(progreso.conceptos[c.id])).length
  const siguiente = candidatosNuevos(indice, progreso, calendario, u.id)[0]
  return (
    <section className="resumen-unidad" aria-label={`Resumen de ${u.codigo}`}>
      <Anillo valor={vistos} total={total} tam={72} grosor={8} clase="mod"><b>{Math.round((vistos / total) * 100)}%</b></Anillo>
      <div className="ru-datos">
        <span className="sobretitulo">{u.codigo} · unidad actual</span>
        <h2>{u.titulo}</h2>
         <p><b>{vistos}</b> de {total} lecciones vistas · <b>{dominados}</b> dominados por repasos{repasar > 0 && <> · <span className="ru-repasar"><b>{repasar}</b> por repasar</span></>}</p>
      </div>
      {siguiente
        ? <button className="btn principal grande" onClick={() => aprender(siguiente.id)}><Play size={19} /> Continuar: {siguiente.nombre} <ArrowRight size={18} /></button>
        : proxima
          ? <button className="btn principal grande" onClick={() => ir({ id: 'departamento', moduloId: proxima.modulo, unidadId: proxima.id })}><Check size={18} /> Unidad vista: pasar a {proxima.codigo} <ArrowRight size={18} /></button>
          : <span className="ru-hecho"><Check size={18} /> Todo aprendido por ahora</span>}
    </section>
  )
}

function Camino({ u }: { u: Unidad }) {
  const { indice, progreso, calendario, ir, avisar } = useTienda()
  const aprender = useIniciarFormacion(u.id)
  const [abierto, setAbierto] = useState<string>()
  const refDetalle = useRef<HTMLDivElement>(null)
  const nodos = nodosDe(u)
  const disponibles = new Set(indice ? candidatosNuevos(indice, progreso, calendario, u.id).map((c) => c.id) : [])
  const actualId = nodos.find((n) => n.tipo === 'concepto' && disponibles.has(n.id))?.id

  useEffect(() => {
    if (abierto) refDetalle.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [abierto])

  if (!indice) return null
  const nombre = (id: string) => indice.concepto.get(id)?.concepto.nombre ?? id

  const empezar = (s: ReturnType<typeof construirLeccion>) => {
    if ('error' in s) return avisar(s.error)
    sonar('clic')
    ir({ id: 'sesion', sesion: s, unidadId: u.id })
  }

  const detalleDe = (n: Nodo) => n.tipo === 'concepto' ? (() => {
    const e = progreso.conceptos[n.id]
    if (e?.descubierto)
      return (
        <>
          <strong>{n.c.nombre}</strong>
          <p>Nivel {nivel(e)} de 5 · recuerdo estimado hoy: {Math.round(retencion(e) * 100)} %{vencido(e) ? '. Toca repasarlo.' : '.'}</p>
          <div className="fila-botones">
            <button className="btn principal" onClick={() => empezar(construirRefuerzo(indice, progreso, n.id))}><RotateCcw size={17} /> Refuerzo (hasta 4 ejercicios)</button>
            <button className="btn secundario" onClick={() => ir({ id: 'apuntes', conceptoId: n.id })}><BookOpen size={17} /> Ver apuntes</button>
          </div>
        </>
      )
    if (disponibles.has(n.id))
      return (
        <>
          <strong>{n.c.nombre}</strong>
          <p>Lección nueva: lo descubres jugando y luego lo practicas. Unos 3 minutos.</p>
          <button className="btn principal" onClick={() => aprender(n.id)}><Play size={17} /> Empezar la lección</button>
        </>
      )
    const faltan = n.c.requiere.filter((r) => !progreso.conceptos[r]?.descubierto)
    const anterior = u.conceptos.slice(0, u.conceptos.indexOf(n.c)).find((c) => !progreso.conceptos[c.id]?.descubierto)
    return (
      <>
        <strong>{n.c.nombre}</strong>
        <p>{anterior ? `Completa antes la lección: ${anterior.nombre}.` : faltan.length ? `Se desbloquea cuando aprendas: ${faltan.map(nombre).join(', ')}.` : 'Aún no está disponible.'}</p>
      </>
    )
  })() : (() => {
    const pool = poolJuego(u, n.j, progreso)
    const ok = pool.estaticos.length > 0 || pool.generadores.length > 0
    const rec = progreso.juegos[n.id]
    const prueba = ok ? construirJuego(u, n.j, progreso) : undefined
    const reales = prueba && !('error' in prueba) ? prueba.pasos.length : 0
    const sinAprender = (n.j.conceptos ?? u.conceptos.map((c) => c.id)).filter((id) => !progreso.conceptos[id]?.descubierto).map((id) => u.conceptos.find((c) => c.id === id)?.nombre ?? id)
    return (
      <>
        <strong>{n.j.titulo}</strong>
        <p>{n.j.descripcion}</p>
        {ok && reales > 0 && reales < n.j.preguntas && <p className="aviso-pocas">Con lo que has aprendido tendrá {reales} de {n.j.preguntas} preguntas{n.j.tipo === 'examen' ? ' y la nota se calcula sobre esas' : ''}.{sinAprender.length > 0 ? ' Aprende más para el reto completo.' : ' Es todo lo que hay disponible en esta unidad por ahora.'}</p>}
        {rec && <p className="record-nodo">Récord: <b>{rec.mejor}</b> pts{rec.mejorNota !== undefined ? ` · mejor nota ${rec.mejorNota}` : ''}</p>}
        {ok
          ? <button className="btn principal" onClick={() => { const s = construirJuego(u, n.j, progreso); if ('error' in s) avisar(s.error); else { sonar('clic'); ir({ id: 'sesion', sesion: s, unidadId: u.id }) } }}>
              {rec ? <><RotateCcw size={17} /> Superar récord</> : <><Play size={17} /> Jugar</>}
            </button>
          : <p className="bloqueo">Aprende antes: {sinAprender.slice(0, 3).join(', ')}{sinAprender.length > 3 ? ` y ${sinAprender.length - 3} más` : ''}.</p>}
      </>
    )
  })()

  const nodoAbierto = nodos.find((n) => n.id === abierto)
  return (
    <div className="ruta">
      <ol className="ruta-rejilla">
        {nodos.map((n, i) => {
          let estado: string
          let icono: React.ReactNode
          let etiqueta: string
          let sub = ''
          let nivelN = 0
          if (n.tipo === 'concepto') {
            const e = progreso.conceptos[n.id]
            nivelN = nivel(e)
            etiqueta = n.c.nombre
            if (e?.descubierto) {
              estado = vencido(e) ? 'repasar' : nivelN >= DOMINADO ? 'dominado' : 'hecho'
              icono = nivelN >= DOMINADO ? <Star size={26} fill="currentColor" /> : <Check size={28} strokeWidth={3} />
              sub = vencido(e) ? 'toca repasar' : `nivel ${nivelN}/5`
            } else if (disponibles.has(n.id)) {
              estado = n.id === actualId ? 'actual' : 'disponible'
              icono = <span className="nodo-num">{n.numero}</span>
              sub = 'lección nueva'
            } else {
              estado = 'bloqueado'
              icono = <Lock size={22} />
              sub = 'bloqueada'
            }
          } else {
            const pool = poolJuego(u, n.j, progreso)
            const ok = pool.estaticos.length > 0 || pool.generadores.length > 0
            const rec = progreso.juegos[n.id]
            estado = `juego tipo-${n.j.tipo} ${ok ? (rec ? 'jugado' : 'disponible') : 'bloqueado'}`
            icono = n.j.tipo === 'examen' ? <GraduationCap size={30} /> : n.j.tipo === 'banco-profesor' ? <BookOpenCheck size={28} /> : <Gamepad2 size={30} />
            etiqueta = n.j.titulo
            sub = n.j.tipo === 'examen' ? 'examen' : n.j.tipo === 'banco-profesor' ? 'banco del profesor' : 'reto'
          }
          const vivo = abierto === n.id
          return (
            <li key={n.id} className={`ruta-nodo nodo-camino ${estado} ${vivo ? 'abierto' : ''}`} style={{ ['--i' as string]: i }}>
              <button className="ruta-boton" aria-expanded={vivo} aria-label={`${etiqueta} (${sub || 'bloqueado'})`}
                onClick={() => { sonar('clic'); setAbierto(vivo ? undefined : n.id) }}>
                <span className="nodo-boton" style={n.tipo === 'concepto' && nivelN > 0 ? ({ '--nivel': `${(nivelN / 5) * 360}deg` } as React.CSSProperties) : undefined}>
                  <span className="nodo-cara">{icono}</span>
                </span>
                <span className="ruta-texto">
                  <b>{etiqueta}</b>
                  {sub && <small>{sub}</small>}
                  {n.tipo === 'juego' && progreso.juegos[n.id] && <Estrellas n={progreso.juegos[n.id].mejorEstrellas} />}
                </span>
              </button>
              {n.id === actualId && !vivo && <span className="globo-empieza">¡Empieza aquí!</span>}
            </li>
          )
        })}
      </ol>
      {nodoAbierto && (
        <div ref={refDetalle} className="tarjeta-nodo ruta-detalle" role="region" aria-label="Detalle">
          <button className="cerrar" aria-label="Cerrar" onClick={() => setAbierto(undefined)}><X size={16} /></button>
          {detalleDe(nodoAbierto)}
        </div>
      )}
    </div>
  )
}

/** Última unidad abierta de cada asignatura (para volver a ella al regresar desde otra pantalla). */
const ultimaUnidad = new Map<string, string>()

/** Escena de la asignatura con sus zonas pulsables: lección, casos prácticos y práctica. */
function Heroe({ m, elegida, abierta, children }: { m: Modulo; elegida?: Unidad; abierta: boolean; children: React.ReactNode }) {
  const { indice, progreso, calendario, ir } = useTienda()
  const iniciar = useIniciarFormacion(elegida?.id ?? '')
  const zonas = ZONAS[m.id]
  const siguiente = indice && elegida ? candidatosNuevos(indice, progreso, calendario, elegida.id)[0] : undefined
  const tono = m.tono ?? 250
  const puntos: PuntoEscena[] = abierta && zonas ? [
    { id: 'casos', etiqueta: `Casos prácticos de ${m.nombre}`, rotulo: 'Casos prácticos', caja: zonas.casos, tono, alPulsar: () => ir({ id: 'encargos', moduloId: m.id }) },
    { id: 'practicar', etiqueta: `Practicar ${m.nombre}`, rotulo: 'Practicar', caja: zonas.practicar, tono, alPulsar: () => ir({ id: 'practica', moduloId: m.id }) },
    {
      id: 'leccion', etiqueta: siguiente ? `Siguiente lección: ${siguiente.nombre}` : 'Ver las lecciones', rotulo: siguiente ? 'Siguiente lección' : 'Ver lecciones', caja: zonas.leccion, tono,
      alPulsar: () => (siguiente ? iniciar(siguiente.id) : document.querySelector('.mapa-camino')?.scrollIntoView({ behavior: 'smooth' })),
    },
  ] : []
  return <Escenario sala={m.id} puntos={puntos} clase="banner">{children}</Escenario>
}

export function Departamento({ moduloId, unidadId }: { moduloId: string; unidadId?: string }) {
  const { indice, progreso, calendario, ir } = useTienda()
  const m = useModulo(moduloId)
  if (!indice || !m) return null
  const unidades = indice.unidades.filter((u) => u.modulo === moduloId)
  const elegida = unidades.find((u) => u.id === unidadId)
    ?? unidades.find((u) => u.id === ultimaUnidad.get(moduloId))
    ?? unidades.find((u) => candidatosNuevos(indice, progreso, calendario, u.id).length > 0)
    ?? unidades[0]
  if (elegida) ultimaUnidad.set(moduloId, elegida.id)
  const cerradas = m.unidades.filter((uu) => !unidades.some((u) => u.codigo === uu.codigo))
  const cabecera = (
    <div className="hud-dpto">
      <header className="dpto-titulo">
        <span className="dpto-icono" aria-hidden><IconoModulo id={m.id} size={32} /></span>
        <div>
          <h1>{m.nombre}</h1>
        </div>
      </header>
    </div>
  )
  return (
    <Marco activa={moduloId} estilo={colorModulo(m)}>
      <div className="departamento">
        {urlSala(m.id)
          ? <Heroe m={m} elegida={elegida} abierta={unidades.length > 0}>{cabecera}</Heroe>
          : <div className="hud-dpto sin-escena">{cabecera}</div>}

        {unidades.length === 0 ? (
          <div className="panel vacio-dpto">
            <Lock size={28} />
            <h2>Próximamente</h2>
            <p>Esta demostración incluye solo actividades de ejemplo. Puedes contribuir con contenido original o con licencia compatible.</p>
          </div>
        ) : (
          <>
            {elegida && <ResumenUnidad key={`r-${elegida.id}`} u={elegida} proxima={unidades[unidades.indexOf(elegida) + 1]} />}
            <div className="pestanas-unidad" role="tablist" aria-label="Unidades">
              {unidades.map((u) => {
                const vistos = u.conceptos.filter((c) => nivel(progreso.conceptos[c.id]) >= 1).length
                return (
                  <button key={u.id} role="tab" aria-selected={u.id === elegida?.id} className={u.id === elegida?.id ? 'activa' : ''}
                    onClick={() => ir({ id: 'departamento', moduloId, unidadId: u.id })}>
                    <b>{u.codigo}</b> <span>{u.titulo}</span>
                    <small>{vistos}/{u.conceptos.length}</small>
                  </button>
                )
              })}
              {cerradas.length > 0 && <span className="pestana-cerrada" title={cerradas.map((c) => `${c.codigo} ${c.titulo}`).join('\n')}><Lock size={13} /> {cerradas.length} más, próximamente</span>}
            </div>
            <div className="dpto-acciones">
              <button className="btn secundario" onClick={() => ir({ id: 'practica', moduloId })}><Play size={16} /> Practicar</button>
              <button className="btn secundario" onClick={() => ir({ id: 'practica', moduloId })}><ClipboardCheck size={16} /> Simulacro de examen</button>
              <button className="btn secundario" onClick={() => ir({ id: 'encargos', moduloId })}><BriefcaseBusiness size={16} /> Casos prácticos</button>
            </div>
            {elegida && <div className="mapa-camino"><Camino key={elegida.id} u={elegida} /></div>}
          </>
        )}
      </div>
    </Marco>
  )
}
