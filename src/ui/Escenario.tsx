// Escena de una sala: fondo ilustrado, avatar sentado con vida propia (respira, parpadea, reacciona), polvo en la luz,
// vapor de la taza, brillo del portátil y zonas pulsables (puertas, etc.). Todo es decorativo salvo las zonas pulsables,
// que son botones reales. Con animaciones apagadas o "reducir movimiento" queda una imagen fija.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useTienda } from '../estado/tienda'
import { AVATARES, avatarDe, urlAvatar, urlSala, type Expresion } from './arte'
import { animacionesActivas, paralaje, reposoParalaje } from './efectos'

/** Zona pulsable: centro y tamaño en píxeles de la imagen original (1672 × 941). */
export interface PuntoEscena {
  id: string
  etiqueta: string
  caja: [cx: number, cy: number, ancho: number, alto: number]
  tono: number
  /** Texto corto del cartel permanente sobre la zona (si falta, se usa `etiqueta`). */
  rotulo?: string
  /** Fila del cartel: 0 pegado a la zona, 1 más arriba (para que no se pisen los de zonas muy juntas). */
  fila?: 0 | 1
  /** 0–1: barra de progreso dentro del cartel. */
  progreso?: number
  /** La cámara se acerca a la zona antes de actuar (para las puertas). */
  viaje?: boolean
  alPulsar: () => void
}

const W = 1672
const H = 941
/** Cuántas veces el ancho de la escena mide la franja del avatar (ver tools/arte/procesar_arte.py). */
const EXTENSION = 3

/** Pasa una posición vertical en % de la escena a % dentro de la franja del avatar (anclada abajo). */
const enFranja = (y: number, alto: number) => ((y / 100) * H - (H - alto)) / alto * 100

const MOTAS = Array.from({ length: 16 }, (_, i) => ({
  x: 4 + ((i * 29 + 11) % 460) / 10,
  y: 10 + ((i * 37 + 7) % 620) / 10,
  t: 3 + ((i * 17 + 5) % 30) / 10,
  d: -((i * 23 + 3) % 90) / 10,
  r: 0.6 + ((i * 13 + 2) % 11) / 10,
}))

function Polvo() {
  return (
    <div className="escenario-polvo" aria-hidden>
      {MOTAS.map((m, i) => <i key={i} style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.r * 3}px`, height: `${m.r * 3}px`, animationDuration: `${m.t * 3}s`, animationDelay: `${m.d}s` }} />)}
    </div>
  )
}

export function Escenario({ sala, puntos = [], children, clase = '' }: { sala: string; puntos?: PuntoEscena[]; children?: ReactNode; clase?: string }) {
  const { progreso, animo } = useTienda()
  const avatar = avatarDe(progreso)
  const vida = progreso.ajustes.animaciones !== false && animacionesActivas()
  const [parpadea, setParpadea] = useState(false)
  const [listo, setListo] = useState(false)
  const [viajando, setViajando] = useState<{ x: number; y: number }>()

  // Por si la carga de la imagen no avisa: a los 2 s se muestra igualmente.
  useEffect(() => {
    const t = window.setTimeout(() => setListo(true), 2000)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!vida || !avatar) return
    let t: number
    const programar = () => {
      t = window.setTimeout(() => {
        setParpadea(true)
        t = window.setTimeout(() => { setParpadea(false); programar() }, 150)
      }, 2600 + Math.random() * 4200)
    }
    programar()
    return () => window.clearTimeout(t)
  }, [vida, avatar])

  const pulsar = (p: PuntoEscena) => {
    if (viajando) return
    if (p.viaje && vida) {
      setViajando({ x: (p.caja[0] / W) * 100, y: (p.caja[1] / H) * 100 })
      window.setTimeout(p.alPulsar, 520)
    } else p.alPulsar()
  }
  const mostrar = (e: Expresion) => (e === 'parpadeo' ? parpadea && animo === 'neutra' : animo === e)
  const info = avatar ? AVATARES[avatar] : undefined
  return (
    <section className={`escenario ${clase} ${viajando ? 'viajando' : ''}`} aria-label={`Sala: ${sala}`}
      style={viajando ? ({ '--vx': `${viajando.x}%`, '--vy': `${viajando.y}%` } as CSSProperties) : undefined}
      onPointerMove={(e) => paralaje(e.currentTarget, e)} onPointerLeave={(e) => reposoParalaje(e.currentTarget)}>
      <div className="escenario-lienzo">
        <div className="escenario-mundo">
          <img className={`escenario-fondo ${listo ? 'listo' : ''}`} src={urlSala(sala)} alt="" draggable={false}
            ref={(el) => { if (el?.complete) setListo(true) }} onLoad={() => setListo(true)} onError={() => setListo(true)} />
          {vida && <Polvo />}
          {puntos.map((p, i) => {
            const [cx, cy, w, h] = p.caja
            const estilo = { left: `${((cx - w / 2) / W) * 100}%`, top: `${((cy - h / 2) / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%`, '--h': p.tono, '--i': i, '--fila': p.fila ?? 0 } as CSSProperties
            return (
              <button key={p.id} className="punto-escena" style={estilo} onClick={() => pulsar(p)} aria-label={p.etiqueta} title={p.etiqueta}>
                <span className="punto-etiqueta" aria-hidden>
                  {p.rotulo ?? p.etiqueta}
                  {p.progreso !== undefined && <i className="punto-barra"><b style={{ width: `${Math.round(p.progreso * 100)}%` }} /></i>}
                </span>
              </button>
            )
          })}
        </div>
        {avatar && info && (
          <div className="escenario-avatar" style={{ aspectRatio: `${W * EXTENSION} / ${info.alto}` }}>
            <img src={urlAvatar(avatar)} alt="" draggable={false} />
            {(['parpadeo', 'feliz', 'preocupada'] as Expresion[]).map((e) => (
              <img key={e} className={`expresion ${mostrar(e) ? 'visible' : ''}`} src={urlAvatar(avatar, e)} alt="" draggable={false} />
            ))}
            {vida && (
              <>
                <span className="vapor" style={{ left: `${info.taza.x / EXTENSION}%`, top: `${enFranja(info.taza.y, info.alto)}%` }} aria-hidden><i /><i /><i /></span>
                <span className="brillo-pantalla" style={{ left: `${info.portatil.x / EXTENSION}%`, top: `${enFranja(info.portatil.y, info.alto)}%` }} aria-hidden />
              </>
            )}
          </div>
        )}
      </div>
      {children && <div className="escenario-hud">{children}</div>}
    </section>
  )
}

/** Cabecera ilustrada de las páginas que no son una sala: la escena con el título y, si se quiere, acciones. */
export function CabeceraEscena({ sala = 'oficina', tono, titulo, descripcion, acciones }: { sala?: string; tono?: number; titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <div style={{ '--h': tono ?? 250 } as CSSProperties}>
      <Escenario sala={sala} clase="banner compacto">
        <div className="hud-dpto">
          <header className="dpto-titulo">
            <div>
              <h1>{titulo}</h1>
              {descripcion && <p className="cabecera-descripcion">{descripcion}</p>}
            </div>
          </header>
          {acciones && <div className="cabecera-acciones">{acciones}</div>}
        </div>
      </Escenario>
    </div>
  )
}
