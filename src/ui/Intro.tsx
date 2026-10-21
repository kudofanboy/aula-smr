// Animación de entrada: la cámara se acerca a una oficina ficticia mientras arranca el sistema (unos tres segundos)
// y termina con un "iris" que revela la oficina.
// Se puede saltar con un clic o cualquier tecla. No sale con "reducir movimiento" ni con las animaciones apagadas.
import { useEffect, useState } from 'react'
import { Logo } from './comun'
import { urlSala } from './arte'
import { marcarIntroMostrada } from './introEstado'

const DURACION_MS = 3600
const SALIDA_MS = 850

export function Intro({ nombre, alTerminar }: { nombre: string; alTerminar: () => void }) {
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    marcarIntroMostrada()
    const t = window.setTimeout(() => setSaliendo(true), DURACION_MS)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!saliendo) return
    const t = window.setTimeout(alTerminar, SALIDA_MS)
    return () => window.clearTimeout(t)
  }, [saliendo, alTerminar])

  useEffect(() => {
    const saltar = () => setSaliendo(true)
    window.addEventListener('keydown', saltar)
    return () => window.removeEventListener('keydown', saltar)
  }, [])

  return (
    <div className={`intro ${saliendo ? 'saliendo' : ''}`} role="presentation" onClick={() => setSaliendo(true)} aria-label="Entrando en Aula SMR. Pulsa para saltar.">
      <div className="intro-foto" style={{ backgroundImage: `url(${urlSala('oficina')})` }} aria-hidden />
      <div className="intro-velo" aria-hidden />
      <div className="intro-centro">
        <div className="intro-logo"><Logo /></div>
        <h1 className="intro-titulo" aria-label="Aula SMR">
          {'Aula '.split('').map((c, i) => <span key={i} style={{ animationDelay: `${0.35 + i * 0.06}s` }}>{c === ' ' ? '\u00a0' : c}</span>)}
          <b>{'SMR'.split('').map((c, i) => <span key={i} style={{ animationDelay: `${0.75 + i * 0.07}s` }}>{c}</span>)}</b>
        </h1>
        <p className="intro-hola">Hola, {nombre}</p>
        <div className="intro-carga"><div /></div>
      </div>
      <span className="intro-saltar">Pulsa para saltar</span>
    </div>
  )
}
