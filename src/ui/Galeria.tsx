// Página de revisión (http://127.0.0.1:4417/?galeria): todos los dibujos, para comprobarlos a simple vista.
import { useState } from 'react'
import type { Visual } from '../contenido/esquema'
import { DibujoVisual } from './Visuales'

const DIBUJOS: Visual[] = [
  { tipo: 'vonneumann' }, { tipo: 'capas-so' }, { tipo: 'disco' }, { tipo: 'estados-proceso' }, { tipo: 'alcance-redes' }, { tipo: 'nic' }, { tipo: 'nodos-red' },
  { tipo: 'topologia', escenario: { topologia: 'estrella', centro: 'switch', equipos: 5 } },
  { tipo: 'topologia', escenario: { topologia: 'bus', equipos: 5 } },
  { tipo: 'topologia', escenario: { topologia: 'anillo', equipos: 6 } },
  { tipo: 'topologia', escenario: { topologia: 'arbol', equipos: 5 } },
]

export function Galeria() {
  const [ultima, setUltima] = useState('')
  return (
    <div className="pantalla">
      <h2>Galería de dibujos</h2>
      <p className="ayuda">Última zona pulsada: {ultima || '—'}</p>
      {DIBUJOS.map((v, i) => (
        <section key={i} className="panel">
          <h3>{v.tipo}{v.tipo === 'topologia' ? ` · ${v.escenario.topologia}` : ''}</h3>
          <DibujoVisual visual={v} onZona={(z) => setUltima(`${v.tipo}: ${z}`)} zonasVistas={new Set()} />
        </section>
      ))}
    </div>
  )
}
