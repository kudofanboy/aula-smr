// Practicar: práctica libre (sin límite diario) y simulacro de examen de una asignatura.
import { useMemo, useState } from 'react'
import { Brain, ClipboardCheck, Play, Target, Timer } from 'lucide-react'
import { useTienda } from '../estado/tienda'
import { construirPractica, construirSimulacro, preparacion, type ModoPractica } from '../motor/practica'
import { Marco } from './comun'
import { colorModulo } from './utilidades'
import { CabeceraEscena } from './Escenario'
import { sonar } from './sonido'

const MODOS: { id: ModoPractica; titulo: string; texto: string; icono: typeof Brain }[] = [
  { id: 'aprendido', titulo: 'Todo lo aprendido', texto: 'Ejercicios variados de las lecciones que ya has hecho.', icono: Brain },
  { id: 'fallos', titulo: 'Mis fallos', texto: 'Lecciones con errores registrados, empezando por las que más cuestan.', icono: Target },
  { id: 'olvidado', titulo: 'Lo que más se olvida', texto: 'Las lecciones con menos recuerdo estimado.', icono: Timer },
]

const PREGUNTAS_SIMULACRO = 20

export function Practica({ moduloId }: { moduloId?: string }) {
  const { indice, curso, progreso, ir, avisar } = useTienda()
  const abiertos = (curso?.modulos ?? []).filter((m) => indice?.unidades.some((u) => u.modulo === m.id))
  const [modulo, setModulo] = useState(moduloId && abiertos.some((m) => m.id === moduloId) ? moduloId : abiertos[0]?.id ?? '')
  const [unidad, setUnidad] = useState('')
  const [modo, setModo] = useState<ModoPractica>('aprendido')
  const [n, setN] = useState(10)
  const practica = useMemo(() => indice ? construirPractica(indice, progreso, { moduloId: modulo, unidadId: unidad || undefined, modo, n }) : { error: 'Cargando las lecciones…' }, [indice, progreso, modulo, unidad, modo, n])
  const simulacro = useMemo(() => indice ? construirSimulacro(indice, progreso, modulo, PREGUNTAS_SIMULACRO) : { error: 'Cargando las lecciones…' }, [indice, progreso, modulo])
  if (!indice || !curso) return null
  const m = abiertos.find((x) => x.id === modulo)
  const unidades = indice.unidades.filter((u) => u.modulo === modulo)
  const prep = preparacion(indice, progreso, modulo)
  const historial = progreso.simulacros?.[modulo] ?? []
  const media = historial.length ? historial.slice(-5).reduce((s, x) => s + x.nota, 0) / Math.min(5, historial.length) : undefined

  const empezarPractica = () => {
    const s = practica
    if ('error' in s) return avisar(s.error)
    sonar('clic')
    ir({ id: 'sesion', sesion: s, unidadId: unidad || unidades[0]?.id })
  }
  const empezarSimulacro = () => {
    const s = simulacro
    if ('error' in s) return avisar(s.error)
    sonar('clic')
    ir({ id: 'sesion', sesion: s, unidadId: unidades[0]?.id })
  }

  return (
    <Marco activa={modulo || 'inicio'} estilo={colorModulo(m)}>
      <div className="pagina practica">
        <CabeceraEscena sala={modulo || 'oficina'} tono={m?.tono} titulo="Practicar" descripcion="Sin límite diario y solo con lo que ya has aprendido." />
        {abiertos.length === 0 ? (
          <section className="panel"><h2>Aún no hay contenido</h2><p>En cuanto haya lecciones publicadas podrás practicar aquí.</p></section>
        ) : (
          <>
            <div className="chips-fila" role="radiogroup" aria-label="Asignatura">
              {abiertos.map((x) => (
                <button key={x.id} role="radio" aria-checked={x.id === modulo} className={`chip-opcion ${x.id === modulo ? 'activa' : ''}`} style={colorModulo(x)}
                  onClick={() => { setModulo(x.id); setUnidad('') }}>{x.corto ?? x.nombre}</button>
              ))}
            </div>
            <div className="rejilla-practica">
              <section className="panel">
                <h2><Play size={20} /> Práctica libre</h2>
                <label className="campo-fila">
                  <span>Unidad</span>
                  <select value={unidad} onChange={(e) => setUnidad(e.target.value)}>
                    <option value="">Toda la asignatura</option>
                    {unidades.map((u) => <option key={u.id} value={u.id}>{u.codigo} · {u.titulo}</option>)}
                  </select>
                </label>
                <div className="modos" role="radiogroup" aria-label="Qué practicar">
                  {MODOS.map((o) => (
                    <button key={o.id} role="radio" aria-checked={modo === o.id} className={`modo ${modo === o.id ? 'activa' : ''}`} onClick={() => setModo(o.id)}>
                      <o.icono size={20} /><span><b>{o.titulo}</b><small>{o.texto}</small></span>
                    </button>
                  ))}
                </div>
                <div className="chips-fila" role="radiogroup" aria-label="Número de ejercicios">
                  {[5, 10, 20].map((x) => <button key={x} role="radio" aria-checked={n === x} className={`chip-opcion ${n === x ? 'activa' : ''}`} onClick={() => setN(x)}>{x} ejercicios</button>)}
                </div>
                <p className="ayuda" aria-live="polite">{'error' in practica ? practica.error : `Esta práctica tiene ${practica.pasos.length} ejercicios${practica.pasos.length < n ? ': son los disponibles con lo aprendido' : ''}.`}</p>
                <button className="btn principal grande" disabled={'error' in practica} onClick={empezarPractica}>Empezar la práctica</button>
              </section>

              <section className="panel">
                <h2><ClipboardCheck size={20} /> Simulacro de examen</h2>
                <p>Hasta {PREGUNTAS_SIMULACRO} preguntas de las lecciones aprendidas, con tiempo y nota sobre 10. Usa las preguntas oficiales cuando las hay.</p>
                <ul className="datos-simulacro">
                  {!('error' in simulacro) && <li>Este simulacro: <b>{simulacro.pasos.length} preguntas · {Math.ceil((simulacro.tiempo ?? 0) / 60)} min</b></li>}
                  <li><b>{prep.aprendidos}</b> de {prep.total} lecciones aprendidas</li>
                  <li>Preparación estimada: <b>{Math.round(prep.preparado * 100)} %</b></li>
                  {media !== undefined && <li>Tu nota media (últimos {Math.min(5, historial.length)}): <b>{media.toFixed(1)}</b> / 10</li>}
                </ul>
                <button className="btn principal grande" disabled={'error' in simulacro} onClick={empezarSimulacro}>Empezar el simulacro</button>
                {'error' in simulacro && <small className="ayuda">{simulacro.error}</small>}
              </section>
            </div>
          </>
        )}
      </div>
    </Marco>
  )
}
