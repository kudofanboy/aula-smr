// API local. La cola mantiene juntos la lectura, la versión y cada escritura.
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

const MAX_CUERPO = 5 * 1024 * 1024
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
}

class ErrorPeticion extends Error {
  constructor(codigo, mensaje) { super(mensaje); this.codigo = codigo }
}

function objeto(valor) { return valor !== null && typeof valor === 'object' && !Array.isArray(valor) }

function parsear(texto) {
  try { return JSON.parse(texto) } catch { throw new ErrorPeticion(400, 'JSON no válido') }
}

async function leerCuerpo(req) {
  let total = 0
  const partes = []
  for await (const trozo of req) {
    total += trozo.length
    if (total > MAX_CUERPO) throw new ErrorPeticion(413, 'Cuerpo demasiado grande')
    partes.push(trozo)
  }
  return Buffer.concat(partes).toString('utf8')
}

/**
 * En Windows, `rename` sobre un archivo recién escrito puede fallar con EPERM/EACCES/EBUSY si otro proceso
 * (antivirus, indexador…) lo tiene abierto un instante. Se reintenta unas pocas veces con espera creciente;
 * cualquier otro error, o el mismo tras agotar los intentos, se propaga sin ocultarlo.
 */
export async function renombrarConReintentos(origen, destino, renombrar = fs.rename, esperas = [20, 50, 100, 200, 400]) {
  for (let intento = 0; ; intento++) {
    try {
      return await renombrar(origen, destino)
    } catch (e) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(e?.code) || intento >= esperas.length) throw e
      await new Promise((r) => setTimeout(r, esperas[intento]))
    }
  }
}

async function escribirAtomico(fichero, texto) {
  const temporal = `${fichero}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(temporal, texto, { encoding: 'utf8', flag: 'wx' })
    await renombrarConReintentos(temporal, fichero)
  } finally {
    await fs.unlink(temporal).catch((e) => { if (e.code !== 'ENOENT') throw e })
  }
}

function json(res, codigo, datos, cabeceras = {}) {
  res.writeHead(codigo, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store', ...cabeceras })
  res.end(JSON.stringify(datos))
}

/** Rechaza páginas ajenas y Host arbitrarios, aunque la escucha sea solo local. */
function comprobarOrigen(req) {
  const puerto = req.socket.localPort
  const host = req.headers.host
  if (host !== `127.0.0.1:${puerto}` && host !== `localhost:${puerto}`)
    throw new ErrorPeticion(403, 'Host no permitido')
  const origen = req.headers.origin
  if (origen !== undefined && origen !== `http://${host}`)
    throw new ErrorPeticion(403, 'Origen no permitido')
  const sitio = req.headers['sec-fetch-site']
  if (sitio !== undefined && sitio !== 'same-origin' && sitio !== 'none')
    throw new ErrorPeticion(403, 'Petición de otra página no permitida')
}

