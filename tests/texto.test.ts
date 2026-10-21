import { describe, expect, it } from 'vitest'
import { bloques, terminosCitados, textoPlano, trozos } from '../src/contenido/texto'

describe('formato ligero de los textos (v2)', () => {
  it('separa negrita, términos del glosario y texto normal', () => {
    expect(trozos('Un **nodo** tiene [[direccion-red|dirección propia]] y una [[mac]].')).toEqual([
      { tipo: 'texto', texto: 'Un ' }, { tipo: 'texto', texto: 'nodo', negrita: true }, { tipo: 'texto', texto: ' tiene ' },
      { tipo: 'termino', id: 'direccion-red', texto: 'dirección propia' }, { tipo: 'texto', texto: ' y una ' },
      { tipo: 'termino', id: 'mac', texto: 'mac' }, { tipo: 'texto', texto: '.' },
    ])
  })

  it('admite un término del glosario dentro de una negrita', () => {
    expect(trozos('- **[[recurso|Recursos]]**: impresoras'.slice(2))).toEqual([
      { tipo: 'termino', id: 'recurso', texto: 'Recursos', negrita: true }, { tipo: 'texto', texto: ': impresoras' },
    ])
    expect(textoPlano('**[[recurso|Recursos]]** y **más**')).toBe('Recursos y más')
    expect(terminosCitados('**[[recurso|Recursos]]**')).toEqual(['recurso'])
  })

  it('agrupa las líneas que empiezan por "- " en una lista', () => {
    const b = bloques('Dos rasgos:\n- **Alcance** limitado\n- Velocidad alta\nFin.')
    expect(b.map((x) => x.tipo)).toEqual(['parrafo', 'lista', 'parrafo'])
    expect(b[1].tipo === 'lista' && b[1].elementos.length).toBe(2)
  })

  it('quita las marcas para buscar o mostrar en botones', () => {
    expect(textoPlano('El **switch** usa la [[mac|dirección MAC]] de cada [[trama]].')).toBe('El switch usa la dirección MAC de cada trama.')
    expect(terminosCitados('[[mac|MAC]] y [[trama]] y **negrita**')).toEqual(['mac', 'trama'])
  })

  it('admite *cursiva* sin confundirla con la **negrita**', () => {
    expect(trozos('LAN viene de *Local Area Network* y es **una *red* local**.')).toEqual([
      { tipo: 'texto', texto: 'LAN viene de ' }, { tipo: 'texto', texto: 'Local Area Network', cursiva: true }, { tipo: 'texto', texto: ' y es ' },
      { tipo: 'texto', texto: 'una ', negrita: true }, { tipo: 'texto', texto: 'red', negrita: true, cursiva: true }, { tipo: 'texto', texto: ' local', negrita: true },
      { tipo: 'texto', texto: '.' },
    ])
    expect(textoPlano('Una *pila* (**stack**)')).toBe('Una pila (stack)')
  })
})
