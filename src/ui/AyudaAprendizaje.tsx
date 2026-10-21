import { useMemo, useState } from 'react'
import { ArrowRight, Lightbulb, BookOpen } from 'lucide-react'
import { guiaAyuda, pistaActividad } from '../contenido/ayudas'
import { lugarEnFuente } from '../contenido/texto'
import { corregir, type Item } from '../motor/items'
import { itemsDeConcepto } from '../motor/sesiones'
import { useTienda } from '../estado/tienda'
import { Motor } from './Motores'
import { TextoLinea, TextoRico } from './TextoRico'

/**
 * Ayuda en dos niveles. Sin guía específica, la pista propone un criterio de trabajo y el repaso
 * vuelve a mostrar su explicación. Nunca se enseña la corrección del propio ejercicio: daría la respuesta.
 * La recuperación no puntúa ni reprograma el recuerdo: acaba de verse el ejemplo.
 */
export function AyudaAprendizaje({ item, recuperar = false, alAyudar, alComprobar }: { item: Item; recuperar?: boolean; alAyudar?: (n: number) => void; alComprobar?: (item: Item, acierto: boolean) => void }) {
  const { indice, progreso, registrar } = useTienda()
  const [nivel, setNivel] = useState(0)
  const [practicando, setPracticando] = useState(false)
  const [resultado, setResultado] = useState<boolean>()
  const guia = useMemo(() => indice ? guiaAyuda(indice, item) : undefined, [indice, item])
  const variante = useMemo(() => {
    if (guia) return guia.variante
    if (!indice) return undefined
    return item.conceptos.flatMap((id) => itemsDeConcepto(indice, progreso, id))
      .find((c) => c.clave !== item.clave && !c.clave.startsWith('gen:'))
    // La variante se fija al abrir la ayuda, no cambia al registrar una respuesta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, guia, item])
  const ayudar = (n: number) => { setNivel(n); alAyudar?.(n) }
  if (!indice) return null
  const conceptos = item.conceptos.flatMap((id) => { const c = indice.concepto.get(id)?.concepto; return c ? [c] : [] })
  const fuenteVariante = variante && indice.unidades.find((u) => u.id === variante.unidadId)?.fuentes.find((f) => f.id === variante.fuente.doc)
  const varios = conceptos.length > 1
  const pistaLeccion = conceptos.map((c) => <div key={c.id} className="apoyo-concepto">
    {varios && <b>{c.nombre}</b>}
    {c.clave ? <ul className="lista-rica">{c.clave.map((k, n) => <li key={n}><TextoLinea texto={k} /></li>)}</ul> : c.objetivo && <p><TextoLinea texto={c.objetivo} /></p>}
  </div>)
  const repasoLeccion = conceptos.map((c) => <div key={c.id} className="apoyo-concepto">
    {varios && <b>{c.nombre}</b>}
    {c.descubrir.map((p, n) => p.tipo === 'idea' && <div key={n}>{p.titulo && <b className="titulo-idea"><TextoLinea texto={p.titulo} /></b>}<TextoRico texto={p.texto} /></div>)}
  </div>)
  return <section className={`apoyo-aprendizaje ${recuperar ? 'recuperacion' : ''}`} aria-label="Ayuda para comprender">
    <div className="apoyo-acciones">
      <button className="btn secundario" disabled={nivel >= 1} onClick={() => ayudar(1)}><Lightbulb size={16} /> {recuperar ? 'Repasar lo importante' : 'Dame una pista'}</button>
      <button className="btn texto" disabled={nivel >= 2} onClick={() => ayudar(2)}><BookOpen size={16} /> {recuperar ? 'Repasar la explicación' : 'Volver a la explicación'}</button>
    </div>
    {!recuperar && nivel === 0 && <small className="coste-ayuda">Si usas la ayuda, el acierto cuenta como «con ayuda»: no suma puntos ni XP.</small>}
    {nivel > 0 && <div className="apoyo-explicacion" role="status">
      <strong>{guia ? (nivel === 1 ? 'En qué fijarte' : 'Un ejemplo antes de seguir') : nivel === 1 ? (recuperar ? 'Recuerda lo importante de la lección' : 'En qué fijarte') : 'Repasa la explicación de la lección'}</strong>
      {guia ? <TextoRico texto={nivel === 1 ? guia.pista : guia.ejemplo} /> : nivel === 1 ? (recuperar ? pistaLeccion : <TextoRico texto={pistaActividad(item)} />) : repasoLeccion}
      <small>Apoyo basado en el tema de esta actividad. Los aciertos con ayuda se registran aparte.</small>
      {recuperar && !practicando && variante && <button className="btn principal" onClick={() => { ayudar(2); setPracticando(true) }}>Probar otra situación <ArrowRight size={16} /></button>}
      {recuperar && !variante && <p>Puedes volver a la explicación desde los apuntes y dejar esta comprobación pendiente.</p>}
    </div>}
    {practicando && variante && <div className="apoyo-variante">
      <span className="sobretitulo">Otra situación · sin puntos</span>
      <Motor vista={variante.vista} bloqueado={resultado !== undefined} mostrarSolucion onResponder={(r) => {
        const acierto = corregir(variante.vista, r)
        setResultado(acierto)
        alComprobar?.(variante, acierto)
        registrar({ tipo: 'recuperacion', unidadId: variante.unidadId, conceptos: variante.conceptos,
          actividad: variante.clave, acierto, ayudas: 2, detalle: variante.vista.motor === 'vf' ? variante.vista.afirmacion : variante.vista.enunciado })
      }} />
      {resultado !== undefined && <div className={`apoyo-resultado ${resultado ? 'bien' : 'pendiente'}`} role="status">
        <strong>{resultado ? 'Lo has aplicado con ayuda' : 'Lo dejamos pendiente para repasarlo'}</strong>
        <TextoRico texto={variante.explicacion} /><small>Fuente del apoyo: {fuenteVariante?.titulo ?? variante.fuente.doc}{lugarEnFuente(fuenteVariante, variante.fuente.pag)}. Esta práctica no demuestra todavía recuerdo sin ayuda.</small>
      </div>}
    </div>}
  </section>
}
