import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

describe('salida durante el guardado web', () => {
  it('guarda sin esperar al retardo y avisa al cerrar mientras el bloqueo sigue pendiente', async () => {
    vi.stubEnv('MODE', 'web')
    const eventos = new Map<string, (e: BeforeUnloadEvent) => void>()
    vi.stubGlobal('window', {
      clearTimeout, clearInterval,
      addEventListener: (tipo: string, fn: (e: BeforeUnloadEvent) => void) => eventos.set(tipo, fn),
      removeEventListener: (tipo: string) => eventos.delete(tipo),
    })
    const eventosDocumento = new Map<string, () => void>()
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: (tipo: string, fn: () => void) => eventosDocumento.set(tipo, fn),
      removeEventListener: (tipo: string) => eventosDocumento.delete(tipo),
    })
    let guardado: string | null = null
    vi.stubGlobal('localStorage', { getItem: () => guardado, setItem: (_clave: string, valor: string) => { guardado = valor } })
    let completar: (() => void) | undefined
    const request = vi.fn((_clave: string, fn: () => void) => new Promise<void>((resolve) => { completar = () => { fn(); resolve() } }))
    vi.stubGlobal('navigator', { locks: { request } })
    const { useTienda, iniciarLatido } = await import('../src/estado/tienda')
    const limpiar = iniciarLatido()
    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Cambio pendiente' }))
    expect(request).toHaveBeenCalledOnce()
    const preventDefault = vi.fn()
    eventos.get('beforeunload')?.({ preventDefault } as unknown as BeforeUnloadEvent)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(guardado).toBeNull()
    expect(eventosDocumento.has('visibilitychange')).toBe(true)

    completar?.()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(JSON.parse(guardado!).nombre).toBe('Cambio pendiente')
    preventDefault.mockClear()
    eventos.get('beforeunload')?.({ preventDefault } as unknown as BeforeUnloadEvent)
    expect(preventDefault).not.toHaveBeenCalled()
    limpiar()
    expect(eventosDocumento.size).toBe(0)
    expect(eventos.size).toBe(0)
  })
})
