// Dibuja los textos del contenido con su formato ligero (v2): párrafos, listas, **negrita** y términos del
// glosario. Un término se puede tocar para ver qué significa sin salir de la lección; la definición se abre
// debajo del párrafo (o del elemento de lista) para no partir la frase.
import { Fragment, useContext, useId, useState, type ReactNode } from 'react'
import { bloques, trozos, type Trozo } from '../contenido/texto'
import { useTienda } from '../estado/tienda'
import { LeccionActual } from './leccionActual'

interface Abiertos { abiertos: string[]; alternar: (id: string) => void; base: string }

function Definicion({ id, base }: { id: string; base: string }) {
  const t = useTienda((s) => s.indice?.glosario.get(id))
  const actual = useContext(LeccionActual)
  const leccion = useTienda((s) => (t?.concepto && t.concepto !== actual ? s.indice?.concepto.get(t.concepto)?.concepto.nombre : undefined))
  if (!t) return null
  return (
    <span id={`${base}-${id}`} className="definicion-termino" role="note">
      <b>{t.termino}:</b> {t.definicion}
      {leccion && <small>Se explica en la lección «{leccion}».</small>}
    </span>
  )
}

function Trozos({ lista, ctx }: { lista: Trozo[]; ctx?: Abiertos }) {
  const glosario = useTienda((s) => s.indice?.glosario)
  return <>{lista.map((t, i) => {
    const dentro = t.tipo !== 'termino' || !glosario?.has(t.id) ? t.texto
      : ctx ? (
        <button type="button" className={`termino${ctx.abiertos.includes(t.id) ? ' abierto' : ''}`} aria-expanded={ctx.abiertos.includes(t.id)}
          aria-controls={`${ctx.base}-${t.id}`} title="Toca para ver qué significa" onClick={() => ctx.alternar(t.id)}>{t.texto}</button>
      ) : <span className="termino-plano">{t.texto}</span>
    const conCursiva = t.cursiva ? <em>{dentro}</em> : dentro
    return t.negrita ? <strong key={i}>{conCursiva}</strong> : <Fragment key={i}>{conCursiva}</Fragment>
  })}</>
}

/** Un párrafo o un elemento de lista con sus definiciones abiertas debajo. */
function ConDefiniciones({ lista, render }: { lista: Trozo[]; render: (contenido: ReactNode, definiciones: ReactNode) => ReactNode }) {
  const [abiertos, setAbiertos] = useState<string[]>([])
  const base = useId()
  const alternar = (id: string) => setAbiertos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  const definiciones = abiertos.length > 0 ? <>{abiertos.map((id) => <Definicion key={id} id={id} base={base} />)}</> : null
  return <>{render(<Trozos lista={lista} ctx={{ abiertos, alternar, base }} />, definiciones)}</>
}

/** Texto de varios párrafos o listas. `className` se aplica a cada párrafo. */
export function TextoRico({ texto, className }: { texto: string; className?: string }) {
  return <>{bloques(texto).map((b, i) => b.tipo === 'parrafo'
    ? <ConDefiniciones key={i} lista={b.trozos} render={(c, d) => <><p className={className}>{c}</p>{d && <div className="definiciones">{d}</div>}</>} />
    : <ul key={i} className={`lista-rica ${className ?? ''}`}>{b.elementos.map((e, k) => (
        <ConDefiniciones key={k} lista={e} render={(c, d) => <li>{c}{d && <div className="definiciones">{d}</div>}</li>} />
      ))}</ul>)}</>
}

/**
 * Texto de una sola línea dentro de otro elemento (enunciados, títulos, puntos de «Lo importante»).
 * Dentro de un botón los términos no pueden ser botones: se muestran resaltados pero sin abrirse.
 */
export function TextoLinea({ texto, enBoton = false }: { texto: string; enBoton?: boolean }) {
  const lista = trozos(texto.replace(/\n+/g, ' '))
  if (enBoton) return <Trozos lista={lista} />
  return <ConDefiniciones lista={lista} render={(c, d) => <>{c}{d && <span className="definiciones definiciones-linea">{d}</span>}</>} />
}
