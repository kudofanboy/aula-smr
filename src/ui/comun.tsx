// Piezas de interfaz compartidas: barra superior, migas de pan, etiquetas de asignatura, estrellas y barras.
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent as TeclaReact, type ReactNode } from 'react'
import { Bell, BookOpen, Building2, CalendarDays, Check, ChevronDown, ChevronRight, FileText, Flame, HardHat, Languages, Lock, Mail, Search, Settings, Type, Moon, Network, Sparkles, Sun, SunMoon, TerminalSquare, Volume2, VolumeX, Wrench, type LucideIcon } from 'lucide-react'
import { useTienda } from '../estado/tienda'
import { hoy, META_XP_DIA, rango } from '../motor/progreso'
import { MODO_PROFESOR } from '../estado/almacen'
import { activarSonido } from './sonido'
import { avatarDe, urlRetrato } from './arte'
import { colorModulo, useDominados, useModulo } from './utilidades'

/** Icono de línea de cada asignatura (los emojis cambian de aspecto según el sistema y no se pueden colorear). */
const ICONOS_MODULO: Record<string, LucideIcon> = { REDES: Network, SOM: TerminalSquare, MME: Wrench, AOF: FileText, ING: Languages, IPE: HardHat }

export function IconoModulo({ id, size = 18 }: { id?: string; size?: number }) {
  const I = (id && ICONOS_MODULO[id]) || FileText
  return <I size={size} strokeWidth={2} aria-hidden />
}

/** Etiqueta de asignatura (y unidad) con su color: responde a "¿de qué es esto?". */
export function EtiquetaModulo({ unidadId, grande = false }: { unidadId: string; grande?: boolean }) {
  const u = useTienda((s) => s.indice?.unidades.find((x) => x.id === unidadId))
  const m = useModulo(u?.modulo)
  if (!u) return null
  return (
    <span className={`etiqueta-modulo ${grande ? 'grande' : ''}`} style={colorModulo(m)} title={`${m?.nombre ?? u.modulo} · ${u.codigo} ${u.titulo}`}>
      <span className="icono-mod" aria-hidden><IconoModulo id={u.modulo} size={15} /></span>
      <span className="nombre-mod">{m?.corto ?? u.modulo}</span>
      <span className="unidad-mod">{u.codigo}</span>
    </span>
  )
}

export function Estrellas({ n, max = 3, grande = false }: { n: number; max?: number; grande?: boolean }) {
  return (
    <span className={`estrellas ${grande ? 'grande' : ''}`} role="img" aria-label={`${n} de ${max} estrellas`}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < n ? 'on' : 'off'} style={{ animationDelay: `${0.15 + i * 0.18}s` }}>★</span>)}
    </span>
  )
}

export function BarraNivel({ valor, total, etiqueta }: { valor: number; total: number; etiqueta?: string }) {
  const pct = total ? Math.round((valor / total) * 100) : 0
  return (
    <div className="barra-nivel" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={etiqueta}>
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Logo() {
  return (
    <span className="logo-marca" aria-hidden>
      <svg viewBox="0 0 32 32" width="30" height="30">
        <rect x="3" y="3" width="26" height="26" rx="7" className="logo-fondo" />
        <rect x="9" y="9" width="14" height="4" rx="1.5" className="logo-rack" />
        <rect x="9" y="14.5" width="14" height="4" rx="1.5" className="logo-rack" />
        <rect x="9" y="20" width="14" height="4" rx="1.5" className="logo-rack" />
        <circle cx="20.5" cy="11" r="1" className="logo-led" />
        <circle cx="20.5" cy="16.5" r="1" className="logo-led" />
        <circle cx="20.5" cy="22" r="1" className="logo-led b" />
      </svg>
    </span>
  )
}

const TEMAS = [
  { id: 'auto', icono: SunMoon, texto: 'Automático', ayuda: 'El del sistema' },
  { id: 'claro', icono: Sun, texto: 'Claro' },
  { id: 'oscuro', icono: Moon, texto: 'Oscuro' },
] as const

/** Anillo de progreso (objetivo diario, dominio de una asignatura…). */
export function Anillo({ valor, total, tam = 40, grosor = 5, children, clase = '' }: { valor: number; total: number; tam?: number; grosor?: number; children?: ReactNode; clase?: string }) {
  const r = (tam - grosor) / 2
  const c = 2 * Math.PI * r
  const objetivo = total ? Math.min(1, valor / total) : 0
  // Se parte de vacío y se pasa al valor real tras pintar: así el anillo se dibuja al aparecer y al cambiar.
  const [f, setF] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setF(objetivo))
    return () => cancelAnimationFrame(id)
  }, [objetivo])
  return (
    <span className={`anillo ${clase} ${f >= 1 ? 'completo' : ''}`} style={{ width: tam, height: tam }}>
      <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} aria-hidden>
        <circle cx={tam / 2} cy={tam / 2} r={r} className="anillo-pista" strokeWidth={grosor} />
        <circle cx={tam / 2} cy={tam / 2} r={r} className="anillo-valor" strokeWidth={grosor}
          strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform={`rotate(-90 ${tam / 2} ${tam / 2})`} />
      </svg>
      {children && <span className="anillo-centro">{children}</span>}
    </span>
  )
}

