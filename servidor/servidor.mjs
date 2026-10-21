// Arranque personal: escucha solo en 127.0.0.1, abre Edge y se apaga sin latido.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { crearServidor } from './app.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(RAIZ, 'dist')
const DATOS = process.env.JUEGO_SMR_DATOS ? path.resolve(process.env.JUEGO_SMR_DATOS) : path.join(RAIZ, 'datos')
const PUERTO_BASE = Number(process.env.JUEGO_SMR_PUERTO) || 4417
const SIN_SENAL_MS = 45_000
const modoDev = process.argv.includes('--dev')
let ultimaSenal = Date.now()

async function esNuestro(puerto) {
  try {
    const r = await fetch(`http://127.0.0.1:${puerto}/api/ping`, { signal: AbortSignal.timeout(800) })
    return (await r.json()).app === 'juego-smr'
  } catch {
    return false
  }
}

function abrirVentana(puerto) {
  const candidatos = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  const edge = candidatos.find((c) => existsSync(c))
  const url = `http://127.0.0.1:${puerto}/`
  if (!edge) {
    console.log(`No encuentro Edge. Abre esta dirección en tu navegador: ${url}`)
    return
  }
  const perfil = path.join(DATOS, 'perfil-edge')
  spawn(edge, [`--app=${url}`, `--user-data-dir=${perfil}`, '--no-first-run', '--window-size=1280,860'], {
    detached: true, stdio: 'ignore',
  }).unref()
}

function escuchar(puerto) {
  return new Promise((resolve, reject) => {
    const srv = crearServidor({ raiz: RAIZ, datos: DATOS, alLatir: () => { ultimaSenal = Date.now() } })
    srv.once('error', reject)
    srv.listen(puerto, '127.0.0.1', () => resolve(srv))
  })
}

async function main() {
  if (!modoDev && !existsSync(path.join(DIST, 'index.html'))) {
    console.error('Falta la app compilada (dist/). Ejecuta "npm run build" en la carpeta del juego.')
    process.exit(1)
  }
  for (let puerto = PUERTO_BASE; puerto < PUERTO_BASE + 10; puerto++) {
    if (await esNuestro(puerto)) {
      // Ya hay un servidor del juego funcionando: solo abrimos otra ventana.
      if (!modoDev) abrirVentana(puerto)
      console.log(`El juego ya estaba en marcha en el puerto ${puerto}.`)
      return
    }
    try {
      await escuchar(puerto)
      console.log(`Aula SMR en http://127.0.0.1:${puerto}/  (no cierres esta ventana mientras juegas)`)
      if (!modoDev) {
        abrirVentana(puerto)
        setInterval(() => {
          if (Date.now() - ultimaSenal > SIN_SENAL_MS) {
            console.log('La ventana del juego se ha cerrado. Apagando servidor.')
            process.exit(0)
          }
        }, 5_000)
      }
      return
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e
    }
  }
  console.error(`No hay ningún puerto libre entre ${PUERTO_BASE} y ${PUERTO_BASE + 9}.`)
  process.exit(1)
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
