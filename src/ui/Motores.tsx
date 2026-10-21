// Componentes de cada tipo de ejercicio. Todos reciben la vista, si ya se ha respondido y una función para responder.
// Todo lo que se arrastra también se puede hacer con clics.
import { useEffect, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import type { Vista } from '../motor/items'
import { averiados, construirRed } from '../motor/simred'
import { DibujoRed, DibujoVisual } from './Visuales'
import { TextoLinea } from './TextoRico'

export interface PropsMotor<V> {
  vista: V
  /** Respuesta ya enviada (se muestra la corrección). */
  bloqueado: boolean
  /** Mostrar qué era lo correcto (en exámenes no se muestra hasta el final). */
  mostrarSolucion: boolean
  /** Elegir no responde: hace falta pulsar «Responder» (exámenes, donde no se corrige al momento). */
  confirmar?: boolean
  onResponder: (respuesta: unknown) => void
}

type V<M extends Vista['motor']> = Extract<Vista, { motor: M }>

/** Atajos de teclado para responder (se ignoran mientras se escribe en un campo de texto). */
function useTeclas(activo: boolean, alPulsar: (tecla: string) => void) {
  useEffect(() => {
    if (!activo) return
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.ctrlKey || e.altKey || e.metaKey || t.closest('input, textarea')) return
      alPulsar(e.key.toLowerCase())
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  })
}

export function MotorTest({ vista, bloqueado, mostrarSolucion, confirmar = false, onResponder }: PropsMotor<V<'test'>>) {
  const [elegida, setElegida] = useState<number>()
  const elegir = (i: number) => { setElegida(i); if (!confirmar) onResponder(i) }
  useTeclas(!bloqueado, (k) => {
    if (k === 'enter' && confirmar && elegida !== undefined) return onResponder(elegida)
    const i = /^[1-9]$/.test(k) ? Number(k) - 1 : k.length === 1 ? k.charCodeAt(0) - 97 : -1
    if (i >= 0 && i < vista.opciones.length) elegir(i)
  })
  return (
    <div className="motor-test">
      <p className="enunciado"><TextoLinea texto={vista.enunciado} /></p>
      {vista.visual && <DibujoVisual visual={vista.visual} />}
      {!bloqueado && confirmar && <p className="ayuda">Elige una opción y pulsa «Responder». Hasta entonces puedes cambiarla.</p>}
      {!bloqueado && <p className="ayuda atajo">{confirmar ? 'También puedes elegir' : 'Pulsa una opción o usa'} las teclas <kbd>A</kbd>–<kbd>{String.fromCharCode(64 + vista.opciones.length)}</kbd>{confirmar && <> y responder con <kbd>Intro</kbd></>}.</p>}
      <div className="opciones">
        {vista.opciones.map((o, i) => {
          let clase = 'opcion'
          if (!bloqueado && confirmar && elegida === i) clase += ' elegida'
          if (bloqueado && mostrarSolucion && i === vista.correcta) clase += ' correcta'
          if (bloqueado && elegida === i && (i !== vista.correcta || !mostrarSolucion)) clase += mostrarSolucion ? ' incorrecta' : ' elegida'
          return (
            <button key={i} className={clase} disabled={bloqueado} onClick={() => elegir(i)}>
              <span className="letra" aria-hidden>{String.fromCharCode(65 + i)}</span>
              <span className="opcion-texto">{o}</span>
              {bloqueado && mostrarSolucion && elegida === i && i !== vista.correcta && vista.por_opcion?.[i] && <small className="por-que"><TextoLinea texto={vista.por_opcion[i]} enBoton /></small>}
            </button>
          )
        })}
      </div>
      {!bloqueado && confirmar && <button className="btn principal" disabled={elegida === undefined} onClick={() => elegida !== undefined && onResponder(elegida)}>Responder</button>}
    </div>
  )
}

