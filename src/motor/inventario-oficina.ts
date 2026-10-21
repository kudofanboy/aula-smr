/** Hechos observables de la visita, compartidos por escena, controles e informe. */
export const ELEMENTOS_OFICINA = [
  { bit: 1, corto: 'PC 01', nombre: 'Puesto de diseño', estado: 'Conectado a la red del estudio' },
  { bit: 2, corto: 'PC 02', nombre: 'Puesto de producción', estado: 'Conectado a la red del estudio' },
  { bit: 4, corto: 'PC 03', nombre: 'Puesto de edición', estado: 'Conectado a la red del estudio' },
  { bit: 8, corto: 'IMP', nombre: 'Impresora de estudio', estado: 'Conectada a la red del estudio' },
  { bit: 16, corto: 'RES', nombre: 'Portátil de reserva', estado: 'Guardado, sin conexión a la red' },
  { bit: 32, corto: 'CAB', nombre: 'Cable de reserva', estado: 'Enrollado en el almacén' },
] as const

export const MAX_INVENTARIO_OFICINA = ELEMENTOS_OFICINA.reduce((mask, e) => mask | e.bit, 0)
export const NODOS_OFICINA = 15

export function revisarInventario(valor: number) {
  const faltan = ELEMENTOS_OFICINA.filter((e) => (NODOS_OFICINA & e.bit) && !(valor & e.bit)).map((e) => e.nombre)
  const motivos: string[] = []
  if (valor & 16) motivos.push('El portátil de reserva está desconectado: estar en la misma sala no lo convierte en un nodo de esta red.')
  if (valor & 32) motivos.push('El cable es un medio de conexión, no un dispositivo con procesamiento y dirección propia. No es un nodo.')
  return { faltan, motivos }
}
