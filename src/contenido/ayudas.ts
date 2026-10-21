// Generic study guidance. Demo lessons carry their own explanations and sources.
import type { Item } from '../motor/items'
import type { Indice } from '../motor/sesiones'

export interface GuiaAyuda { pista: string; ejemplo: string; variante: Item }

// Course-specific recovery activities are not bundled with the public engine.
export function guiaAyuda(_ix: Indice, _item: Item): GuiaAyuda | undefined {
  return undefined
}

export function pistaActividad(item: Item): string {
  return {
    test: 'Busca el dato que decide la respuesta y contrasta cada alternativa con ese dato.',
    vf: 'Comprueba qué afirma la frase y busca un contraejemplo antes de aceptar una regla absoluta.',
    clasificar: 'Identifica la condición que distingue las categorías antes de ordenar los elementos.',
    emparejar: 'Relaciona los significados; no uses la posición en la lista como pista.',
    ordenar: 'Busca qué acción necesita que otra esté terminada antes de empezar.',
    nodos: 'Sigue las conexiones disponibles desde el equipo de origen.',
  }[item.vista.motor]
}
