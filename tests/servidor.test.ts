import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { request, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearServidor, renombrarConReintentos } from '../servidor/app.mjs'

const base = path.resolve('output/pruebas-servidor')
let raiz: string
let servidor: Server
let origen: string
const progreso = (nombre: string) => JSON.stringify({ conceptos: {}, nombre })
const poner = (nombre: string, version: string) => fetch(`${origen}/api/progreso`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Base': version }, body: progreso(nombre),
})

beforeEach(async () => {
  await mkdir(base, { recursive: true })
  raiz = await mkdtemp(path.join(base, 'fixture-'))
  await mkdir(path.join(raiz, 'dist'))
  await writeFile(path.join(raiz, 'dist/index.html'), '<p>Juego de prueba</p>')
  servidor = crearServidor({ raiz })
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  const direccion = servidor.address()
  if (!direccion || typeof direccion === 'string') throw new Error('Sin puerto de prueba')
  origen = `http://127.0.0.1:${direccion.port}`
})

afterEach(async () => {
  await new Promise<void>((resolve, reject) => servidor.close((e) => e ? reject(e) : resolve()))
  // Solo se elimina la carpeta ficticia que acaba de crear esta prueba.
  if (!raiz.startsWith(base + path.sep) || !path.basename(raiz).startsWith('fixture-')) throw new Error('Ruta de limpieza no válida')
  await rm(raiz, { recursive: true, force: true })
})

