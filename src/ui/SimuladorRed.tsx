// Simulador libre para "Descubrir": enviar tramas o provocar averías y ver qué pasa.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Escenario } from '../motor/simred'
import { alcanzables, construirRed, enviar, type Averia, type TablaMac } from '../motor/simred'
import { DibujoRed, type EstadoDibujoRed } from './Visuales'

export function SimuladorRed({ escenario, modo, onUsado }: { escenario: Escenario; modo: 'enviar' | 'averia'; onUsado: () => void }) {
  const red = useMemo(() => construirRed(escenario), [escenario])
  const [origen, setOrigen] = useState<string>()
  const [estado, setEstado] = useState<EstadoDibujoRed>({})
  const [tabla, setTabla] = useState<TablaMac>({})
  const [mensaje, setMensaje] = useState(modo === 'enviar' ? 'Pulsa el equipo que envía.' : 'Pulsa un cable o un equipo para averiarlo.')
  const temporizadores = useRef<number[]>([])
  const esSwitch = escenario.topologia === 'estrella' && (escenario.centro ?? 'switch') === 'switch'

  const limpiar = () => {
    temporizadores.current.forEach((t) => window.clearTimeout(t))
    temporizadores.current = []
  }

  useEffect(() => () => {
    temporizadores.current.forEach((t) => window.clearTimeout(t))
  }, [])

  const pulsarNodoEnviar = (id: string) => {
    if (!red.pcs.includes(id)) return
    if (!origen || estado.llegan) {
      limpiar()
      setOrigen(id)
      setEstado({ origen: id })
      setMensaje(`${id} enviará. Ahora pulsa el equipo de destino.`)
      return
    }
    if (id === origen) return
    const r = enviar(red, origen, id, tabla)
    const llegan = new Set<string>()
    setEstado({ origen, destino: id, llegan: new Set(), acepta: id })
    r.recorrido.forEach((pc, i) => {
      temporizadores.current.push(window.setTimeout(() => {
        llegan.add(pc)
        setEstado({ origen, destino: id, llegan: new Set(llegan), acepta: id })
      }, 350 * (i + 1)))
    })
    let texto: string
    if (escenario.topologia === 'anillo') texto = `El mensaje pasa por ${r.recorrido.join(' → ')}. Cada equipo lo examina y, si no es suyo, lo reenvía.`
    else if (esSwitch) texto = r.inundado
      ? `El switch no conocía a ${id}: inunda por todos los puertos. Apunta que ${origen} está en su puerto.`
      : `El switch ya conocía a ${id}: la trama va solo a su puerto.`
    else texto = `La señal llega a ${r.lesLlega.length} equipos. Solo ${id} la acepta; los demás la descartan.`
    setMensaje(texto)
    if (r.tablaDespues) setTabla(r.tablaDespues)
    setOrigen(undefined)
    onUsado()
  }

  const averiar = (a: Averia, marca: string) => {
    const desde = red.pcs.find((p) => !(a.tipo === 'cable-pc' && a.pc === p) && !(a.tipo === 'nodo-anillo' && a.pc === p))!
    const ok = new Set(alcanzables(red, a, desde))
    const conectados = new Set([desde, ...ok])
    const aislados = new Set(red.pcs.filter((p) => !conectados.has(p)))
    if (ok.size === 0) {
      aislados.add(desde)
      conectados.delete(desde)
    }
    setEstado({ averiados: new Set([marca]), conectados, aislados })
    setMensaje(ok.size === 0
      ? 'Resultado: ningún equipo puede comunicarse con otro. Cae toda la red.'
      : `Resultado: ${desde} sigue hablando con ${[...ok].join(', ')}. En rojo, los equipos que quedan sin comunicación con ${desde}.`)
    onUsado()
  }

  const pulsarNodoAveria = (id: string) => {
    const t = escenario.topologia
    if (t === 'estrella' && id === 'C') return averiar({ tipo: 'centro' }, id)
    if (t === 'anillo' && red.pcs.includes(id)) return averiar({ tipo: 'nodo-anillo', pc: id }, id)
    if (t === 'arbol' && (id === 'R' || id === 'S1' || id === 'S2')) return averiar({ tipo: 'switch', sw: id }, id)
    setMensaje('Aquí prueba a pulsar un cable o el equipo central.')
  }
  const pulsarEnlace = (id: string) => {
    const e = red.enlaces.find((x) => x.id === id)!
    const t = escenario.topologia
    if (t === 'bus') return averiar({ tipo: 'troncal', tramo: id }, id)
    const pc = [e.a, e.b].find((n) => red.pcs.includes(n))
    if ((t === 'estrella' || t === 'arbol') && pc) return averiar({ tipo: 'cable-pc', pc }, id)
    if (t === 'anillo') return setMensaje('En el anillo, prueba a averiar un equipo.')
    setMensaje('Prueba a averiar un switch.')
  }

  return (
    <div className="simulador">
      <DibujoRed red={red} estado={estado} onNodo={modo === 'enviar' ? pulsarNodoEnviar : pulsarNodoAveria} onEnlace={modo === 'averia' ? pulsarEnlace : undefined} />
      <p className="sim-mensaje" aria-live="polite">{mensaje}</p>
      {esSwitch && modo === 'enviar' && (
        <div className="tabla-mac">
          <strong>Tabla MAC del switch</strong>
          {Object.keys(tabla).length === 0 ? <span> (vacía)</span> : Object.keys(tabla).sort().map((pc) => <span key={pc} className="chip">MAC de {pc} → puerto de {pc}</span>)}
        </div>
      )}
      {modo === 'averia' && estado.averiados && (
        <button className="btn secundario" onClick={() => { setEstado({}); setMensaje('Red reparada. Prueba otra avería.') }}>Reparar</button>
      )}
    </div>
  )
}
