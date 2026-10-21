import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Unidad, type Tablero } from '../src/contenido/esquema'
import { opcionTablero } from '../src/motor/encargos'
import { CONEXION, ESCENA, MAQUINA, cablesEsperados, causaReal, diagnosticoMaquina, errorDeConexion, errorDeDiagnostico, errorDeEscena, errorDeMaquina, evaluarConexion, evaluarEscena, evaluarMaquina, pilotos, pruebaComunicacion, revisionCableado, veredictoEscena } from '../src/motor/tableros'

const u = Unidad.parse(JSON.parse(readFileSync('contenido/REDES/DEMO.json', 'utf8')))
const cableado = u.encargos[0].pasos[0]
const diagnostico = u.encargos[0].pasos[1]
const conectar = cableado.tablero
const investigar = diagnostico.tablero
if (conectar?.tipo !== 'conectar' || investigar?.tipo !== 'diagnostico') throw new Error('Faltan tableros demo')
const completos = [...cablesEsperados(conectar)].map(c => c.split('|') as [string, string])

describe('tableros conectados a los encargos demo', () => {
  it('la estrella completa lleva a una decisión correcta y los cables pendientes no', () => {
    expect(errorDeConexion(conectar)).toBeUndefined()
    expect(evaluarConexion(conectar, completos)).toBe(CONEXION.CORRECTA)
    expect(evaluarConexion(conectar, completos.map(([a, b]) => [b, a]))).toBe(CONEXION.CORRECTA)
    for (const cables of [[], completos.slice(1), [...completos, ['PC1', 'PC2'] as [string, string]]]) {
      const valor = evaluarConexion(conectar, cables)
      expect(cableado.opciones[opcionTablero(cableado, valor)!].correcta).toBe(false)
    }
    expect(cableado.opciones[opcionTablero(cableado, CONEXION.CORRECTA)!].correcta).toBe(true)
    expect(revisionCableado(conectar, []).some(l => !l.ok)).toBe(true)
    expect(revisionCableado(conectar, completos).every(l => l.ok)).toBe(true)
  })
  it('los pilotos y pruebas distinguen el cable de PC2 del centro y del otro cable', () => {
    expect(errorDeDiagnostico(investigar)).toBeUndefined()
    expect(pilotos(investigar)).toEqual({ PC1: true, PC2: false, PC3: true })
    expect(pruebaComunicacion(investigar, 'PC1', 'PC3')).toBe(true)
    expect(pruebaComunicacion(investigar, 'PC1', 'PC2')).toBe(false)
    const real = investigar.sospechosos.findIndex(s => s.id === causaReal(investigar))
    expect(diagnostico.opciones[opcionTablero(diagnostico, real)!].correcta).toBe(true)
    const huella = (t: typeof investigar) => JSON.stringify([pilotos(t), pruebaComunicacion(t, 'PC1', 'PC3'), pruebaComunicacion(t, 'PC1', 'PC2')])
    expect(huella({ ...investigar, averia: { tipo: 'centro' } })).not.toBe(huella(investigar))
    expect(huella({ ...investigar, averia: { tipo: 'cable-pc', pc: 'PC1' } })).not.toBe(huella(investigar))
  })
  it('rechaza causas inexistentes, un centro final y una prueba contra sí mismo', () => {
    expect(errorDeConexion({ ...conectar, centro: 'PC1' })).toBeDefined()
    expect(errorDeDiagnostico({ ...investigar, averia: { tipo: 'cable-pc', pc: 'PC99' } })).toBeDefined()
    expect(() => pruebaComunicacion(investigar, 'PC1', 'PC1')).toThrow()
  })
})

// Fixtures puramente ficticios para comprobar los otros motores sin temario externo.
const maquina: Extract<Tablero, { tipo: 'maquina-virtual' }> = {
  tipo: 'maquina-virtual', instruccion: 'Reparte recursos inventados.', host: { ram_gb: 24, nucleos: 12, disco_libre_gb: 240 },
  minimos: { ram_gb: 6, nucleos: 2, disco_gb: 80 }, reparto_max: 0.5, opciones_ram: [3, 6, 12, 18], opciones_disco: [40, 80, 160], red: 'interna',
}
const buena = { ram: 6, nucleos: 2, disco: 80, tipoDisco: 'dinamico' as const, red: 'interna' as const }
const escena: Extract<Tablero, { tipo: 'escena' }> = { tipo: 'escena', instruccion: 'Identifica solo los riesgos ficticios.', escena: 'taller', elementos: [
  { id: 'cable-suelo', etiqueta: 'Cable atravesando el paso', riesgo: true, explicacion: 'Puede provocar un tropiezo.' },
  { id: 'equipo-abierto', etiqueta: 'Equipo conectado y abierto', riesgo: true, explicacion: 'No debe manipularse en estas condiciones.' },
  { id: 'diferencial', etiqueta: 'Protección instalada', riesgo: false, explicacion: 'Es una protección en el caso.' },
  { id: 'caja-ligera', etiqueta: 'Caja pequeña bien colocada', riesgo: false, explicacion: 'No bloquea el paso en el caso.' },
] }

describe('motores de recursos y escena con fixtures originales', () => {
  it('distingue insuficiencia, sobrecarga, red incorrecta y reparto correcto', () => {
    expect(errorDeMaquina(maquina)).toBeUndefined()
    expect(evaluarMaquina(maquina, buena)).toBe(MAQUINA.CORRECTA)
    expect(evaluarMaquina(maquina, { ...buena, ram: 3 })).toBe(MAQUINA.INSUFICIENTE)
    expect(evaluarMaquina(maquina, { ...buena, ram: 18 })).toBe(MAQUINA.SOBRECARGA)
    expect(evaluarMaquina(maquina, { ...buena, red: 'nat' })).toBe(MAQUINA.RED)
    expect(evaluarMaquina(maquina, { ...buena, disco: 160, tipoDisco: 'fijo' })).toBe(MAQUINA.SOBRECARGA)
    expect(evaluarMaquina(maquina, { ...buena, disco: 160 })).toBe(MAQUINA.CORRECTA)
    expect(diagnosticoMaquina(maquina, { ...buena, ram: 18 }).some(l => !l.ok && l.texto.startsWith('RAM'))).toBe(true)
  })
  it('la escena exige todos los riesgos y ninguna selección adicional', () => {
    expect(errorDeEscena(escena)).toBeUndefined()
    expect(evaluarEscena(escena, new Set(['cable-suelo', 'equipo-abierto']))).toBe(ESCENA.CORRECTA)
    expect(evaluarEscena(escena, new Set(['cable-suelo']))).toBe(ESCENA.FALTAN)
    expect(evaluarEscena(escena, new Set(escena.elementos.map(e => e.id)))).toBe(ESCENA.SOBRAN)
    expect(evaluarEscena(escena, new Set(['diferencial']))).toBe(ESCENA.AMBAS)
    expect(veredictoEscena(escena, new Set(['cable-suelo', 'equipo-abierto'])).every(e => e.acierto)).toBe(true)
  })
})
