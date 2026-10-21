import { lazy, Suspense, useEffect, useState } from 'react'
import { useTienda } from './estado/tienda'
import { Agenda, Expediente, Resultado } from './ui/Pantallas'
import { Bienvenida, ElegirAvatar, Escritorio } from './ui/Escritorio'
import { Departamento } from './ui/Departamento'
import { Galeria } from './ui/Galeria'
import { Buscador } from './ui/Buscador'
import { MODO_PROFESOR } from './estado/almacen'
import { activarSonido } from './ui/sonido'
import { Logo } from './ui/comun'
import { animacionesActivas, iniciarBrillo } from './ui/efectos'
import { Intro } from './ui/Intro'
import { introPendiente } from './ui/introEstado'
import { BandejaEncargos, EncargoCliente } from './ui/Encargos'
import { ContactoProfesorado } from './ui/ContactoProfesorado'

// Pantallas pesadas: se descargan al usarlas, para que el primer arranque sea más ligero.
const Sesion = lazy(() => import('./ui/Sesion').then((m) => ({ default: m.Sesion })))
const Practica = lazy(() => import('./ui/Practica').then((m) => ({ default: m.Practica })))
const Apuntes = lazy(() => import('./ui/Apuntes').then((m) => ({ default: m.Apuntes })))
const Demostracion = lazy(() => import('./ui/Demostracion').then((m) => ({ default: m.Demostracion })))

function Dialogo() {
  const { dialogo, cerrarDialogo } = useTienda()
  if (!dialogo) return null
  return (
    <div className="modal-fondo" onClick={dialogo.bloqueante ? undefined : cerrarDialogo}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="modal-texto">{dialogo.texto}</p>
        <div className="fila-botones">
          {dialogo.alConfirmar ? (
            <>
              {!dialogo.bloqueante && <button className="btn secundario" onClick={cerrarDialogo}>Cancelar</button>}
              <button className="btn principal" autoFocus onClick={() => { cerrarDialogo(); dialogo.alConfirmar!() }}>{dialogo.siTexto ?? 'Aceptar'}</button>
            </>
          ) : (
            <button className="btn principal" autoFocus onClick={cerrarDialogo}>Entendido</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { cargado, errores, pantalla, cargar, progreso, buscar } = useTienda()
  const nuevo = cargado && !progreso.nombre
  const sinAvatar = cargado && Boolean(progreso.nombre) && !progreso.avatar && !MODO_PROFESOR
  const [intro, setIntro] = useState(introPendiente)
  const animaciones = progreso.ajustes.animaciones !== false
  useEffect(() => {
    document.documentElement.dataset.animaciones = animaciones ? 'si' : 'no'
  }, [animaciones])
  useEffect(() => iniciarBrillo(), [])
  useEffect(() => {
    document.documentElement.dataset.tam = progreso.ajustes.tamano === 'grande' ? 'grande' : 'normal'
  }, [progreso.ajustes.tamano])
  // Ctrl+K (o la tecla /) abre el buscador.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const escribiendo = (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); buscar(!useTienda.getState().buscando) }
      else if (e.key === '/' && !escribiendo && !e.ctrlKey && !e.metaKey) { e.preventDefault(); buscar(true) }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [buscar])
  useEffect(() => {
    void cargar()
  }, [cargar])
  useEffect(() => activarSonido(progreso.ajustes.sonido), [progreso.ajustes.sonido])
  const tema = progreso.ajustes.tema
  useEffect(() => {
    if (tema === 'auto') delete document.documentElement.dataset.tema
    else document.documentElement.dataset.tema = tema
    // Copia local solo para aplicar el tema antes de cargar el progreso (evita un destello del tema contrario).
    try { localStorage.setItem('aula-smr-public-tema', tema) } catch { /* sin almacenamiento: no pasa nada */ }
  }, [tema])
  return (
    <>
      {(nuevo || sinAvatar) && errores.length === 0 && !window.location.search.includes('galeria') ? (nuevo ? <Bienvenida /> : <ElegirAvatar />) : <Contenido cargado={cargado} errores={errores} pantalla={pantalla} />}
      <Dialogo />
      <Buscador />
      {intro && cargado && !nuevo && errores.length === 0 && animaciones && animacionesActivas() && !window.location.search.includes('galeria') && (
        <Intro nombre={progreso.nombre} alTerminar={() => setIntro(false)} />
      )}
    </>
  )
}

function Cargando() {
  return (
    <div className="cargando" role="status">
      <Logo />
      <span>Cargando…</span>
      <div className="cargando-barra"><div /></div>
    </div>
  )
}

function Contenido({ cargado, errores, pantalla }: { cargado: boolean; errores: string[]; pantalla: ReturnType<typeof useTienda.getState>['pantalla'] }) {
  if (window.location.search.includes('galeria')) return <Galeria />
  if (!cargado) return <Cargando />
  if (errores.length > 0)
    return (
      <div className="pantalla errores">
        <h1>No se pudo cargar el juego</h1>
        <p>Revisa los detalles de abajo. Tu progreso no se ha sustituido ni borrado.</p>
        <ul>{errores.map((e) => <li key={e}><code>{e}</code></li>)}</ul>
      </div>
    )
  switch (pantalla.id) {
    case 'demostracion':
      return <Suspense fallback={<Cargando />}><Demostracion /></Suspense>
    case 'inicio':
      return <Escritorio />
    case 'departamento':
      return <Departamento key={pantalla.moduloId} moduloId={pantalla.moduloId} unidadId={pantalla.unidadId} />
    case 'agenda':
      return <Agenda />
    case 'profesorado':
      return <ContactoProfesorado />
    case 'sesion':
      return <Suspense fallback={<Cargando />}><Sesion sesion={pantalla.sesion} unidadId={pantalla.unidadId} /></Suspense>
    case 'resultado':
      return <Resultado resumen={pantalla.resumen} unidadId={pantalla.unidadId} />
    case 'expediente':
      return <Expediente />
    case 'encargos':
      return <BandejaEncargos moduloId={pantalla.moduloId} />
    case 'encargo':
      return <Suspense fallback={<Cargando />}><EncargoCliente key={pantalla.encargoId} id={pantalla.encargoId} /></Suspense>
    case 'practica':
      return <Suspense fallback={<Cargando />}><Practica key={pantalla.moduloId ?? 'todas'} moduloId={pantalla.moduloId} /></Suspense>
    case 'apuntes':
      return <Suspense fallback={<Cargando />}><Apuntes key={pantalla.conceptoId} conceptoId={pantalla.conceptoId} /></Suspense>
  }
}
