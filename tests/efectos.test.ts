import { describe, expect, it } from 'vitest'
import { direccionNavegacion } from '../src/ui/efectos'

describe('dirección de las transiciones', () => {
  it('entrar más adentro desliza hacia delante y volver, hacia atrás', () => {
    expect(direccionNavegacion('inicio', 'departamento')).toBe('adelante')
    expect(direccionNavegacion('departamento', 'sesion')).toBe('adelante')
    expect(direccionNavegacion('sesion', 'resultado')).toBe('adelante')
    expect(direccionNavegacion('resultado', 'departamento')).toBe('atras')
    expect(direccionNavegacion('departamento', 'inicio')).toBe('atras')
  })

  it('cambiar entre secciones del mismo nivel es lateral', () => {
    expect(direccionNavegacion('inicio', 'agenda')).toBe('lateral')
    expect(direccionNavegacion('encargos', 'expediente')).toBe('lateral')
    expect(direccionNavegacion('departamento', 'departamento')).toBe('lateral')
  })

  it('una pantalla desconocida no rompe nada', () => {
    expect(direccionNavegacion('inicio', 'nueva-pantalla')).toBe('adelante')
    expect(direccionNavegacion('nueva-pantalla', 'inicio')).toBe('atras')
  })
})
