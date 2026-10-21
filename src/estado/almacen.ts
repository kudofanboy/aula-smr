// Dónde se leen el contenido y el progreso.
// - Versión personal (npm run build): servidor local → progreso en datos/progreso.json e informes para Claude.
// - Versión para compartir (npm run build:compartir): un solo HTML sin servidor → contenido empaquetado dentro
//   y progreso en el almacenamiento del navegador (con exportar/importar para no perderlo).

import { validarCopiaProgreso } from '../motor/copias'
import type { Progreso } from '../motor/progreso'
import type { Unidad } from '../contenido/esquema'

export const MODO_COMPARTIR = import.meta.env.MODE === 'compartir' || import.meta.env.MODE === 'web'

const CLAVE_PROGRESO = 'aula-smr-public-progreso'
const CLAVE_INFORMES = 'aula-smr-public-informes'

export async function leerContenido(): Promise<{ unidades: unknown[]; calendario: unknown; curso: unknown; errores?: string[] }> {
  if (!MODO_COMPARTIR) {
    const respuesta = await fetch('/api/contenido')
    if (!respuesta.ok) throw new Error(`No se pudo leer el contenido (${respuesta.status}).`)
    return respuesta.json()
  }
  const unidades: unknown[] = []
  let calendario: unknown = []
  let curso: unknown = null
  const { contenidoEmpaquetado } = await import('./contenido-empaquetado')
  for (const [ruta, datos] of Object.entries(contenidoEmpaquetado)) {
    if (ruta.endsWith('/calendario.json')) calendario = datos
    else if (ruta.endsWith('/curso.json')) curso = datos
    else unidades.push(datos)
  }
  return { unidades, calendario, curso }
}

/** Modo profesorado (`?profesor` en la dirección): todo desbloqueado y nada se guarda. */
export const MODO_PROFESOR = typeof location !== 'undefined' && new URLSearchParams(location.search).has('profesor')

/**
 * Entrada directa al recorrido docente (`?profesor&recorrido=1`), pensada para enlazar por correo.
 * Solo dentro del modo profesorado: así nunca se abre con el progreso real ni habilita el guardado.
 */
export function abreRecorridoDirecto(busqueda: string): boolean {
  const p = new URLSearchParams(busqueda)
  return p.has('profesor') && p.get('recorrido') === '1'
}
export const RECORRIDO_DIRECTO = typeof location !== 'undefined' && abreRecorridoDirecto(location.search)

/** Versión del progreso que este cliente leyó o guardó por última vez (solo con servidor). */
let versionBase: string | undefined
let textoBase: string | null = null
export const versionDelProgreso = () => versionBase

/** Otra ventana guardó el progreso desde que este cliente lo cargó. */
export class ConflictoDeGuardado extends Error {}

export async function leerProgreso(): Promise<unknown> {
  if (!MODO_COMPARTIR) {
    const respuesta = await fetch('/api/progreso')
    if (!respuesta.ok) throw new Error(`No se pudo leer el progreso (${respuesta.status}).`)
    const datos: unknown = await respuesta.json()
    versionBase = respuesta.headers.get('X-Version') ?? undefined
    return datos
  }
  try {
    const t = localStorage.getItem(CLAVE_PROGRESO)
    const datos: unknown = t === null ? null : JSON.parse(t)
    textoBase = t
    return datos
  } catch {
    throw new Error('No se pudo leer el progreso de este navegador. No se ha sustituido ni borrado.')
  }
}

export async function guardarProgreso(p: unknown): Promise<void> {
  const texto = JSON.stringify(p, null, 1)
  if (!MODO_COMPARTIR) {
    const respuesta = await fetch('/api/progreso', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(versionBase ? { 'X-Base': versionBase } : {}) }, body: texto })
    if (respuesta.status === 409) throw new ConflictoDeGuardado('El progreso cambió desde otra ventana.')
    if (!respuesta.ok) throw new Error(`El servidor rechazó el guardado (${respuesta.status}).`)
    try {
      const datos = (await respuesta.json()) as { version?: string }
      if (datos.version) versionBase = datos.version
    } catch {
      // Respuesta sin cuerpo: se conserva la versión anterior.
    }
    return
  }
  try {
    // Toda la comprobación es síncrona. Web Locks serializa pestañas donde está disponible.
    const guardar = () => {
      if (localStorage.getItem(CLAVE_PROGRESO) !== textoBase) throw new ConflictoDeGuardado('El progreso cambió desde otra ventana.')
      localStorage.setItem(CLAVE_PROGRESO, texto)
      textoBase = texto
    }
    if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request(CLAVE_PROGRESO, guardar)
    else guardar()
  } catch (e) {
    if (e instanceof ConflictoDeGuardado) throw e
    throw new Error(`No se pudo guardar en este navegador${e instanceof Error && e.message ? `: ${e.message}` : '.'}`)
  }
}

/** Avisos de error guardados en este navegador (versión web, sin servidor): se pueden copiar y enviar. */
export function informesGuardados(): object[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CLAVE_INFORMES) ?? '[]')
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

export async function enviarInforme(informe: object): Promise<void> {
  if (!MODO_COMPARTIR) {
    const respuesta = await fetch('/api/informes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(informe) })
    if (!respuesta.ok) throw new Error(`No se pudo guardar el informe (${respuesta.status}).`)
    return
  }
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CLAVE_INFORMES) ?? '[]')
    if (!Array.isArray(lista)) throw new Error('Los informes guardados no son válidos')
    lista.push({ ...informe, fecha: new Date().toISOString() })
    localStorage.setItem(CLAVE_INFORMES, JSON.stringify(lista))
  } catch {
    throw new Error('No se pudo guardar el informe en este navegador. Puedes volver a intentarlo.')
  }
}

/** Descarga el progreso como archivo .json (copia de seguridad o para pasarlo a otro ordenador). */
export function exportarProgreso(p: unknown) {
  const blob = new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `progreso-juego-smr-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Lee un archivo de progreso elegido por el usuario. */
export function importarProgreso(unidades: readonly Unidad[]): Promise<Progreso> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.hidden = true
    document.body.append(input)
    input.oncancel = () => { input.remove(); reject(new Error('Importación cancelada.')) }
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) { input.remove(); reject(new Error('No se eligió ningún archivo')); return }
      try {
        if (f.size > 5 * 1024 * 1024) throw new Error('La copia supera el tamaño máximo de 5 MB. Tu progreso no se ha cambiado.')
        const datos = JSON.parse(await f.text())
        resolve(validarCopiaProgreso(datos, unidades))
      } catch (e) {
        reject(e)
      } finally {
        input.remove()
      }
    }
    input.click()
  })
}