describe('API local aislada', () => {
  it('rechaza origen ajeno, null, Host falso y otra página del mismo sitio sin cambiar el progreso', async () => {
    expect((await poner('Original', '0')).status).toBe(200)
    const antes = await readFile(path.join(raiz, 'datos/progreso.json'), 'utf8')
    for (const headers of [
      { Origin: 'https://ajeno.invalid' }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'same-site' },
    ]) {
      const r = await fetch(`${origen}/api/progreso-beacon`, { method: 'POST', headers, body: progreso('Ajeno') })
      expect(r.status, JSON.stringify(headers)).toBe(403)
    }
    // fetch normaliza Host: se usa el cliente HTTP nativo para probar esta autoridad.
    const codigoHost = await new Promise<number>((resolve, reject) => {
      const req = request(`${origen}/api/ping`, { headers: { Host: 'ajeno.invalid' } }, (res) => { res.resume(); resolve(res.statusCode!) })
      req.on('error', reject)
      req.end()
    })
    expect(codigoHost).toBe(403)
    expect(await readFile(path.join(raiz, 'datos/progreso.json'), 'utf8')).toBe(antes)
  })

  it('acepta beacon propio y exige una versión también al cerrar', async () => {
    const headers = { Origin: origen, 'Sec-Fetch-Site': 'same-origin' }
    expect((await fetch(`${origen}/api/progreso-beacon`, { method: 'POST', headers, body: progreso('Sin versión') })).status).toBe(428)
    const r = await fetch(`${origen}/api/progreso-beacon?base=0`, { method: 'POST', headers, body: progreso('Guardado al cerrar') })
    expect(r.status).toBe(200)
    const guardado = await fetch(`${origen}/api/progreso`)
    const texto = await guardado.text()
    // La versión corresponde al archivo exacto, no a la fecha del sistema.
    expect(guardado.headers.get('X-Version')).toBe(createHash('sha256').update(await readFile(path.join(raiz, 'datos/progreso.json'))).digest('hex'))
    expect(JSON.parse(texto).nombre).toBe('Guardado al cerrar')
  })

  it('dos guardados con la misma base conservan uno y rechazan el otro sin temporales sobrantes', async () => {
    const [a, b] = await Promise.all([poner('A', '0'), poner('B', '0')])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const ganadora = a.status === 200 ? 'A' : 'B'
    expect((await (await fetch(`${origen}/api/progreso`)).json()).nombre).toBe(ganadora)
    const lista = await readdir(path.join(raiz, 'datos'))
    expect(lista.some((f) => f.endsWith('.tmp'))).toBe(false)
    const version = (await fetch(`${origen}/api/progreso`)).headers.get('X-Version')!
    expect((await poner('Nueva', version)).status).toBe(200)
    const copias = await readdir(path.join(raiz, 'datos/copias'))
    expect(JSON.parse(await readFile(path.join(raiz, 'datos/copias', copias[0]), 'utf8')).nombre).toBe(ganadora)
  })

  it('dos informes simultáneos quedan conservados', async () => {
    const informar = (comentario: string) => fetch(`${origen}/api/informes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ejercicio: 'prueba', unidad: 'prueba', tipo: 'error', comentario }),
    })
    expect((await Promise.all([informar('A'), informar('B')])).map((r) => r.status)).toEqual([200, 200])
    const lista = await (await fetch(`${origen}/api/informes`)).json()
    expect(lista.map((i: { comentario: string }) => i.comentario).sort()).toEqual(['A', 'B'])
  })

  it('rechaza JSON incorrecto y progreso vacío de estructura, sin crear archivos', async () => {
    for (const body of ['{', 'null', '[]', '{}', '{"conceptos":null}']) {
      const r = await fetch(`${origen}/api/progreso`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Base': '0' }, body })
      expect(r.status).toBe(400)
    }
    expect((await fetch(`${origen}/api/progreso`)).headers.get('X-Version')).toBe('0')
  })

  it('una ruta malformada devuelve 400 y el servidor sigue funcionando', async () => {
    expect((await fetch(`${origen}/%`)).status).toBe(400)
    expect((await fetch(`${origen}/api/ping`)).status).toBe(200)
    expect((await fetch(`${origen}/%00`)).status).toBe(400)
  })

  it('un fichero corrupto devuelve error sin sustituirlo por un perfil vacío', async () => {
    await mkdir(path.join(raiz, 'datos'))
    await writeFile(path.join(raiz, 'datos/progreso.json'), 'copia dañada')
    const silenciar = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try { expect((await fetch(`${origen}/api/progreso`)).status).toBe(500) }
    finally { silenciar.mockRestore() }
    expect(await readFile(path.join(raiz, 'datos/progreso.json'), 'utf8')).toBe('copia dañada')
  })

  it('ruta SPA desconocida y extensión inexistente no causan recursión ni fuga de archivos', async () => {
    expect(await (await fetch(`${origen}/departamento`)).text()).toContain('Juego de prueba')
    expect((await fetch(`${origen}/no-existe.js`)).status).toBe(404)
    // Con barras invertidas Windows detecta el intento de salir de la carpeta (403); Linux las trata como un nombre de archivo y no lo encuentra (404). En ambos casos no se sirve nada.
    expect([403, 404]).toContain((await fetch(`${origen}/..%5c..%5cprohibido.txt`)).status)
    await rm(path.join(raiz, 'dist/index.html'))
    expect((await fetch(`${origen}/departamento`)).status).toBe(404)
    expect((await fetch(`${origen}/api/ping`)).status).toBe(200)
  })
})

describe('renombrado atómico en Windows', () => {
  const error = (code: string) => Object.assign(new Error(code), { code })

  it('reintenta un bloqueo pasajero del destino (EPERM) y termina renombrando', async () => {
    const renombrar = vi.fn().mockRejectedValueOnce(error('EPERM')).mockRejectedValueOnce(error('EBUSY')).mockResolvedValue(undefined)
    await renombrarConReintentos('a.tmp', 'a.json', renombrar, [0, 0, 0])
    expect(renombrar).toHaveBeenCalledTimes(3)
  })

  it('no reintenta otros errores y propaga el bloqueo si persiste', async () => {
    const otro = vi.fn().mockRejectedValue(error('ENOSPC'))
    await expect(renombrarConReintentos('a.tmp', 'a.json', otro, [0, 0])).rejects.toThrow('ENOSPC')
    expect(otro).toHaveBeenCalledTimes(1)
    const siempre = vi.fn().mockRejectedValue(error('EPERM'))
    await expect(renombrarConReintentos('a.tmp', 'a.json', siempre, [0, 0])).rejects.toThrow('EPERM')
    expect(siempre).toHaveBeenCalledTimes(3)
  })
})
