// Revisión de una respuesta en la pantalla de resultados: qué respondiste, en qué fallaste, cuál era la respuesta
// correcta y por qué. Cada elemento lleva ✓ o ✗ (además del color) para que se distinga también sin ver colores.
import type { ReactNode } from 'react'
import { revisar, type Item, type Revision } from '../motor/items'
import { averiados, construirRed } from '../motor/simred'
import { DibujoRed, DibujoVisual } from './Visuales'
import { TextoLinea, TextoRico } from './TextoRico'

function Marca({ bien }: { bien: boolean }) {
  return <span className={`marca-elemento ${bien ? 'bien' : 'mal'}`} role="img" aria-label={bien ? 'Bien' : 'Mal'}>{bien ? '✓' : '✗'}</span>
}

function Bloque({ titulo, extra, clase = '', children }: { titulo: string; extra?: string; clase?: string; children: ReactNode }) {
  return (
    <div className={`bloque-revision ${clase}`}>
      <span className="etiqueta-revision">{titulo}{extra && <small> · {extra}</small>}</span>
      {children}
    </div>
  )
}

const vf = (v: boolean) => (v ? 'Verdadero' : 'Falso')

/** La respuesta correcta completa, para cuando no se respondió o hace falta verla entera. */
function RespuestaCorrecta({ item }: { item: Item }) {
  const v = item.vista
  switch (v.motor) {
    case 'test':
      return <p><TextoLinea texto={v.opciones[v.correcta]} /></p>
    case 'vf':
      return <p>{vf(v.verdadero)}</p>
    case 'clasificar':
      return <ul>{v.categorias.map((c) => <li key={c.id}><b>{c.nombre}:</b> {v.elementos.filter((e) => e.categoria === c.id).map((e) => e.texto).join(' · ') || '—'}</li>)}</ul>
    case 'ordenar':
      return <ol>{v.pasos.map((p) => <li key={p}>{p}</li>)}</ol>
    case 'emparejar':
      return <ul>{v.pares.map((p) => <li key={p.a}><b>{p.a}</b> → {p.b}</li>)}</ul>
    case 'nodos':
      return <p>{v.correctas.length ? [...v.correctas].sort().join(', ') : 'Ninguno'}</p>
  }
}

