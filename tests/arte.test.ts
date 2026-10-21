import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AVATARES, IDS_AVATAR } from '../src/ui/arte'

const ruta = (nombre: string) => `src/assets/arte/${nombre}.webp`
const curso = JSON.parse(readFileSync('contenido/curso.json', 'utf-8')) as { modulos: { id: string }[] }
const EXPRESIONES = ['neutra', 'parpadeo', 'feliz', 'preocupada']

function chunks(datos: Buffer) {
  expect(datos.toString('ascii', 0, 4)).toBe('RIFF')
  expect(datos.toString('ascii', 8, 12)).toBe('WEBP')
  const result: { tipo: string; inicio: number }[] = []
  for (let pos = 12; pos + 8 <= datos.length;) {
    const longitud = datos.readUInt32LE(pos + 4)
    result.push({ tipo: datos.toString('ascii', pos, pos + 4), inicio: pos + 8 })
    expect(pos + 8 + longitud).toBeLessThanOrEqual(datos.length)
    pos += 8 + longitud + (longitud % 2)
  }
  return result
}

function dimensiones(datos: Buffer) {
  const partes = chunks(datos)
  const extendida = partes.find(c => c.tipo === 'VP8X')
  if (extendida) return { ancho: 1 + datos.readUIntLE(extendida.inicio + 4, 3), alto: 1 + datos.readUIntLE(extendida.inicio + 7, 3) }
  const lossless = partes.find(c => c.tipo === 'VP8L')
  if (lossless) {
    expect(datos[lossless.inicio]).toBe(0x2f)
    const bits = datos.readUInt32LE(lossless.inicio + 1)
    return { ancho: 1 + (bits & 0x3fff), alto: 1 + ((bits >>> 14) & 0x3fff) }
  }
  const lossy = partes.find(c => c.tipo === 'VP8 ')
  if (!lossy) throw new Error('WebP sin imagen compatible')
  return { ancho: datos.readUInt16LE(lossy.inicio + 6) & 0x3fff, alto: datos.readUInt16LE(lossy.inicio + 8) & 0x3fff }
}

describe('arte del juego', () => {
  it('cada departamento demo tiene sala ilustrada y la oficina', () => {
    for (const m of curso.modulos) expect(existsSync(ruta(`sala-${m.id}`)), `falta la sala de ${m.id}`).toBe(true)
    expect(existsSync(ruta('sala-oficina'))).toBe(true)
    expect(existsSync(ruta('sala-entrada'))).toBe(false)
  })

  it('cada avatar tiene sus cuatro expresiones, en franja y en retrato', () => {
    expect(IDS_AVATAR.length).toBeGreaterThan(0)
    for (const id of IDS_AVATAR) {
      for (const e of EXPRESIONES) {
        expect(existsSync(ruta(`avatar-${id}-${e}`)), `falta avatar-${id}-${e}`).toBe(true)
        expect(existsSync(ruta(`retrato-${id}-${e}`)), `falta retrato-${id}-${e}`).toBe(true)
      }
    }
  })

  it('las franjas del avatar miden el alto declarado (las posiciones del vapor y el brillo dependen de él)', () => {
    for (const id of IDS_AVATAR) {
      const datos = readFileSync(ruta(`avatar-${id}-neutra`))
      const { ancho, alto } = dimensiones(datos)
      expect(ancho).toBe(1672 * 3)
      expect(alto).toBe(AVATARES[id].alto)
    }
  })

  it('la copia sin metadatos mantiene cada WebP por debajo del presupuesto de 2 MiB', () => {
    // La limpieza pública usa WebP lossless y requiere otro presupuesto que el original comprimido.
    for (const nombre of readdirSync('src/assets/arte').filter(n => n.endsWith('.webp'))) expect(statSync(`src/assets/arte/${nombre}`).size, nombre).toBeLessThan(2 * 1024 * 1024)
  })

  it('ninguna imagen pública conserva bloques EXIF o XMP', () => {
    for (const nombre of readdirSync('src/assets/arte').filter(n => n.endsWith('.webp'))) {
      const tipos = chunks(readFileSync(`src/assets/arte/${nombre}`)).map(c => c.tipo)
      expect(tipos, nombre).not.toContain('EXIF')
      expect(tipos, nombre).not.toContain('XMP ')
    }
  })
})
