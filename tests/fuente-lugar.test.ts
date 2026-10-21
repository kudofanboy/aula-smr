import { describe, expect, it } from 'vitest'
import { lugarEnFuente } from '../src/contenido/texto'

describe('lugarEnFuente', () => {
  it('cita la página de un documento por defecto', () => {
    expect(lugarEnFuente({ ruta: 'docs/ejemplo.pdf' }, 3)).toBe(', pág. 3')
  })
  it('no inventa una página para una web', () => {
    expect(lugarEnFuente({ ruta: 'https://example.org/documentacion/' }, 1)).toBe('')
  })
  it('cita el apartado cuando la fuente lo indica', () => {
    expect(lugarEnFuente({ ruta: 'docs/ejemplo.html', localizador: 'apartado' }, 7)).toBe(', apartado 7')
  })
  it('respeta un localizador explícito aunque la ruta sea una URL', () => {
    expect(lugarEnFuente({ ruta: 'https://example.org/doc', localizador: 'pagina' }, 2)).toBe(', pág. 2')
  })
  it('sin fuente conocida, cita la página', () => {
    expect(lugarEnFuente(undefined, 4)).toBe(', pág. 4')
  })
})