export function MotorVF({ vista, bloqueado, mostrarSolucion, confirmar = false, onResponder }: PropsMotor<V<'vf'>>) {
  const [elegida, setElegida] = useState<boolean>()
  const elegir = (v: boolean) => { setElegida(v); if (!confirmar) onResponder(v) }
  useTeclas(!bloqueado, (k) => {
    if (k === 'v') elegir(true)
    if (k === 'f') elegir(false)
    if (k === 'enter' && confirmar && elegida !== undefined) onResponder(elegida)
  })
  const clase = (v: boolean) => {
    if (!bloqueado) return `opcion grande ${confirmar && elegida === v ? 'elegida' : ''}`
    if (!mostrarSolucion) return `opcion grande ${elegida === v ? 'elegida' : ''}`
    if (v === vista.verdadero) return 'opcion grande correcta'
    return `opcion grande ${elegida === v ? 'incorrecta' : ''}`
  }
  return (
    <div className="motor-vf">
      <p className="enunciado">¿Verdadero o falso?</p>
      <blockquote className="afirmacion"><TextoLinea texto={vista.afirmacion} /></blockquote>
      <div className="opciones fila">
        <button className={clase(true)} disabled={bloqueado} onClick={() => elegir(true)}><Check size={22} /> Verdadero <kbd>V</kbd></button>
        <button className={clase(false)} disabled={bloqueado} onClick={() => elegir(false)}><X size={22} /> Falso <kbd>F</kbd></button>
      </div>
      {!bloqueado && confirmar && <button className="btn principal" disabled={elegida === undefined} onClick={() => elegida !== undefined && onResponder(elegida)}>Responder</button>}
    </div>
  )
}

function Ficha({ id, texto, seleccionada, estado, onClick, desactivada }: { id: string; texto: string; seleccionada: boolean; estado?: 'bien' | 'mal'; onClick: () => void; desactivada: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: desactivada })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 } : undefined
  return (
    <button ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick} disabled={desactivada && !estado}
      className={`ficha ${seleccionada ? 'seleccionada' : ''} ${isDragging ? 'arrastrando' : ''} ${estado ?? ''}`}>
      {texto}
    </button>
  )
}

function Cesta({ id, nombre, children, onClick }: { id: string; nombre: string; children: React.ReactNode; onClick: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`cesta ${isOver ? 'encima' : ''}`} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="cesta-titulo">{nombre}</div>
      <div className="cesta-contenido">{children}</div>
    </div>
  )
}

export function MotorClasificar({ vista, bloqueado, mostrarSolucion, onResponder }: PropsMotor<V<'clasificar'>>) {
  const [asignado, setAsignado] = useState<Record<number, string>>({})
  const [sel, setSel] = useState<number>()
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const colocar = (i: number, cat: string) => {
    if (bloqueado) return
    setAsignado((a) => ({ ...a, [i]: cat }))
    setSel(undefined)
  }
  const alSoltar = (e: DragEndEvent) => {
    if (e.over) colocar(Number(String(e.active.id).slice(1)), String(e.over.id))
  }
  const sinColocar = vista.elementos.map((_, i) => i).filter((i) => asignado[i] === undefined)
  const estadoDe = (i: number) => (bloqueado && mostrarSolucion ? (asignado[i] === vista.elementos[i].categoria ? 'bien' : 'mal') : undefined)
  return (
    <div className="motor-clasificar">
      <p className="enunciado"><TextoLinea texto={vista.enunciado} /></p>
      <p className="ayuda">Arrastra cada ficha a su caja, o pulsa la ficha y después la caja.</p>
      <DndContext sensors={sensores} onDragEnd={alSoltar}>
        {!bloqueado && <div className="bandeja">
          {sinColocar.map((i) => (
            <Ficha key={i} id={`e${i}`} texto={vista.elementos[i].texto} seleccionada={sel === i} onClick={() => setSel(i)} desactivada={bloqueado} />
          ))}
          {sinColocar.length === 0 && <span className="ayuda">Todo colocado. Revisa y pulsa Comprobar.</span>}
        </div>}
        <div className="cestas">
          {vista.categorias.map((c) => (
            <Cesta key={c.id} id={c.id} nombre={c.nombre} onClick={() => sel !== undefined && colocar(sel, c.id)}>
              {vista.elementos.map((el, i) => asignado[i] === c.id && (
                <Ficha key={i} id={`e${i}`} texto={el.texto} seleccionada={sel === i} estado={estadoDe(i)}
                  onClick={() => !bloqueado && setSel(i)} desactivada={bloqueado} />
              ))}
            </Cesta>
          ))}
        </div>
      </DndContext>
      {bloqueado && mostrarSolucion && vista.elementos.some((el, i) => asignado[i] !== el.categoria) && (
        <div className="solucion">
          <strong>Colocación correcta:</strong>
          {vista.categorias.map((c) => (
            <div key={c.id}><em>{c.nombre}:</em> {vista.elementos.filter((el) => el.categoria === c.id).map((el) => el.texto).join(' · ')}</div>
          ))}
        </div>
      )}
      {!bloqueado && (
        <button className="btn principal" disabled={sinColocar.length > 0} onClick={() => onResponder(asignado)}>Comprobar</button>
      )}
    </div>
  )
}