/**
 * Desplegable accesible (patrón de divulgación): se abre con el botón, se cierra con Escape devolviendo el foco
 * al botón, al pulsar fuera o al salir del panel con el tabulador. No depende del paso del ratón.
 */
function useDesplegable() {
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  // Safari (iPhone y Mac) no da el foco a un botón al pulsarlo: el foco sale hacia la página y el panel se cerraría
  // antes de recibir el toque. Mientras se está pulsando dentro, esa pérdida de foco no cierra.
  const pulsandoDentro = useRef(false)
  useEffect(() => {
    if (!abierto) return
    panel.current?.querySelector<HTMLElement>('[aria-current="page"], button')?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      boton.current?.focus()
    }
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !boton.current?.contains(t)) setAbierto(false)
    }
    document.addEventListener('keydown', tecla)
    document.addEventListener('pointerdown', fuera)
    return () => { document.removeEventListener('keydown', tecla); document.removeEventListener('pointerdown', fuera) }
  }, [abierto])
  const alSalir = (e: FocusEvent<HTMLElement>) => {
    if (!pulsandoDentro.current && !e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false)
  }
  const contenedor = {
    onBlur: alSalir,
    onPointerDown: () => { pulsandoDentro.current = true },
    onPointerUp: () => { pulsandoDentro.current = false },
    onPointerCancel: () => { pulsandoDentro.current = false },
  }
  // Flechas arriba/abajo para recorrer las opciones, además del tabulador.
  const alTeclear = (e: TeclaReact<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const opciones = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
    const i = opciones.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    opciones[(i + (e.key === 'ArrowDown' ? 1 : opciones.length - 1)) % opciones.length]?.focus()
  }
  return { abierto, alternar: () => setAbierto((a) => !a), boton, panel, contenedor, alTeclear }
}

/** Nombre breve para la barra: los nombres largos se sustituyen por el código del módulo (el completo va en la ayuda). */
const nombreBarra = (m: { id: string; corto?: string; nombre: string }) => {
  const corto = m.corto ?? m.nombre
  return corto.length > 12 ? m.id : corto
}