export function crearServidor({ raiz, datos = path.join(raiz, 'datos'), alLatir = () => {} }) {
  const dist = path.join(raiz, 'dist')
  const contenido = path.join(raiz, 'contenido')
  const progreso = path.join(datos, 'progreso.json')
  const informes = path.join(datos, 'informes.json')
  const copias = path.join(datos, 'copias')
  let cola = Promise.resolve()
  const enOrden = (operacion) => {
    const tarea = cola.then(operacion)
    cola = tarea.catch(() => undefined)
    return tarea
  }
  const version = (texto) => createHash('sha256').update(texto).digest('hex')
  async function instantanea() {
    try {
      const texto = await fs.readFile(progreso, 'utf8')
      return { texto, version: version(texto) }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
      return { texto: null, version: '0' }
    }
  }
  async function copiaDiaria() {
    await fs.mkdir(copias, { recursive: true })
    const destino = path.join(copias, `progreso-${new Date().toISOString().slice(0, 10)}.json`)
    try { await fs.copyFile(progreso, destino, fs.constants.COPYFILE_EXCL) }
    catch (e) { if (e.code !== 'ENOENT' && e.code !== 'EEXIST') throw e }
    const lista = (await fs.readdir(copias)).filter((f) => /^progreso-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
    for (const vieja of lista.slice(0, Math.max(0, lista.length - 7))) await fs.unlink(path.join(copias, vieja))
  }
  async function leerContenido() {
    const unidades = []
    const errores = []
    for (const modulo of await fs.readdir(contenido, { withFileTypes: true })) {
      if (!modulo.isDirectory()) continue
      for (const fichero of await fs.readdir(path.join(contenido, modulo.name))) {
        if (!fichero.endsWith('.json')) continue
        try { unidades.push(JSON.parse(await fs.readFile(path.join(contenido, modulo.name, fichero), 'utf8'))) }
        catch (e) { errores.push(`${modulo.name}/${fichero}: ${e.message}`) }
      }
    }
    const leer = async (nombre, defecto) => {
      try { return JSON.parse(await fs.readFile(path.join(contenido, nombre), 'utf8')) }
      catch (e) { errores.push(`${nombre}: ${e.message}`); return defecto }
    }
    return { unidades, calendario: await leer('calendario.json', []), curso: await leer('curso.json', null), errores }
  }
  async function servirEstatico(res, relativa) {
    let fichero = path.resolve(dist, `.${path.sep}${relativa}`)
    if (!fichero.startsWith(dist + path.sep)) throw new ErrorPeticion(403, 'Ruta no permitida')
    try {
      // realpath impide también salir mediante enlaces dentro de dist/.
      const [baseReal, destinoReal] = await Promise.all([fs.realpath(dist), fs.realpath(fichero)])
      if (!destinoReal.startsWith(baseReal + path.sep)) throw new ErrorPeticion(403, 'Ruta no permitida')
      fichero = destinoReal
      if (!(await fs.stat(fichero)).isFile()) throw new ErrorPeticion(404, 'No encontrado')
      const cuerpo = await fs.readFile(fichero)
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(fichero).toLowerCase()] ?? 'application/octet-stream' })
      res.end(cuerpo)
    } catch (e) {
      if (e.codigo === 403) throw e
      if (!path.extname(relativa) && relativa !== 'index.html') return servirEstatico(res, 'index.html')
      throw new ErrorPeticion(404, 'No encontrado')
    }
  }
  async function manejar(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
    try {
      comprobarOrigen(req)
      let url, ruta
      try { url = new URL(req.url, 'http://127.0.0.1'); ruta = decodeURIComponent(url.pathname) }
      catch { throw new ErrorPeticion(400, 'Ruta no válida') }
      if (ruta.includes('\0')) throw new ErrorPeticion(400, 'Ruta no válida')
      if (ruta === '/api/ping' && req.method === 'GET') {
        alLatir()
        return json(res, 200, { ok: true, app: 'juego-smr' })
      }
      if (ruta === '/api/contenido' && req.method === 'GET') return json(res, 200, await leerContenido())
      if (ruta === '/api/progreso' && req.method === 'GET') {
        const guardado = await enOrden(instantanea)
        return json(res, 200, guardado.texto === null ? null : JSON.parse(guardado.texto), { 'X-Version': guardado.version })
      }
      const beacon = ruta === '/api/progreso-beacon' && req.method === 'POST'
      if ((ruta === '/api/progreso' && req.method === 'PUT') || beacon) {
        const tipo = req.headers['content-type']?.split(';')[0].trim().toLowerCase()
        if (tipo !== 'application/json' && !(beacon && tipo === 'text/plain')) throw new ErrorPeticion(415, 'Se requiere JSON')
        const texto = await leerCuerpo(req)
        const nuevo = parsear(texto)
        if (!objeto(nuevo) || !objeto(nuevo.conceptos)) throw new ErrorPeticion(400, 'Progreso no válido')
        const base = req.headers['x-base'] ?? url.searchParams.get('base')
        if (typeof base !== 'string' || !base) throw new ErrorPeticion(428, 'Recarga el juego antes de guardar')
        const resultado = await enOrden(async () => {
          if (base !== (await instantanea()).version) throw new ErrorPeticion(409, 'El progreso se guardó desde otra ventana.')
          await fs.mkdir(datos, { recursive: true })
          await copiaDiaria()
          await escribirAtomico(progreso, texto)
          return { ok: true, version: version(texto) }
        })
        return json(res, 200, resultado)
      }
      if (ruta === '/api/informes' && req.method === 'POST') {
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ErrorPeticion(415, 'Se requiere JSON')
        const nuevo = parsear(await leerCuerpo(req))
        if (!objeto(nuevo) || !['error', 'no-entiendo'].includes(nuevo.tipo) || typeof nuevo.ejercicio !== 'string' || typeof nuevo.unidad !== 'string' || typeof nuevo.comentario !== 'string')
          throw new ErrorPeticion(400, 'Informe no válido')
        await enOrden(async () => {
          await fs.mkdir(datos, { recursive: true })
          let lista = []
          try { lista = JSON.parse(await fs.readFile(informes, 'utf8')) } catch (e) { if (e.code !== 'ENOENT') throw e }
          if (!Array.isArray(lista)) throw new Error('Archivo de informes no válido')
          lista.push({ ...nuevo, fecha: new Date().toISOString(), estado: 'abierto' })
          await escribirAtomico(informes, JSON.stringify(lista, null, 2))
        })
        return json(res, 200, { ok: true })
      }
      if (ruta === '/api/informes' && req.method === 'GET') {
        const lista = await enOrden(async () => {
          try { return JSON.parse(await fs.readFile(informes, 'utf8')) } catch (e) { if (e.code !== 'ENOENT') throw e; return [] }
        })
        return json(res, 200, lista)
      }
      if (ruta.startsWith('/api/')) return json(res, 404, { error: 'API desconocida' })
      if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' })
      await servirEstatico(res, ruta === '/' ? 'index.html' : ruta.slice(1))
    } catch (e) {
      if (!e.codigo) console.error('Error del servidor local:', e)
      if (!res.headersSent && !res.destroyed) json(res, e.codigo ?? 500, { error: e.codigo ? e.message : 'No se pudo completar la operación' })
    }
  }
  return http.createServer({ requestTimeout: 30_000, headersTimeout: 15_000 }, manejar)
}
