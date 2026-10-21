import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function instalarVentana() {
  vi.stubGlobal('window', {
    clearTimeout,
    setTimeout,
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
  })
}

async function tareasPendientes() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('guardado del progreso', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    instalarVentana()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('mantiene el cambio pendiente y avisa si el servidor falla; el siguiente cambio lo vuelve a guardar', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const { useTienda } = await import('../src/estado/tienda')

    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Primer intento' }))
    await vi.advanceTimersByTimeAsync(400)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(useTienda.getState().dialogo?.texto).toContain('No se pudo guardar tu progreso')
    expect(fetchMock.mock.calls[0][1]?.body).toContain('Primer intento')

    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Segundo intento' }))
    await vi.advanceTimersByTimeAsync(400)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1]?.body).toContain('Segundo intento')
  })

  it('serializa cambios durante una petición y confirma al final la versión más reciente', async () => {
    let resolver: ((respuesta: { ok: boolean; status: number }) => void) | undefined
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve }))
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const { useTienda } = await import('../src/estado/tienda')

    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Versión antigua' }))
    await vi.advanceTimersByTimeAsync(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Versión final' }))
    await vi.advanceTimersByTimeAsync(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolver?.({ ok: true, status: 200 })
    await tareasPendientes()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1]?.body).toContain('Versión antigua')
    expect(fetchMock.mock.calls[1][1]?.body).toContain('Versión final')
  })

  it('si otra ventana ya guardó (409), no insiste: ofrece recargar y conserva el cambio en pantalla', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409 })
    vi.stubGlobal('fetch', fetchMock)
    const { useTienda } = await import('../src/estado/tienda')

    useTienda.getState().cambiar((p) => ({ ...p, nombre: 'Cambio en la ventana vieja' }))
    await vi.advanceTimersByTimeAsync(400)

    const dialogo = useTienda.getState().dialogo
    expect(dialogo?.texto).toContain('otra ventana')
    expect(dialogo?.siTexto).toBe('Recargar')
    expect(typeof dialogo?.alConfirmar).toBe('function')
    expect(useTienda.getState().progreso.nombre).toBe('Cambio en la ventana vieja')
  })
})
