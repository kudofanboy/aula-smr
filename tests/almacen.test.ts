import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../src/motor/items'

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules() })

function navegador(datos = new Map<string, string>()) {
  vi.stubEnv('MODE', 'compartir')
  vi.stubGlobal('localStorage', {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => { datos.set(clave, valor) },
  })
  return datos
}

describe('errores de lectura y escritura', () => {
  it('no interpreta un HTTP 500 como progreso y conserva la versión anterior', async () => {
    const bodyError = vi.fn()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{"conceptos":{}}', { headers: { 'X-Version': 'anterior' } }))
      .mockResolvedValueOnce({ ok: false, status: 500, json: bodyError, headers: new Headers() }))
    const almacen = await import('../src/estado/almacen')
    await almacen.leerProgreso()
    await expect(almacen.leerProgreso()).rejects.toThrow('500')
    expect(bodyError).not.toHaveBeenCalled()
    expect(almacen.versionDelProgreso()).toBe('anterior')
  })

  it('la corrupción web se conserva y bloquea la carga en vez de empezar de cero', async () => {
    const datos = navegador(new Map([['aula-smr-public-progreso', '{dañado']]))
    const almacen = await import('../src/estado/almacen')
    await expect(almacen.leerProgreso()).rejects.toThrow('No se pudo leer')
    expect(datos.get('aula-smr-public-progreso')).toBe('{dañado')
  })

  it('solo la ausencia de un archivo de progreso representa un perfil nuevo', async () => {
    navegador()
    const almacen = await import('../src/estado/almacen')
    expect(await almacen.leerProgreso()).toBeNull()
  })

  it('una pestaña obsoleta no sobrescribe el progreso que acaba de guardar otra', async () => {
    const datos = navegador(new Map([['aula-smr-public-progreso', '{"conceptos":{},"nombre":"Inicial"}']]))
    const a = await import('../src/estado/almacen')
    await a.leerProgreso()
    vi.resetModules()
    const b = await import('../src/estado/almacen')
    await b.leerProgreso()
    await a.guardarProgreso({ conceptos: {}, nombre: 'Ventana A' })
    await expect(b.guardarProgreso({ conceptos: {}, nombre: 'Ventana B' })).rejects.toBeInstanceOf(b.ConflictoDeGuardado)
    expect(JSON.parse(datos.get('aula-smr-public-progreso')!).nombre).toBe('Ventana A')
  })

  it('coordina guardados simultáneos con Web Locks y solo uno modifica la copia común', async () => {
    navegador()
    let cola = Promise.resolve()
    const request = vi.fn((_nombre: string, fn: () => void) => {
      const tarea = cola.then(fn)
      cola = tarea.catch(() => undefined)
      return tarea
    })
    vi.stubGlobal('navigator', { locks: { request } })
    const a = await import('../src/estado/almacen')
    await a.leerProgreso()
    vi.resetModules()
    const b = await import('../src/estado/almacen')
    await b.leerProgreso()
    const resultados = await Promise.allSettled([a.guardarProgreso({ conceptos: {}, xp: 1 }), b.guardarProgreso({ conceptos: {}, xp: 2 })])
    expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('si el informe falla por HTTP no retira el ejercicio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    const { useTienda } = await import('../src/estado/tienda')
    const item = { clave: 'ejercicio-prueba', unidadId: 'unidad-prueba', vista: {} } as Item
    await expect(useTienda.getState().informar(item, 'error', 'Aviso')).rejects.toThrow('500')
    expect(useTienda.getState().progreso.ocultos).not.toContain(item.clave)
  })

  it('un error de cuota al guardar informes se propaga para que el alumno pueda reintentar', async () => {
    navegador()
    vi.stubGlobal('localStorage', { getItem: () => '[]', setItem: () => { throw new Error('Cuota agotada') } })
    const almacen = await import('../src/estado/almacen')
    await expect(almacen.enviarInforme({ comentario: 'Aviso' })).rejects.toThrow('No se pudo guardar')
  })

  it('un historial de informes con tipo incorrecto no rompe su consulta', async () => {
    navegador(new Map([['aula-smr-public-informes', 'null']]))
    const almacen = await import('../src/estado/almacen')
    expect(almacen.informesGuardados()).toEqual([])
    await expect(almacen.enviarInforme({ comentario: 'Aviso' })).rejects.toThrow('No se pudo guardar')
  })
})

describe('entrada directa al recorrido docente', () => {
  it('solo se abre con ?profesor&recorrido=1, nunca sin el modo profesorado', async () => {
    const { abreRecorridoDirecto } = await import('../src/estado/almacen')
    expect(abreRecorridoDirecto('?profesor&recorrido=1')).toBe(true)
    expect(abreRecorridoDirecto('?recorrido=1&profesor')).toBe(true)
    expect(abreRecorridoDirecto('?profesor')).toBe(false)
    expect(abreRecorridoDirecto('?recorrido=1')).toBe(false)
    expect(abreRecorridoDirecto('?profesor&recorrido=0')).toBe(false)
    expect(abreRecorridoDirecto('')).toBe(false)
  })
})