/** Selector de asignaturas: agrupa los módulos en un solo control e indica en cuál estás. */
function SelectorAsignaturas({ activa }: { activa?: string }) {
  const { indice, curso, ir } = useTienda()
  const { abierto, alternar, boton, panel, contenedor, alTeclear } = useDesplegable()
  const modulos = curso?.modulos ?? []
  const actual = modulos.find((m) => m.id === activa)
  if (modulos.length === 0) return null
  return (
    <div className="barra-desplegable barra-asignaturas" {...contenedor}>
      <button ref={boton} className={`barra-boton ${actual ? 'activa con-modulo' : ''}`} style={actual ? colorModulo(actual) : undefined}
        aria-expanded={abierto} aria-controls="menu-asignaturas" onClick={alternar}
        aria-label={actual ? `Asignaturas: ${actual.nombre}` : 'Asignaturas'} title={actual ? `Asignaturas · estás en ${actual.nombre}` : 'Elegir asignatura'}>
        {actual ? <IconoModulo id={actual.id} size={19} /> : <BookOpen size={19} aria-hidden />}
        <span>{actual ? nombreBarra(actual) : 'Asignaturas'}</span>
        <ChevronDown size={15} className="desplegable-flecha" aria-hidden />
      </button>
      {abierto && (
        <div ref={panel} id="menu-asignaturas" className="barra-panel lista-asignaturas" onKeyDown={alTeclear}>
          <p className="barra-panel-titulo">Asignaturas</p>
          <ul>
            {modulos.map((m) => {
              const cerrado = !indice?.unidades.some((u) => u.modulo === m.id)
              return (
                <li key={m.id}>
                  <button className={`opcion-asignatura ${m.id === activa ? 'activa' : ''} ${cerrado ? 'cerrada' : ''}`} style={colorModulo(m)} aria-current={m.id === activa ? 'page' : undefined}
                    onClick={() => ir({ id: 'departamento', moduloId: m.id })}>
                    <span className="menu-icono" aria-hidden><IconoModulo id={m.id} size={18} /></span>
                    <span className="menu-texto">{m.nombre}{cerrado && <small>Próximamente</small>}</span>
                    {cerrado ? <Lock size={14} className="pestana-candado" aria-hidden /> : m.id === activa && <Check size={16} aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Ajustes de uso (tema, letra, animaciones y sonido) reunidos en un panel, cada uno con su nombre visible. */
function PanelAjustes() {
  const { progreso, cambiar } = useTienda()
  const { abierto, alternar, boton, panel, contenedor, alTeclear } = useDesplegable()
  const { sonido, tema, tamano, animaciones } = progreso.ajustes
  const ajustar = (cambio: Partial<typeof progreso.ajustes>) => cambiar((p) => ({ ...p, ajustes: { ...p.ajustes, ...cambio } }))
  const interruptor = (texto: string, icono: ReactNode, activo: boolean, alPulsar: () => void) => (
    <button className="opcion-ajuste" aria-pressed={activo} onClick={alPulsar}>
      <span className="menu-icono" aria-hidden>{icono}</span>
      <span className="menu-texto">{texto}</span>
      <span className="interruptor" aria-hidden><i /></span>
    </button>
  )
  return (
    <div className="barra-desplegable barra-ajustes-menu" {...contenedor}>
      <button ref={boton} className={`barra-boton boton-ajustes ${abierto ? 'abierto' : ''}`} aria-expanded={abierto} aria-controls="panel-ajustes" onClick={alternar} title="Tema, tamaño de letra, animaciones y sonido">
        <Settings size={19} aria-hidden /><span>Ajustes</span>
      </button>
      {abierto && (
        <div ref={panel} id="panel-ajustes" className="barra-panel panel-ajustes" onKeyDown={alTeclear}>
          <p className="barra-panel-titulo">Ajustes</p>
          <div className="grupo-tema" role="group" aria-labelledby="titulo-tema">
            <span id="titulo-tema" className="grupo-tema-titulo">Tema</span>
            <div>
              {TEMAS.map((t) => (
                <button key={t.id} className="opcion-tema" aria-pressed={tema === t.id} title={'ayuda' in t ? t.ayuda : undefined} onClick={() => ajustar({ tema: t.id })}>
                  <t.icono size={17} aria-hidden /> {t.texto}
                </button>
              ))}
            </div>
          </div>
          {interruptor('Letra más grande', <Type size={18} />, tamano === 'grande', () => ajustar({ tamano: tamano === 'grande' ? 'normal' : 'grande' }))}
          {interruptor('Animaciones', <Sparkles size={18} />, animaciones !== false, () => ajustar({ animaciones: animaciones === false }))}
          {interruptor('Sonido', sonido ? <Volume2 size={18} /> : <VolumeX size={18} />, sonido, () => { activarSonido(!sonido); ajustar({ sonido: !sonido }) })}
        </div>
      )}
    </div>
  )
}

/**
 * Estructura de todas las pantallas (menos las partidas): navegación superior y contenido.
 */
export function Marco({ activa, children, estilo }: { activa?: string; children: ReactNode; estilo?: CSSProperties }) {
  const { progreso, ir, buscar } = useTienda()
  const dominados = useDominados()
  const { actual, siguiente } = rango(dominados)
  const xpHoy = progreso.xpDia[hoy()] ?? 0
  const avatarActual = avatarDe(progreso)
  const pendientes = Object.values(progreso.encargos).filter((e) => !e.completado).length
  const boton = (id: string, icono: ReactNode, texto: string, ayuda: string, alPulsar: () => void, extra?: ReactNode) => (
    <button key={id} className={`barra-boton ${activa === id ? 'activa' : ''}`} onClick={alPulsar} aria-current={activa === id ? 'page' : undefined} title={ayuda}>
      {icono}<span>{texto}</span>{extra}
    </button>
  )
  return (
    <div className="marco" style={estilo}>
      {MODO_PROFESOR && <div className="aviso-profesorado">Modo profesorado: perfil ficticio, todo desbloqueado y no se guarda nada. <button className="btn texto" onClick={() => ir({ id: 'demostracion' })}>Ver recorrido docente</button></div>}
      <header className="barra">
        <button className="marca" onClick={() => ir({ id: 'inicio' })} title="Ir a Inicio">
          <Logo />
          <span className="marca-texto">Aula <b>SMR</b></span>
        </button>

        <nav className="barra-nav" aria-label="Secciones">
          {boton('inicio', <Building2 size={19} aria-hidden />, 'Inicio', 'Inicio: tu siguiente paso', () => ir({ id: 'inicio' }))}
          <SelectorAsignaturas activa={activa} />
          {boton('encargos', <Bell size={19} aria-hidden />, 'Casos', 'Casos prácticos', () => ir({ id: 'encargos' }), pendientes > 0 ? <span className="contador-encargos">{pendientes}<span className="sr-only"> pendientes</span></span> : undefined)}
          {boton('agenda', <CalendarDays size={19} aria-hidden />, 'Agenda', 'Agenda: exámenes y fechas', () => ir({ id: 'agenda' }))}
          {boton('profesorado', <Mail size={19} aria-hidden />, 'Profesores', 'Contacto con el profesorado', () => ir({ id: 'profesorado' }))}
        </nav>

        <button className={`barra-jugador ${activa === 'expediente' ? 'activa' : ''}`} onClick={() => ir({ id: 'expediente' })}
          title={siguiente ? `Mi ficha · siguiente rango: ${siguiente.nombre} (${dominados}/${siguiente.dominados} conceptos dominados)` : 'Mi ficha'} aria-label="Mi ficha">
          <span className="ficha-avatar" aria-hidden>{avatarActual ? <img src={urlRetrato(avatarActual)} alt="" /> : (progreso.nombre || '?').slice(0, 1).toUpperCase()}</span>
          <span className="ficha-nombre">
            <strong>{progreso.nombre || 'Sin nombre'}</strong>
            <small>{actual.nombre}</small>
            {siguiente && <span className="barra-nivel-mini"><BarraNivel valor={dominados} total={siguiente.dominados} etiqueta="Progreso hacia el siguiente rango" /></span>}
          </span>
          <span className={`stat racha ${progreso.racha.actual > 0 ? 'viva' : ''}`} title="Racha: días seguidos con un paso breve o la sesión completa de Inicio (las lecciones sueltas del mapa no cuentan)"><Flame size={18} /> {progreso.racha.actual} <small>{progreso.racha.actual === 1 ? 'día' : 'días'}</small></span>
          <span className="stat meta" title={`Objetivo de hoy: ${META_XP_DIA} XP`}>
            <Anillo valor={xpHoy} total={META_XP_DIA} tam={28} grosor={4}>{xpHoy >= META_XP_DIA ? '✓' : ''}</Anillo>
            {Math.min(xpHoy, META_XP_DIA)}/{META_XP_DIA} <small>XP hoy</small>
          </span>
        </button>

        <div className="barra-ajustes">
          <button className="icono-btn barra-buscar" title="Buscar (Ctrl+K)" aria-label="Buscar (Ctrl+K)" onClick={() => buscar(true)}><Search size={19} /></button>
          <PanelAjustes />
        </div>
      </header>
      <main className="contenido">{children}</main>
    </div>
  )
}

/** Migas de pan: dónde estás dentro del edificio. */
export function Migas({ pasos }: { pasos: { texto: ReactNode; ir?: () => void }[] }) {
  return (
    <nav className="migas" aria-label="Estás en">
      {pasos.map((p, i) => (
        <span key={i} className="miga">
          {i > 0 && <ChevronRight size={15} className="sep" aria-hidden />}
          {p.ir ? <button onClick={p.ir}>{p.texto}</button> : <span aria-current="page">{p.texto}</span>}
        </span>
      ))}
    </nav>
  )
}
