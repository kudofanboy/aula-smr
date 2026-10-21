import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

function entornoLocal(sendBeacon?: () => boolean) {
  vi.stubEnv('MODE', 'development')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('null', { headers: { 'X-Version': '0' } })))
  const eventos = new Map<string, (e: BeforeUnloadEvent) => void>()
  let guardar: (() => void) | undefined
  vi.stubGlobal('window', {
    clearTimeout: vi.fn(), clearInterval: vi.fn(), setInterval: () => 1,
    setTimeout: (fn: () => void) => { guardar = fn; return 1 },
    addEventListener: (tipo: string, fn: (e: BeforeUnloadEvent) => void) => eventos.set(tipo, fn),
    removeEventListener: (tipo: string) => eventos.delete(tipo),
  })
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('navigator', { sendBeacon })
  return { eventos, guardar: () => guardar?.() }
}

describe('salida durante el guardado local', () => {
  it('avisa durante un PUT en vuelo y conserva el cambio posterior sin enviar un beacon con base obsoleta', async () => {
    const beacon = vi.fn(() => true)
    const entorno = entornoLocal(beacon)
    let completar: ((respuesta: Response) => void) | undefined
    const api = vi.fn()
      .mockResolvedValueOnce(new Response('null', { headers: { 'X-Version': '0' } }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { completar = resolve }))
      .mockResolvedValueOnce(new Response('{"version":"2"}'))
    const fetch = vi.fn((ruta: string, opciones?: RequestInit) => ruta === '/api/ping' ? Promise.resolve(new Response('{}')) : api(ruta, opciones))
    vi.stubGlobal('fetch', fetch)
    const { leerProgreso } = await import('../src/estado/almacen')
    await leerProgreso()
    const { useTienda, iniciarLatido } = await import('../src/estado/tienda')
    const limpiar = iniciarLatido()
    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Primero' }))
    entorno.guardar()
    expect(api).toHaveBeenCalledTimes(2)
    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Más reciente' }))
    const preventDefault = vi.fn()
    entorno.eventos.get('beforeunload')?.({ preventDefault } as unknown as BeforeUnloadEvent)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(beacon).not.toHaveBeenCalled()

    completar?.(new Response('{"version":"1"}'))
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(3))
    expect(JSON.parse(api.mock.calls[2][1].body).nombre).toBe('Más reciente')
    expect(api.mock.calls[2][1].headers['X-Base']).toBe('1')
    preventDefault.mockClear()
    entorno.eventos.get('beforeunload')?.({ preventDefault } as unknown as BeforeUnloadEvent)
    expect(preventDefault).not.toHaveBeenCalled()
    limpiar()
  })

  it.each(['rechazo', 'excepción', 'ausencia'])('avisa si el beacon falla por %s', async (fallo) => {
    const beacon = vi.fn(() => { if (fallo === 'excepción') throw new Error('No disponible'); return false })
    const entorno = entornoLocal(fallo === 'ausencia' ? undefined : beacon)
    const { leerProgreso } = await import('../src/estado/almacen')
    await leerProgreso()
    const { useTienda, iniciarLatido } = await import('../src/estado/tienda')
    const limpiar = iniciarLatido()
    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Pendiente' }))
    const preventDefault = vi.fn()
    entorno.eventos.get('beforeunload')?.({ preventDefault } as unknown as BeforeUnloadEvent)
    expect(beacon).toHaveBeenCalledTimes(fallo === 'ausencia' ? 0 : 1)
    expect(preventDefault).toHaveBeenCalledOnce()
    limpiar()
  })

  it('avisa sin enviar si aún no se ha leído la versión base', async () => {
    const beacon = vi.fn(() => true)
    const entorno = entornoLocal(beacon)
    const { useTienda, iniciarLatido } = await import('../src/estado/tienda')
    const limpiar = iniciarLatido()
    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Sin base' }))
    const preventDefault = vi.fn()
    entorno.eventos.get('beforeunload')?.({ preventDefault } as unknown as BeforeUnloadEvent)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(beacon).not.toHaveBeenCalled()
    limpiar()
  })

  it('avisa tras un conflicto conocido sin enviar otro beacon que sería rechazado', async () => {
    const beacon = vi.fn(() => true)
    const entorno = entornoLocal(beacon)
    const { leerProgreso } = await import('../src/estado/almacen')
    await leerProgreso()
    const { useTienda, iniciarLatido } = await import('../src/estado/tienda')
    const limpiar = iniciarLatido()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 409 })))
    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Copia obsoleta' }))
    entorno.guardar()
    await vi.waitFor(() => expect(useTienda.getState().dialogo?.bloqueante).toBe(true))
    const preventDefault = vi.fn()
    entorno.eventos.get('beforeunload')?.({ preventDefault } as unknown as BeforeUnloadEvent)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(beacon).not.toHaveBeenCalled()
    limpiar()
  })

  it('conserva el beacon de salida cuando no hay otro guardado ni error conocido', async () => {
    const beacon = vi.fn(() => true)
    const entorno = entornoLocal(beacon)
    const { leerProgreso } = await import('../src/estado/almacen')
    await leerProgreso()
    const { useTienda, iniciarLatido } = await import('../src/estado/tienda')
    const limpiar = iniciarLatido()
    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Último cambio' }))
    const preventDefault = vi.fn()
    entorno.eventos.get('beforeunload')?.({ preventDefault } as unknown as BeforeUnloadEvent)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(beacon.mock.calls[0][0]).toBe('/api/progreso-beacon?base=0')
    expect(JSON.parse(beacon.mock.calls[0][1]).nombre).toBe('Último cambio')
    limpiar()
  })
})
