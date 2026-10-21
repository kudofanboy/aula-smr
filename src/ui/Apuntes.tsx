// Apuntes de una lección: lo que se enseña, en forma de resumen para releer (sin preguntas ni puntos).
import { ArrowLeft, BookOpen, Lock, Play, RotateCcw, Wrench } from 'lucide-react'
import { pasosDeFormacion } from '../contenido/didactica'
import { lugarEnFuente } from '../contenido/texto'
import { useTienda } from '../estado/tienda'
import { construirLeccion, construirRefuerzo } from '../motor/sesiones'
import { Marco } from './comun'
import { colorModulo, useModulo } from './utilidades'
import { CabeceraEscena } from './Escenario'
import { DibujoVisual } from './Visuales'
import { LoImportante } from './Descubrir'
import { TextoLinea, TextoRico } from './TextoRico'
import { LeccionActual } from './leccionActual'

export function Apuntes({ conceptoId }: { conceptoId: string }) {
  const { indice, progreso, ir, avisar } = useTienda()
  const reg = indice?.concepto.get(conceptoId)
  const m = useModulo(reg?.unidad.modulo)
  if (!indice || !reg) return <Marco activa="inicio"><div className="pagina"><h1>Esta lección no existe</h1><button className="btn principal" onClick={() => ir({ id: 'inicio' })}>Ir a Inicio</button></div></Marco>
  const { concepto: c, unidad: u } = reg
  const visto = Boolean(progreso.conceptos[c.id]?.descubierto)
  const fuente = u.fuentes.find((f) => f.id === c.fuente.doc)?.titulo ?? c.fuente.doc
  const volver = () => ir({ id: 'departamento', moduloId: u.modulo, unidadId: u.id })
  const empezar = (s: ReturnType<typeof construirLeccion>) => { if ('error' in s) avisar(s.error); else ir({ id: 'sesion', sesion: s, unidadId: u.id }) }
  const v2 = u.formato === 2
  const pasos = pasosDeFormacion(c.descubrir, u.formato)
  return (
    <LeccionActual.Provider value={c.id}>
    <Marco activa={u.modulo} estilo={colorModulo(m)}>
      <div className="pagina apuntes">
        <CabeceraEscena sala={u.modulo} tono={m?.tono} titulo={c.nombre} descripcion={`Apuntes · ${u.codigo} · ${u.titulo}`}
          acciones={<button className="btn secundario" onClick={volver}><ArrowLeft size={16} /> Volver a la asignatura</button>} />
        {!visto ? (
          <section className="panel apuntes-bloqueado">
            <Lock size={28} />
            <h2>Aún no has llegado a esta lección</h2>
            <p>Los apuntes se abren cuando haces la lección, para que primero la descubras jugando.</p>
            <button className="btn principal" onClick={volver}>Ir a la asignatura</button>
          </section>
        ) : (
          <article className="panel apuntes-cuerpo">
            {c.objetivo && <p className="objetivo-leccion"><b>Objetivo:</b> <TextoLinea texto={c.objetivo} /></p>}
            {c.clave && <LoImportante clave={c.clave} />}
            {pasos.map((p, i) => {
              if (p.tipo === 'idea') return (
                <div key={i} className="apunte-idea">
                  {p.titulo && <h3 className="titulo-idea"><TextoLinea texto={p.titulo} /></h3>}
                  {p.visual && <DibujoVisual visual={p.visual} />}
                  {p.explicacionPrevia && p.explicacionPrevia !== p.texto && <TextoRico texto={p.explicacionPrevia} />}
                  <TextoRico texto={p.texto} />
                </div>
              )
              // En v2 las preguntas son para practicar, no apuntes: se practican con el botón de abajo.
              if (v2 && (p.tipo === 'prediccion' || p.tipo === 'pregunta')) return null
              if (p.tipo === 'prediccion' || p.tipo === 'pregunta') return (
                <div key={i} className="apunte-clave">
                  <b>{p.pregunta}</b>
                  <p><span>Respuesta:</span> {p.opciones[p.correcta]}</p>
                  <p>{p.revelacion}</p>
                </div>
              )
              if (p.tipo === 'explorar') return (
                <div key={i} className="apunte-explorar">
                  <DibujoVisual visual={p.visual} />
                  <ul>{p.zonas.map((z) => <li key={z.id}><b>{z.titulo}.</b> <TextoLinea texto={z.texto} /></li>)}</ul>
                </div>
              )
              if (v2) return null
              return <p key={i} className="apunte-simulador">{p.instruccion}</p>
            })}
            {c.matiz && (
              <div className="matiz">
                <div className="matiz-examen"><span className="matiz-titulo"><BookOpen size={16} /> Para el examen</span><TextoRico texto={c.matiz.examen} /></div>
                <div className="matiz-real"><span className="matiz-titulo"><Wrench size={16} /> En la práctica real</span><TextoRico texto={c.matiz.real} /></div>
              </div>
            )}
            <p className="fuente">Fuente: {fuente}{lugarEnFuente(u.fuentes.find((f) => f.id === c.fuente.doc), c.fuente.pag)}</p>
            <div className="fila-botones">
              <button className="btn principal" onClick={() => empezar(construirRefuerzo(indice, progreso, c.id))}><Play size={17} /> Practicar este concepto</button>
              <button className="btn secundario" onClick={() => empezar(construirLeccion(indice, progreso, c.id))}><RotateCcw size={17} /> Ver la lección otra vez</button>
            </div>
          </article>
        )}
      </div>
    </Marco>
    </LeccionActual.Provider>
  )
}
