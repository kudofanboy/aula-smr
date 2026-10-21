// Fase "Descubrir": explicar, comprobar, explorar y simular, con poco texto.
import { useEffect, useMemo, useState } from 'react'
import { barajar } from '../motor/azar'
import type { Concepto, Paso } from '../contenido/esquema'
import { pasosDeFormacion, type IdeaFormacion } from '../contenido/didactica'
import { useTienda } from '../estado/tienda'
import { SimuladorRed } from './SimuladorRed'
import { DibujoVisual } from './Visuales'
import { sonar } from './sonido'
import { ArrowRight, BookOpen, FlaskConical, HelpCircle, Info, ListChecks, MousePointerClick, Sparkles, Target, Wrench } from 'lucide-react'
import { EtiquetaModulo } from './comun'
import { TextoLinea, TextoRico } from './TextoRico'
import { LeccionActual } from './leccionActual'

function PasoIdea({ paso }: { paso: IdeaFormacion }) {
  return (
    <div className="paso-idea">
      {paso.titulo && <h3 className="titulo-idea"><TextoLinea texto={paso.titulo} /></h3>}
      {paso.visual && <DibujoVisual visual={paso.visual} />}
      {paso.explicacionPrevia && paso.explicacionPrevia !== paso.texto && <TextoRico texto={paso.explicacionPrevia} className="texto-idea" />}
      <TextoRico texto={paso.texto} className="texto-idea" />
    </div>
  )
}

type PasoConOpciones = Extract<Paso, { tipo: 'prediccion' | 'pregunta' }>

/**
 * «¿Qué crees?» (prediccion, antes de explicar: fallar no resta) o «Comprueba» (pregunta, después de explicar).
 * En las unidades sin migrar, la predicción se presenta como comprobación porque su respuesta ya se ha mostrado.
 */
function PasoPrediccion({ paso, formato, onListo }: { paso: PasoConOpciones; formato: 1 | 2; onListo: () => void }) {
  const [elegida, setElegida] = useState<number>()
  // El orden se baraja una vez por paso (la respuesta correcta no puede ser siempre la primera).
  const orden = useMemo(() => barajar(paso.opciones.map((_, i) => i)), [paso])
  const elegir = (i: number) => {
    if (elegida !== undefined) return
    setElegida(i)
    sonar(i === paso.correcta ? 'bien' : 'suave')
    onListo()
  }
  const adivinar = paso.tipo === 'prediccion' && formato === 2
  const acierto = elegida === paso.correcta
  const porQue = paso.tipo === 'pregunta' && elegida !== undefined && !acierto ? paso.por_opcion?.[elegida] : undefined
  const titulo = adivinar
    ? (acierto ? '¡Bien pensado!' : 'No pasa nada: era para pensarlo antes de explicarlo.')
    : formato === 2 ? (acierto ? '¡Correcto!' : 'Vamos a ver por qué.') : (acierto ? '¡Bien visto!' : 'Vamos a repasarlo. Aquí puedes equivocarte sin perder puntos.')
  return (
    <div className="paso-prediccion">
      {adivinar
        ? <span className="etiqueta-paso"><HelpCircle size={15} /> ¿Qué crees? · fallar aquí no resta</span>
        : <span className="etiqueta-paso"><Sparkles size={15} /> {formato === 2 ? 'Comprueba' : 'Comprueba lo que has entendido'}</span>}
      <p className="enunciado"><TextoLinea texto={paso.pregunta} /></p>
      {paso.visual && <DibujoVisual visual={paso.visual} />}
      <div className="opciones">
        {orden.map((i) => {
          let clase = 'opcion'
          if (elegida !== undefined && i === paso.correcta) clase += ' correcta'
          if (elegida === i && i !== paso.correcta) clase += ' incorrecta'
          return <button key={i} className={clase} disabled={elegida !== undefined} onClick={() => elegir(i)}><TextoLinea texto={paso.opciones[i]} enBoton /></button>
        })}
      </div>
      {elegida !== undefined && (
        <div className={`revelacion ${acierto ? 'bien' : ''}`}>
          <strong>{titulo}</strong>
          {porQue && <p className="por-que-opcion"><TextoLinea texto={porQue} /></p>}
          <TextoRico texto={paso.revelacion} />
        </div>
      )}
    </div>
  )
}

function PasoExplorar({ paso, onListo }: { paso: Extract<Paso, { tipo: 'explorar' }>; onListo: () => void }) {
  const [vistas, setVistas] = useState<Set<string>>(new Set())
  const [activa, setActiva] = useState<string>()
  const pulsar = (id: string) => {
    const z = paso.zonas.find((x) => x.id === id)
    if (!z) return
    setActiva(id)
    const n = new Set(vistas).add(id)
    setVistas(n)
    sonar('clic')
    if (paso.zonas.every((x) => n.has(x.id))) onListo()
  }
  const z = paso.zonas.find((x) => x.id === activa)
  return (
    <div className="paso-explorar">
      <span className="etiqueta-paso"><MousePointerClick size={15} /> Explora</span>
      <p className="enunciado"><TextoLinea texto={paso.instruccion} /> <span className="contador">({vistas.size}/{paso.zonas.length})</span></p>
      <DibujoVisual visual={paso.visual} onZona={pulsar} zonasVistas={vistas} zonaActiva={activa} />
      <div className="zonas-botones" role="group" aria-label="Partes del dibujo">
        {paso.zonas.map((zona) => (
          <button key={zona.id} type="button" className={`chip-zona ${vistas.has(zona.id) ? 'vista' : ''} ${activa === zona.id ? 'activa' : ''}`} aria-pressed={activa === zona.id} onClick={() => pulsar(zona.id)}>
            {vistas.has(zona.id) && '✓ '}{zona.titulo}
          </button>
        ))}
      </div>
      <div className="info-zona" aria-live="polite">
        {z ? (<><strong>{z.titulo}</strong><TextoRico texto={z.texto} /></>) : <p className="ayuda">Pulsa las partes que parpadean del dibujo, o sus nombres debajo.</p>}
      </div>
    </div>
  )
}

