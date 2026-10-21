// Modelo de 5 estados de un proceso, según el diagrama del tema de SOM UT1 (pág. 3):
// Nuevo→Listo, Listo→En ejecución, En ejecución→Listo, En ejecución→Bloqueado, Bloqueado→Listo, En ejecución→Terminado.
// Ficha: docs/simulaciones/procesos.md

export type EstadoProceso = 'nuevo' | 'listo' | 'ejecucion' | 'bloqueado' | 'terminado'

export const NOMBRE_ESTADO: Record<EstadoProceso, string> = {
  nuevo: 'Nuevo',
  listo: 'Listo',
  ejecucion: 'En ejecución',
  bloqueado: 'Bloqueado',
  terminado: 'Terminado',
}

export interface Transicion {
  de: EstadoProceso
  a: EstadoProceso
  /** Eventos que la provocan, redactados como situaciones concretas. */
  eventos: string[]
}

export const TRANSICIONES: Transicion[] = [
  {
    de: 'nuevo',
    a: 'listo',
    eventos: ['El sistema operativo termina de crear el proceso y le asigna memoria.'],
  },
  {
    de: 'listo',
    a: 'ejecucion',
    eventos: ['El sistema operativo le da su turno de CPU.', 'Un núcleo de la CPU queda libre y el sistema operativo lo elige a él.'],
  },
  {
    de: 'ejecucion',
    a: 'listo',
    eventos: [
      'Se le acaba su turno de CPU y el sistema operativo da paso a otro proceso.',
      'El sistema operativo le quita la CPU para dársela a otro proceso.',
    ],
  },
  {
    de: 'ejecucion',
    a: 'bloqueado',
    eventos: [
      'Pide leer un archivo del disco y tiene que esperar a que lleguen los datos.',
      'Espera a que el usuario pulse una tecla.',
      'Espera a que lleguen datos por la red.',
    ],
  },
  {
    de: 'bloqueado',
    a: 'listo',
    eventos: ['Llegan los datos del disco que estaba esperando.', 'El usuario pulsa la tecla que esperaba.', 'Llegan los datos de la red.'],
  },
  {
    de: 'ejecucion',
    a: 'terminado',
    eventos: ['Ejecuta su última instrucción y finaliza.', 'El usuario cierra el programa y el proceso finaliza.'],
  },
]

export function esValida(de: EstadoProceso, a: EstadoProceso): boolean {
  return TRANSICIONES.some((t) => t.de === de && t.a === a)
}

export const ESTADOS: EstadoProceso[] = ['nuevo', 'listo', 'ejecucion', 'bloqueado', 'terminado']