export function MotorOrdenar({ vista, bloqueado, mostrarSolucion, onResponder }: PropsMotor<V<'ordenar'>>) {
  const [orden, setOrden] = useState(vista.inicial)
  const [sel, setSel] = useState<number>()
  const mover = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= orden.length) return
    const n = [...orden]
    ;[n[i], n[j]] = [n[j], n[i]]
    setOrden(n)
  }
  const pulsar = (i: number) => {
    if (bloqueado) return
    if (sel === undefined) return setSel(i)
    const n = [...orden]
    ;[n[sel], n[i]] = [n[i], n[sel]]
    setOrden(n)
    setSel(undefined)
  }
  return (
    <div className="motor-ordenar">
      <p className="enunciado"><TextoLinea texto={vista.enunciado} /></p>
      <p className="ayuda">Usa las flechas, o pulsa dos pasos para intercambiarlos.</p>
      <ol className="lista-orden">
        {orden.map((p, i) => {
          const estado = bloqueado && mostrarSolucion ? (p === vista.pasos[i] ? 'bien' : 'mal') : ''
          return (
            <li key={p} className={`paso-orden ${sel === i ? 'seleccionada' : ''} ${estado}`}>
              <span className="num">{i + 1}</span>
              <button className="texto-paso" onClick={() => pulsar(i)} disabled={bloqueado}>{p}</button>
              {!bloqueado && (
                <span className="flechas-orden">
                  <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">▲</button>
                  <button onClick={() => mover(i, 1)} disabled={i === orden.length - 1} aria-label="Bajar">▼</button>
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {bloqueado && mostrarSolucion && orden.some((p, i) => p !== vista.pasos[i]) && (
        <div className="solucion"><strong>Orden correcto:</strong><ol>{vista.pasos.map((p) => <li key={p}>{p}</li>)}</ol></div>
      )}
      {!bloqueado && <button className="btn principal" onClick={() => onResponder(orden)}>Comprobar</button>}
    </div>
  )
}

export function MotorEmparejar({ vista, bloqueado, mostrarSolucion, onResponder }: PropsMotor<V<'emparejar'>>) {
  const [pares, setPares] = useState<Record<string, string>>({})
  const [izq, setIzq] = useState<string>()
  const usadosDer = new Set(Object.values(pares))
  const elegirDer = (b: string) => {
    if (bloqueado || !izq) return
    const n = Object.fromEntries(Object.entries(pares).filter(([, v]) => v !== b))
    n[izq] = b
    setPares(n)
    setIzq(undefined)
  }
  const correctoDe = (a: string) => vista.pares.find((p) => p.a === a)!.b
  const indice = (b: string) => vista.derecha.indexOf(b) + 1
  return (
    <div className="motor-emparejar">
      <p className="enunciado"><TextoLinea texto={vista.enunciado} /></p>
      <p className="ayuda">Pulsa un elemento de la izquierda y después su pareja de la derecha.</p>
      <div className="columnas">
        <div className="col">
          {vista.pares.map(({ a }) => {
            const estado = bloqueado && mostrarSolucion ? (pares[a] === correctoDe(a) ? 'bien' : 'mal') : ''
            return (
              <button key={a} className={`ficha ancha ${izq === a ? 'seleccionada' : ''} ${pares[a] ? 'emparejada' : ''} ${estado}`} disabled={bloqueado} onClick={() => setIzq(a)}>
                {a} {pares[a] && <span className="pareja">→ {indice(pares[a])}</span>}
              </button>
            )
          })}
        </div>
        <div className="col">
          {vista.derecha.map((b, i) => (
            <button key={b} className={`ficha ancha ${usadosDer.has(b) ? 'emparejada' : ''}`} disabled={bloqueado} onClick={() => elegirDer(b)}>
              <span className="num">{i + 1}</span> {b}
            </button>
          ))}
        </div>
      </div>
      {bloqueado && mostrarSolucion && vista.pares.some((p) => pares[p.a] !== p.b) && (
        <div className="solucion"><strong>Parejas correctas:</strong>{vista.pares.map((p) => <div key={p.a}>{p.a} → {p.b}</div>)}</div>
      )}
      {!bloqueado && (
        <button className="btn principal" disabled={Object.keys(pares).length < vista.pares.length} onClick={() => onResponder(pares)}>Comprobar</button>
      )}
    </div>
  )
}

export function MotorNodos({ vista, bloqueado, mostrarSolucion, onResponder }: PropsMotor<V<'nodos'>>) {
  const red = useMemo(() => construirRed(vista.escenario), [vista.escenario])
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const alternar = (id: string) => {
    if (bloqueado || !vista.candidatos.includes(id)) return
    const n = new Set(marcados)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setMarcados(n)
  }
  const correctas = new Set(vista.correctas)
  return (
    <div className="motor-nodos">
      <p className="enunciado"><TextoLinea texto={vista.enunciado} /></p>
      {vista.tabla && (
        <div className="tabla-mac">
          <strong>Tabla MAC del switch antes del envío:</strong>
          {Object.keys(vista.tabla).length === 0 ? <span> (vacía)</span> : Object.keys(vista.tabla).sort().map((pc) => <span key={pc} className="chip">MAC de {pc} → puerto de {pc}</span>)}
        </div>
      )}
      <DibujoRed red={red} onNodo={alternar}
        estado={{
          origen: vista.origen ?? vista.desde,
          destino: vista.destino,
          marcados: bloqueado && mostrarSolucion ? undefined : marcados,
          averiados: averiados(red, vista.averia),
          conectados: bloqueado && mostrarSolucion ? new Set([...marcados].filter((m) => correctas.has(m))) : undefined,
          aislados: bloqueado && mostrarSolucion ? new Set([...marcados].filter((m) => !correctas.has(m))) : undefined,
        }} />
      {!bloqueado && (
        <div className="zonas-botones" role="group" aria-label="Equipos que puedes marcar">
          {[...vista.candidatos].sort().map((id) => (
            <button key={id} type="button" className={`chip-zona ${marcados.has(id) ? 'activa' : ''}`} aria-pressed={marcados.has(id)} onClick={() => alternar(id)}>
              {marcados.has(id) ? '✓ ' : ''}{id}
            </button>
          ))}
        </div>
      )}
      <p className="leyenda">
        <span className="ley emisor">■</span> {vista.averia ? 'Equipo desde el que se pregunta' : 'Emisor'}
        {vista.destino && <><span className="ley destino">■</span> Destino</>}
        {vista.averia && <><span className="ley averia">■</span> Averiado</>}
        <span className="ley marcado">■</span> Marcado por ti
      </p>
      {bloqueado && mostrarSolucion && (
        <p className="solucion">Respuesta correcta: {vista.correctas.length ? [...vista.correctas].sort().join(', ') : 'ninguno'}.
          {' '}En verde lo que marcaste bien; en rojo, lo que sobraba.</p>
      )}
      {!bloqueado && (
        <div className="fila-botones">
          <span className="ayuda">Marcados: {marcados.size ? [...marcados].sort().join(', ') : 'ninguno'}</span>
          <button className="btn principal" onClick={() => onResponder([...marcados])}>Comprobar</button>
        </div>
      )}
    </div>
  )
}

export function Motor(props: PropsMotor<Vista>) {
  const v = props.vista
  switch (v.motor) {
    case 'test':
      return <MotorTest {...props} vista={v} />
    case 'vf':
      return <MotorVF {...props} vista={v} />
    case 'clasificar':
      return <MotorClasificar {...props} vista={v} />
    case 'ordenar':
      return <MotorOrdenar {...props} vista={v} />
    case 'emparejar':
      return <MotorEmparejar {...props} vista={v} />
    case 'nodos':
      return <MotorNodos {...props} vista={v} />
  }
}
