// Buscador (Ctrl+K o /): salta a la lección, asignatura o caso práctico que se escriba.
import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, BriefcaseBusiness, GraduationCap, Lock, Search, X } from 'lucide-react'
import { useTienda } from '../estado/tienda'
import { catalogoEncargos, encargoVisible } from '../motor/encargos'

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Resultado { id: string; titulo: string; detalle: string; tipo: 'leccion' | 'asignatura' | 'caso'; bloqueado?: boolean; abrir: () => void }

export function Buscador() {
  const buscando = useTienda((s) => s.buscando)
  return buscando ? <PanelBuscador /> : null
}

function PanelBuscador() {
  const { buscar, indice, curso, progreso, ir, abrirCaso } = useTienda()
  const [q, setQ] = useState('')
  const [activo, setActivo] = useState(0)
  const entrada = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => entrada.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [])

  const resultados = useMemo<Resultado[]>(() => {
    if (!indice || !curso) return []
    const consulta = normalizar(q.trim())
    if (consulta.length < 2) return []
    const cierra = (f: () => void) => () => { buscar(false); f() }
    const res: Resultado[] = []
    for (const m of curso.modulos)
      if (normalizar(`${m.nombre} ${m.corto ?? ''}`).includes(consulta) && indice.unidades.some((u) => u.modulo === m.id))
        res.push({ id: `m-${m.id}`, titulo: m.nombre, detalle: 'Asignatura', tipo: 'asignatura', abrir: cierra(() => ir({ id: 'departamento', moduloId: m.id })) })
    for (const { encargo, unidad } of catalogoEncargos(indice.unidades))
      if (encargoVisible(encargo, progreso) && normalizar(`${encargo.asunto} ${encargo.mensaje}`).includes(consulta))
        res.push({ id: `e-${encargo.id}`, titulo: encargo.asunto, detalle: `Caso práctico · ${unidad.codigo}`, tipo: 'caso', abrir: cierra(() => abrirCaso(encargo.id)) })
    for (const [id, { concepto, unidad }] of indice.concepto) {
      if (!normalizar(`${concepto.nombre} ${unidad.titulo}`).includes(consulta)) continue
      const visto = Boolean(progreso.conceptos[id]?.descubierto)
      res.push({
        id: `c-${id}`, titulo: concepto.nombre, detalle: `${visto ? 'Apuntes' : 'Aún no aprendida'} · ${unidad.codigo} · ${unidad.titulo}`, tipo: 'leccion', bloqueado: !visto,
        abrir: cierra(() => ir(visto ? { id: 'apuntes', conceptoId: id } : { id: 'departamento', moduloId: unidad.modulo, unidadId: unidad.id })),
      })
    }
    return res.slice(0, 14)
  }, [q, indice, curso, progreso, buscar, ir, abrirCaso])

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') buscar(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(a + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') resultados[activo]?.abrir()
  }
  const Icono = { leccion: BookOpen, asignatura: GraduationCap, caso: BriefcaseBusiness }
  return (
    <div className="buscador-fondo" onClick={() => buscar(false)}>
      <div className="buscador" role="dialog" aria-modal="true" aria-label="Buscar" onClick={(e) => e.stopPropagation()}>
        <div className="buscador-campo">
          <Search size={20} aria-hidden />
          <input ref={entrada} value={q} onChange={(e) => { setQ(e.target.value); setActivo(0) }} onKeyDown={alTeclear} placeholder="Buscar una lección, asignatura o caso práctico…" aria-label="Buscar" />
          <button className="icono-btn" aria-label="Cerrar la búsqueda" onClick={() => buscar(false)}><X size={18} /></button>
        </div>
        {q.trim().length >= 2 && resultados.length === 0 && <p className="buscador-vacio">No hay resultados para «{q.trim()}».</p>}
        {q.trim().length < 2 && <p className="buscador-vacio">Escribe al menos dos letras. Atajo: Ctrl+K o la tecla /.</p>}
        <ul className="buscador-lista" role="listbox">
          {resultados.map((r, i) => {
            const I = Icono[r.tipo]
            return (
              <li key={r.id} role="option" aria-selected={i === activo}>
                <button className={i === activo ? 'activo' : ''} onClick={r.abrir} onMouseEnter={() => setActivo(i)}>
                  <I size={18} aria-hidden />
                  <span><b>{r.titulo}</b><small>{r.detalle}</small></span>
                  {r.bloqueado && <Lock size={14} aria-label="Aún no aprendida" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
