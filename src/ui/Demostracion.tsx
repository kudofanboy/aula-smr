import { ArrowRight, BookOpenCheck, ShieldCheck } from 'lucide-react'
import { useTienda } from '../estado/tienda'
import { MODO_PROFESOR } from '../estado/almacen'
import { construirLeccion } from '../motor/sesiones'
import { Marco } from './comun'
import './demostracion.css'

export function Demostracion() {
  const { indice, progreso, ir, avisar } = useTienda()
  const unidad = indice?.unidades.find((u) => u.modulo === 'REDES') ?? indice?.unidades[0]
  const concepto = unidad?.conceptos[0]
  const empezar = () => {
    if (!indice || !concepto) return
    const sesion = construirLeccion(indice, progreso, concepto.id)
    if ('error' in sesion) avisar(sesion.error)
    else ir({ id: 'sesion', sesion, unidadId: unidad?.id })
  }
  return <Marco activa="demostracion"><div className="pagina demo-docente">
    <header className="demo-portada"><div className="demo-intro">
      <span className="sobretitulo">Aula SMR · Public demo</span>
      <h1>Explorar, practicar y repasar</h1>
      <p className="demo-lema">Esta edición pública incluye un motor de estudio y actividades de ejemplo originales. El curso, los contactos y la agenda son ficticios.</p>
      <p className="demo-nota"><ShieldCheck size={17} aria-hidden />{MODO_PROFESOR ? 'Perfil de demostración: no guarda actividad.' : 'El progreso se guarda solo en este navegador.'}</p>
      <div className="demo-acciones"><button className="btn principal grande" disabled={!concepto} onClick={empezar}>Probar una lección <ArrowRight size={18} /></button>
        {!MODO_PROFESOR && <a className="btn secundario" href="?profesor&recorrido=1" target="_blank" rel="noopener noreferrer">Abrir perfil ficticio</a>}
      </div>
    </div></header>
    <section className="panel"><BookOpenCheck size={24} aria-hidden /><h2>Contenido incluido</h2>
      <p>Las lecciones explican antes de preguntar. Los ejercicios muestran una corrección razonada. Esta muestra no pretende cubrir un programa oficial completo.</p>
      <div className="demo-cobertura">{indice?.unidades.map((u) => <article key={u.id}><h3>{u.modulo} · {u.titulo}</h3><p>{u.conceptos.length} conceptos de ejemplo</p><p>{u.fuentes.map((f) => f.titulo).join(' · ')}</p></article>)}</div>
    </section>
    <section className="panel"><h2>Privacidad y contribuciones</h2><p>La demostración no envía progreso a un servidor. No publiques información personal al comunicar un fallo. Para ampliar el curso, aporta material original o con licencia compatible y documenta su procedencia.</p></section>
  </div></Marco>
}