/** Lo que respondió el alumno, marcado elemento a elemento. Los fallos van primero: son lo que hay que mirar. */
function TuRespuesta({ r }: { r: Revision }) {
  switch (r.motor) {
    case 'test':
      return (
        <Bloque titulo="Tu respuesta" clase={r.acierto ? 'bien' : 'mal'}>
          <p className="elegida"><Marca bien={r.acierto} /> <TextoLinea texto={r.elegida ?? ''} /></p>
          {r.porQue && <p className="por-que-fallo"><TextoLinea texto={r.porQue} /></p>}
        </Bloque>
      )
    case 'vf':
      return (
        <Bloque titulo="Tu respuesta" clase={r.acierto ? 'bien' : 'mal'}>
          <p className="elegida"><Marca bien={r.acierto} /> {vf(r.elegida ?? false)}</p>
        </Bloque>
      )
    case 'clasificar': {
      const bien = r.elementos.filter((e) => e.bien).length
      return (
        <Bloque titulo="Tu respuesta" extra={`${bien} de ${r.elementos.length} bien colocados`}>
          <ul className="elementos-revision">
            {[...r.elementos].sort((a, b) => Number(a.bien) - Number(b.bien)).map((e) => (
              <li key={e.texto} className={e.bien ? 'bien' : 'mal'}>
                <Marca bien={e.bien} /> <b>{e.texto}</b>
                {e.bien ? <> → {e.correcta}</> : <span className="correccion-elemento">Lo pusiste en «{e.puesta ?? 'ninguna'}». Va en «{e.correcta}».</span>}
              </li>
            ))}
          </ul>
        </Bloque>
      )
    }
    case 'emparejar': {
      const bien = r.pares.filter((p) => p.bien).length
      return (
        <Bloque titulo="Tus parejas" extra={`${bien} de ${r.pares.length} bien`}>
          <ul className="elementos-revision">
            {[...r.pares].sort((a, b) => Number(a.bien) - Number(b.bien)).map((p) => (
              <li key={p.a} className={p.bien ? 'bien' : 'mal'}>
                <Marca bien={p.bien} /> <b>{p.a}</b>
                {p.bien ? <> → {p.correcta}</> : <span className="correccion-elemento">Lo uniste con «{p.elegida ?? 'nada'}». Su pareja es «{p.correcta}».</span>}
              </li>
            ))}
          </ul>
        </Bloque>
      )
    }
    case 'ordenar': {
      const bien = r.tuyo.filter((p) => p.bien).length
      return (
        <div className="columnas-revision">
          <Bloque titulo="Tu orden" extra={`${bien} de ${r.correcto.length} en su sitio`}>
            <ol className="elementos-revision">
              {r.tuyo.map((p) => <li key={p.texto} className={p.bien ? 'bien' : 'mal'}><Marca bien={p.bien} /> {p.texto}</li>)}
            </ol>
          </Bloque>
          {!r.acierto && <Bloque titulo="Orden correcto" clase="correcta"><ol>{r.correcto.map((p) => <li key={p}>{p}</li>)}</ol></Bloque>}
        </div>
      )
    }
    case 'nodos':
      return (
        <Bloque titulo="Tu respuesta" clase={r.acierto ? 'bien' : 'mal'}>
          {r.marcados.length === 0
            ? <p>No marcaste ningún equipo.</p>
            : <ul className="elementos-revision en-linea">{r.marcados.map((m) => <li key={m.id} className={m.bien ? 'bien' : 'mal'}><Marca bien={m.bien} /> {m.id}{!m.bien && <small> (sobraba)</small>}</li>)}</ul>}
          {r.faltan.length > 0 && <p className="correccion-elemento">Te faltó marcar: {r.faltan.join(', ')}.</p>}
        </Bloque>
      )
  }
}

/** Dibujo del ejercicio, cuando la pregunta no se entiende sin él (topologías, redes). */
function DibujoPregunta({ item, r }: { item: Item; r: Revision }) {
  const v = item.vista
  if (v.motor === 'test' && v.visual) return <DibujoVisual visual={v.visual} />
  if (v.motor === 'nodos' && r.motor === 'nodos') {
    const red = construirRed(v.escenario)
    return <DibujoRed red={red} estado={{
      origen: v.origen ?? v.desde, destino: v.destino, averiados: averiados(red, v.averia),
      conectados: new Set(r.marcados.filter((m) => m.bien).map((m) => m.id)),
      aislados: new Set(r.marcados.filter((m) => !m.bien).map((m) => m.id)),
    }} />
  }
  return null
}

/**
 * Una pregunta revisada. `respondida` es falso cuando el examen terminó por tiempo antes de llegar a ella.
 * Para clasificar y emparejar, cada fallo ya dice dónde iba, así que no se repite la solución entera debajo.
 */
export function RevisionRespuesta({ item, respuesta, respondida = true }: { item: Item; respuesta?: unknown; respondida?: boolean }) {
  const r = revisar(item.vista, respuesta)
  const v = item.vista
  const solucionEnLinea = respondida && (r.motor === 'clasificar' || r.motor === 'emparejar' || r.motor === 'ordenar')
  return (
    <>
      <p className="pregunta-revision"><TextoLinea texto={v.motor === 'vf' ? v.afirmacion : v.enunciado} /></p>
      <DibujoPregunta item={item} r={r} />
      {respondida
        ? <TuRespuesta r={r} />
        : <Bloque titulo="Tu respuesta" clase="mal"><p>Sin responder: se acabó el tiempo antes de llegar a esta pregunta.</p></Bloque>}
      {!r.acierto && !solucionEnLinea && <Bloque titulo="Respuesta correcta" clase="correcta"><RespuestaCorrecta item={item} /></Bloque>}
      <Bloque titulo={r.acierto ? 'Explicación' : 'Por qué'} clase="explicacion-revision"><TextoRico texto={item.explicacion} /></Bloque>
    </>
  )
}