function PasoSimulador({ paso, onListo }: { paso: Extract<Paso, { tipo: 'simulador-red' }>; onListo: () => void }) {
  const [usos, setUsos] = useState(0)
  // Se avisa a la lección desde un efecto, una sola vez: hacerlo dentro de setUsos actualizaba otro componente mientras se dibujaba.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (usos === 2) onListo() }, [usos])
  return (
    <div className="paso-simulador">
      <span className="etiqueta-paso"><FlaskConical size={15} /> Experimenta</span>
      <p className="enunciado"><TextoLinea texto={paso.instruccion} /> <span className="contador">({Math.min(usos, 2)}/2 pruebas)</span></p>
      <SimuladorRed escenario={paso.escenario} modo={paso.modo} onUsado={() => setUsos((u) => u + 1)} />
    </div>
  )
}

/** «Lo importante»: el resumen de la lección, que también aparece en los apuntes. */
export function LoImportante({ clave }: { clave: string[] }) {
  return (
    <section className="lo-importante" aria-label="Lo importante">
      <h3><ListChecks size={17} aria-hidden /> Lo importante</h3>
      <ul>{clave.map((k, i) => <li key={i}><TextoLinea texto={k} /></li>)}</ul>
    </section>
  )
}

export function Descubrir({ concepto, unidadId, nombreFuente, onFin }: { concepto: Concepto; unidadId: string; nombreFuente: string; onFin: () => void }) {
  const [i, setI] = useState(0)
  const [listos, setListos] = useState<Set<number>>(new Set())
  const formato = useTienda((s) => s.indice?.unidades.find((u) => u.id === unidadId)?.formato ?? 1)
  const pasos = pasosDeFormacion(concepto.descubrir, formato)
  const paso = pasos[i]
  const listo = paso.tipo === 'idea' || listos.has(i)
  const marcar = () => setListos((s) => new Set(s).add(i))
  const ultimo = i === pasos.length - 1
  return (
    <LeccionActual.Provider value={concepto.id}>
    <div className="descubrir">
      <div className="cabecera-descubrir">
        <div className="estado-leccion">
          <span className="chip-estado"><Sparkles size={14} aria-hidden /> Lección nueva</span>
          <EtiquetaModulo unidadId={unidadId} />
        </div>
        <h2>{concepto.nombre}</h2>
        <div className="puntos-paso" aria-label={`Paso ${i + 1} de ${pasos.length}`}>
          {pasos.map((_, k) => <span key={k} className={k < i ? 'hecho' : k === i ? 'actual' : ''} />)}
          <small>Paso {i + 1} de {pasos.length}</small>
        </div>
      </div>
      <div className="cuerpo-paso" key={i}>
        {i === 0 && concepto.objetivo && <p className="objetivo-leccion"><Target size={15} aria-hidden /> <b>Objetivo:</b> <TextoLinea texto={concepto.objetivo} /></p>}
        {paso.tipo === 'idea' && <PasoIdea paso={paso} />}
        {(paso.tipo === 'prediccion' || paso.tipo === 'pregunta') && <PasoPrediccion paso={paso} formato={formato} onListo={marcar} />}
        {paso.tipo === 'explorar' && <PasoExplorar paso={paso} onListo={marcar} />}
        {paso.tipo === 'simulador-red' && <PasoSimulador paso={paso} onListo={marcar} />}
      </div>
      {ultimo && concepto.nivel_verdad === 'simplificacion' && (
        <div className="aviso-simplificacion"><Info size={18} /> <span><strong>Modelo de demostración.</strong> Esta actividad simplifica la realidad y no define el contenido de un examen oficial.</span></div>
      )}
      {ultimo && concepto.clave && listo && <LoImportante clave={concepto.clave} />}
      {ultimo && concepto.matiz && (
        <div className="matiz">
          <div className="matiz-examen"><span className="matiz-titulo"><BookOpen size={16} /> Para el examen</span><TextoRico texto={concepto.matiz.examen} /></div>
          <div className="matiz-real"><span className="matiz-titulo"><Wrench size={16} /> En la práctica real</span><TextoRico texto={concepto.matiz.real} /></div>
        </div>
      )}
      <div className="pie-paso">
        <span className="fuente">Fuente: {nombreFuente}</span>
        {!listo && <span className="ayuda-paso" role="status">{paso.tipo === 'prediccion' || paso.tipo === 'pregunta' ? 'Elige una respuesta para seguir.' : paso.tipo === 'explorar' ? 'Pulsa todas las partes para seguir.' : 'Haz las pruebas para seguir.'}</span>}
        <button className="btn principal" disabled={!listo} onClick={() => (ultimo ? onFin() : setI(i + 1))}>
          {ultimo ? 'Ahora lo compruebo practicando' : 'Siguiente'} <ArrowRight size={17} />
        </button>
      </div>
    </div>
    </LeccionActual.Provider>
  )
}
