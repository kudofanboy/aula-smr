import { describe, expect, it } from 'vitest'
import { actuarLaboratorio, agregarPrueba, cerrarLaboratorio, confirmarDiagnostico, diagnosticoSostenido,
  EstadoLaboratorioSchema, evidenciaLaboratorio, hipotesisCompatibles, nuevoLaboratorio, pilotosLaboratorio, reiniciarInvestigacion, reiniciarVerificacion, resultadoPrueba, type EstadoLaboratorio } from '../src/motor/laboratorio'
import { validarCopiaProgreso } from '../src/motor/copias'
import { progresoVacio } from '../src/motor/progreso'

function investigar(variante: EstadoLaboratorio['variante']) {
  let s = { ...nuevoLaboratorio(), variante }
  for (const [a, b] of [['PC1','PC2'], ['PC4','PC5'], ['PC1','PC5']]) s = agregarPrueba(s, a, b)
  return { ...s, causa: variante === 'rama' ? 'switch-S2' : variante === 'raiz' ? 'switch-R' : 'cable-PC4', justificacion: variante } as EstadoLaboratorio
}
describe('laboratorio de diagnóstico de dos plantas', () => {
  it.each(['rama', 'raiz', 'cable'] as const)('distingue %s y exige actuar y verificar antes del cierre', (variante) => {
    let s = investigar(variante)
    expect(hipotesisCompatibles(s)).toEqual([s.causa])
    expect(diagnosticoSostenido(s)).toBe(true)
    expect(cerrarLaboratorio(s)).toBe(s)
    s = confirmarDiagnostico(s)
    expect(s.fase).toBe('actuar')
    s = actuarLaboratorio(s)
    expect(s.fase).toBe('verificar')
    expect(cerrarLaboratorio(s)).toBe(s)
    const fallida = s.pruebas.find((p) => !p.ok)!
    s = agregarPrueba(s, fallida.a, fallida.b)
    s = agregarPrueba(s, 'PC1', 'PC4')
    s = cerrarLaboratorio(s)
    expect(s.fase).toBe('completado')
    expect(EstadoLaboratorioSchema.safeParse(s).success).toBe(true)
    expect(evidenciaLaboratorio(s)).toContain('antes PC4→PC5')
    expect(evidenciaLaboratorio(s)).toContain('Verificación: completada')
  })
  it('dos pruebas redundantes no bastan para elegir una causa', () => {
    let s = agregarPrueba(nuevoLaboratorio(), 'PC1', 'PC2')
    expect(agregarPrueba(s, 'PC2', 'PC1')).toBe(s)
    s = agregarPrueba(s, 'PC1', 'PC3')
    s = { ...s, causa: 'switch-S2', justificacion: 'rama' }
    expect(hipotesisCompatibles(s).length).toBeGreaterThan(1)
    expect(confirmarDiagnostico(s).fase).toBe('investigar')
  })
  it('una causa acertada con explicación contradictoria no avanza', () => {
    const s = { ...investigar('raiz'), justificacion: 'rama' as const }
    expect(confirmarDiagnostico(s).fase).toBe('investigar')
  })
  it('pilotos y comunicación cambian de forma coherente al actuar', () => {
    const s = investigar('rama')
    expect(pilotosLaboratorio(s).PC4).toBe(false)
    const despues = actuarLaboratorio(confirmarDiagnostico(s))
    expect(pilotosLaboratorio(despues).PC4).toBe(true)
    expect(resultadoPrueba('rama', 'PC4', 'PC5')).toBe(false)
    expect(resultadoPrueba('rama', 'PC4', 'PC5', true)).toBe(true)
  })
  it('no cierra solo con pruebas dentro de una planta', () => {
    let s = actuarLaboratorio(confirmarDiagnostico(investigar('rama')))
    s = agregarPrueba(s, 'PC4', 'PC5')
    s = agregarPrueba(s, 'PC1', 'PC2')
    expect(cerrarLaboratorio(s)).toBe(s)
  })
  it('permite recuperarse al agotar pruebas de verificación sin repetir una pareja fallida', () => {
    let s = actuarLaboratorio(confirmarDiagnostico(investigar('rama')))
    for (const [a,b] of [['PC1','PC2'],['PC1','PC3'],['PC2','PC3'],['PC1','PC4'],['PC2','PC4'],['PC3','PC4']]) s = agregarPrueba(s,a,b)
    expect(cerrarLaboratorio(s).fase).toBe('verificar')
    s = reiniciarVerificacion(s)
    expect(s.pruebas.every((p) => !p.despues)).toBe(true)
    s = agregarPrueba(s,'PC4','PC5')
    s = agregarPrueba(s,'PC1','PC5')
    expect(cerrarLaboratorio(s).fase).toBe('completado')
  })
  it('exige observar una comunicación afectada antes de pasar a actuar', () => {
    let s = agregarPrueba(nuevoLaboratorio(), 'PC1', 'PC2')
    s = agregarPrueba(s, 'PC1', 'PC3')
    s = { ...s, pilotos: true, causa: 'switch-S2', justificacion: 'rama' }
    expect(hipotesisCompatibles(s)).toEqual(['switch-S2'])
    expect(confirmarDiagnostico(s).fase).toBe('investigar')
  })
  it('permite investigar de nuevo si las seis parejas elegidas no incluían el equipo averiado', () => {
    let s: EstadoLaboratorio = { ...nuevoLaboratorio(), variante: 'cable', pilotos: true, ayudas: 1 }
    for (const [a,b] of [['PC1','PC2'],['PC1','PC3'],['PC1','PC5'],['PC2','PC3'],['PC2','PC5'],['PC3','PC5']]) s = agregarPrueba(s,a,b)
    expect(s.pruebas.every((p) => p.ok)).toBe(true)
    expect(agregarPrueba(s,'PC4','PC5')).toBe(s)
    s = reiniciarInvestigacion(s)
    expect(s.ayudas).toBe(1)
    expect(s.variante).toBe('cable')
    s = agregarPrueba(s,'PC4','PC5')
    s = agregarPrueba(s,'PC1','PC5')
    s = { ...s, causa: 'cable-PC4', justificacion: 'cable' }
    expect(confirmarDiagnostico(s).fase).toBe('actuar')
  })
  it('rechaza una copia con parejas duplicadas, aunque simule una verificación', () => {
    const s = investigar('rama')
    const prueba = { a: 'PC1', b: 'PC4', ok: false, despues: false }
    const corrupto = { ...s, fase: 'completado', pilotos: true, completado: new Date().toISOString(), pruebas: [prueba, prueba, { ...prueba, ok: true, despues: true }, { ...prueba, ok: true, despues: true }] }
    expect(EstadoLaboratorioSchema.safeParse(corrupto).success).toBe(false)
  })
  it('rota averías y conserva las entregas anteriores al importar', () => {
    const p = progresoVacio()
    p.encargos.legacy = { recibido: '2026-10-01', leido: true, respuestas: [0, 1, 2], completado: '2026-10-01' }
    p.laboratorios = { 'redes-dos-plantas': investigar('rama') }
    expect(validarCopiaProgreso(p).encargos).toEqual(p.encargos)
    expect(nuevoLaboratorio(p.laboratorios['redes-dos-plantas']).variante).toBe('raiz')
    expect(nuevoLaboratorio({ ...nuevoLaboratorio(), variante: 'cable' }).variante).toBe('rama')
    const corrupto = { ...p, laboratorios: { x: { ...investigar('rama'), fase: 'completado', completado: new Date().toISOString() } } }
    expect(() => validarCopiaProgreso(corrupto)).toThrow()
  })
})
