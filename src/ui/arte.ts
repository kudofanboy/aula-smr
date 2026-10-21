// Arte del juego (salas y avatares). Los archivos los genera tools/arte/procesar_arte.py a partir de los originales.
import type { Progreso } from '../motor/progreso'

const archivos = import.meta.glob('../assets/arte/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const url = (nombre: string): string => archivos[`../assets/arte/${nombre}.webp`] ?? ''

export type AvatarId = 'chica' | 'chico'
export type Expresion = 'neutra' | 'parpadeo' | 'feliz' | 'preocupada'

/** `alto`: alto en píxeles de la franja del avatar (ancho 3 × 1672: la mesa se prolonga para poder escalar al personaje). Posiciones (en % de la escena) de los detalles que cobran vida: vapor de la taza y brillo del portátil. */
export const AVATARES: Record<AvatarId, { nombre: string; alto: number; taza: { x: number; y: number }; portatil: { x: number; y: number } }> = {
  chica: { nombre: 'Alumna', alto: 476, taza: { x: 32, y: 86.5 }, portatil: { x: 18.9, y: 89.3 } },
  chico: { nombre: 'Alumno', alto: 472, taza: { x: 9.9, y: 87.5 }, portatil: { x: 28, y: 87.3 } },
}

export const IDS_AVATAR = Object.keys(AVATARES) as AvatarId[]

export const urlSala = (sala: string): string => url(`sala-${sala}`)
export const urlAvatar = (a: AvatarId, e: Expresion = 'neutra'): string => url(`avatar-${a}-${e}`)
export const urlRetrato = (a: AvatarId, e: Expresion = 'neutra'): string => url(`retrato-${a}-${e}`)

export const avatarDe = (p: Pick<Progreso, 'avatar'>): AvatarId | undefined => (p.avatar && p.avatar in AVATARES ? p.avatar : undefined)
