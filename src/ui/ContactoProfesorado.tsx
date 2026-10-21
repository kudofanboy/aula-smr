import { useState } from 'react'
import { ArrowUpRight, Check, Copy, ExternalLink, GraduationCap, Mail, Search, Users } from 'lucide-react'
import type { Profesor } from '../contenido/esquema'
import { useTienda } from '../estado/tienda'
import { Marco, Migas } from './comun'
import { colorModulo, type Modulo } from './utilidades'

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const fecha = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

function AgendaIlustrada() {
  return (
    <svg className="contactos-ilustracion" viewBox="0 0 320 230" aria-hidden="true">
      <ellipse cx="164" cy="202" rx="120" ry="15" fill="currentColor" opacity=".08" />
      <g transform="translate(36 30) rotate(-8 110 80)">
        <rect width="230" height="152" rx="20" fill="var(--superficie-2)" stroke="var(--m-borde)" strokeWidth="2" />
        <rect width="54" height="152" rx="20" fill="var(--m-suave)" />
        <path d="M54 0v152" stroke="var(--m-borde)" />
        {[30, 62, 94, 126].map((y) => <rect key={y} x="-8" y={y} width="20" height="6" rx="3" fill="var(--m-texto)" />)}
        <circle cx="108" cy="54" r="22" fill="var(--m-suave)" />
        <circle cx="108" cy="48" r="7" fill="var(--m-texto)" />
        <path d="M94 69c0-15 28-15 28 0" fill="var(--m-texto)" />
        <path d="M145 42h50M145 55h34M83 96h111M83 112h85" stroke="var(--borde-fuerte)" strokeWidth="7" strokeLinecap="round" />
      </g>
      <g className="contactos-sobre" transform="translate(193 133) rotate(8 46 32)">
        <rect width="92" height="64" rx="12" fill="var(--m)" />
        <path d="m10 13 36 27 36-27M10 52l24-22M82 52 58 30" fill="none" stroke="var(--superficie)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx="277" cy="64" r="19" fill="var(--m-suave)" stroke="var(--m-borde)" />
      <path d="m269 64 5 5 10-11" fill="none" stroke="var(--m-texto)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function TarjetaProfesor({ p, modulos }: { p: Profesor; modulos: Modulo[] }) {
  const [copia, setCopia] = useState<'inicial' | 'copiada' | 'error'>('inicial')
  const asignaturas = modulos.filter((m) => p.modulos.includes(m.id))
  const iniciales = p.nombre.split(' ').slice(0, 2).map((s) => s[0]).join('')
  const copiar = async () => {
    try { await navigator.clipboard.writeText(p.correo); setCopia('copiada') }
    catch { setCopia('error') }
  }
  const asunto = encodeURIComponent('Aula SMR demo · Fictional contact')
  return (
    <article className={`contacto-tarjeta ${p.tutora ? 'es-tutora' : ''}`} style={colorModulo(asignaturas[0])}>
      <div className="contacto-identidad">
        <div className="contacto-avatar" aria-hidden="true">{iniciales}</div>
        <div className="contacto-nombre">
          {p.tutora && <span className="contacto-tutora"><GraduationCap size={14} /> Tutora del grupo</span>}
          <h2>{p.nombre}</h2>
          <div className="contacto-asignaturas">
            {asignaturas.map((m) => <span key={m.id} style={colorModulo(m)}><i aria-hidden="true" />{m.corto ?? m.nombre}</span>)}
          </div>
        </div>
      </div>
      <div className="contacto-detalles">
        <div className="contacto-direccion"><Mail size={16} aria-hidden="true" /><span>{p.correo}</span></div>
        {p.nota && <p className="contacto-nota">{p.nota}</p>}
        <div className="contacto-acciones">
          <a className="btn principal" href={`mailto:${p.correo}?subject=${asunto}`} aria-label={`Redactar correo a ${p.nombre}`}>Redactar correo <ArrowUpRight size={16} /></a>
          <button className="btn secundario" onClick={() => void copiar()} aria-label={`Copiar correo de ${p.nombre}`}>
            {copia === 'copiada' ? <Check size={16} /> : <Copy size={16} />} {copia === 'copiada' ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <span className={`contacto-estado ${copia === 'error' ? 'error' : ''}`} role="status">
          {copia === 'copiada' ? 'Correo copiado al portapapeles.' : copia === 'error' ? 'No se pudo copiar. Selecciona la dirección de correo y cópiala manualmente.' : ''}
        </span>
      </div>
      <details className="contacto-fuentes">
        <summary>Datos revisados el {fecha(p.revisado)}</summary>
        {p.fuentes.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noreferrer">{f.titulo} <ExternalLink size={12} /></a>)}
      </details>
    </article>
  )
}

export function ContactoProfesorado() {
  const { curso, ir } = useTienda()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const profesores = curso?.profesorado ?? []
  const modulos = curso?.modulos ?? []
  const q = normalizar(busqueda.trim())
  const visibles = profesores.filter((p) => {
    const coincide = filtro === 'todos' || (filtro === 'tutoria' ? p.tutora : p.modulos.includes(filtro as Modulo['id']))
    const texto = [p.nombre, p.correo, p.tutora ? 'tutora tutoria' : '', ...modulos.filter((m) => p.modulos.includes(m.id)).flatMap((m) => [m.id, m.nombre, m.corto ?? ''])].join(' ')
    return coincide && normalizar(texto).includes(q)
  })
  return (
    <Marco activa="profesorado" estilo={colorModulo({ tono: 175 })}>
      <div className="contactos-pagina">
        <Migas pasos={[{ texto: 'Mi panel', ir: () => ir({ id: 'inicio' }) }, { texto: 'Contacto profesorado' }]} />
        <header className="contactos-portada">
          <div className="contactos-presentacion">
            <span className="sobretitulo">Tu equipo docente · 1.º SMR</span>
            <h1>Una duda es el<br /><span>primer paso.</span></h1>
            <p>Encuentra a tu profesor, prepara tu consulta y sigue avanzando.</p>
            <div className="contactos-resumen"><span><Users size={16} /> {profesores.length} docentes</span><span><GraduationCap size={17} /> Fictional demo course</span></div>
          </div>
          <AgendaIlustrada /><p className="ayuda">Directorio ficticio de demostración. Los nombres y direcciones son ejemplos y no corresponden a contactos reales.</p>
        </header>
        <section className="contactos-directorio" aria-labelledby="titulo-directorio">
          <div className="contactos-herramientas">
            <div><span className="sobretitulo">Cerca de ti</span><h2 id="titulo-directorio">Contacto profesorado</h2></div>
            <label className="contactos-buscador"><Search size={18} aria-hidden="true" /><span className="sr-only">Buscar por nombre o asignatura</span><input type="search" placeholder="Nombre o asignatura…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></label>
          </div>
          <div className="contactos-filtros" role="group" aria-label="Filtrar profesorado">
            {[{ id: 'todos', nombre: 'Todos' }, { id: 'tutoria', nombre: 'Tutoría' }, ...modulos.filter((m) => profesores.some((p) => p.modulos.includes(m.id))).map((m) => ({ id: m.id, nombre: m.corto ?? m.nombre }))].map((f) =>
              <button key={f.id} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.nombre}</button>)}
          </div>
          <p className="contactos-conteo" role="status">{visibles.length === 1 ? '1 contacto' : `${visibles.length} contactos`}{q || filtro !== 'todos' ? ' para tu búsqueda' : ' para acompañarte durante el curso'}</p>
          <div className="contactos-rejilla">{visibles.map((p) => <TarjetaProfesor key={p.id} p={p} modulos={modulos} />)}</div>
          {visibles.length === 0 && <div className="contactos-vacio"><Search size={28} /><h3>No encontramos ese contacto</h3><p>Prueba con otra asignatura o con el nombre del profesor.</p><button className="btn secundario" onClick={() => { setFiltro('todos'); setBusqueda('') }}>Ver todos</button></div>}
          <div className="contactos-ayuda"><Mail size={19} /><p><strong>Una consulta clara ayuda.</strong> Indica tu grupo, la unidad que estás estudiando y la duda concreta. «Redactar correo» abre tu aplicación de correo para que prepares el mensaje.</p></div>
        </section>
      </div>
    </Marco>
  )
}
