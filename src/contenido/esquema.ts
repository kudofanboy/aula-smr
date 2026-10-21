// Esquema del contenido del juego. Un contenido que no cumple el esquema no se carga.
// Reglas de exactitud: docs/DISEÑO.md, sección 2.
import { z } from 'zod'

const Texto = z.string().min(1)

/** Referencia a la página de una fuente declarada en la unidad. */
export const RefFuente = z.object({ doc: Texto, pag: z.number().int().positive() })

/** Topologías que sabe dibujar y simular el juego. */
export const Topologia = z.enum(['bus', 'estrella', 'anillo', 'arbol'])
export const Centro = z.enum(['hub', 'switch'])

export const EscenarioRed = z.object({
  topologia: Topologia,
  /** Dispositivo central en estrella/árbol. En árbol siempre son switches. */
  centro: Centro.optional(),
  /** Número de equipos finales (3-6). */
  equipos: z.number().int().min(3).max(6).optional(),
})

/** Elementos visuales dibujados por el juego (SVG propio). */
export const Visual = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('topologia'), escenario: EscenarioRed }),
  z.object({ tipo: z.literal('vonneumann') }),
  z.object({ tipo: z.literal('capas-so') }),
  z.object({ tipo: z.literal('disco') }),
  z.object({ tipo: z.literal('estados-proceso') }),
  z.object({ tipo: z.literal('alcance-redes') }),
  z.object({ tipo: z.literal('nic') }),
  z.object({ tipo: z.literal('nodos-red') }),
  z.object({ tipo: z.literal('emoji'), emoji: Texto }),
])
export type Visual = z.infer<typeof Visual>

/**
 * Pasos de la fase "Descubrir": presentan el concepto con una interacción.
 * Formato v2 (docs/PLAN-DIDACTICO.md): los textos admiten **negrita**, listas con "- " y términos del glosario
 * como [[id]] o [[id|texto visible]]. Los límites de longitud de v1 se mantienen en las unidades sin migrar
 * mediante la comprobación de integridad, no en el esquema.
 */
export const Paso = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('idea'),
    /** Título corto de la pantalla (v2). */
    titulo: z.string().min(1).max(80).optional(),
    texto: z.string().min(1).max(900),
    visual: Visual.optional(),
  }),
  /** Adivinar ANTES de la explicación (efecto pretest): solo si se puede razonar con sentido común. */
  z.object({
    tipo: z.literal('prediccion'),
    pregunta: Texto,
    opciones: z.array(Texto).min(2).max(4),
    correcta: z.number().int().min(0),
    revelacion: z.string().min(1).max(700),
    visual: Visual.optional(),
  }),
  /** Comprobar DESPUÉS de la explicación con una situación nueva (v2). */
  z.object({
    tipo: z.literal('pregunta'),
    pregunta: Texto,
    opciones: z.array(Texto).min(2).max(4),
    correcta: z.number().int().min(0),
    /** Por qué la correcta es correcta. */
    revelacion: z.string().min(1).max(700),
    /** Por qué falla cada opción (mismo orden que opciones; la correcta puede ir vacía). */
    por_opcion: z.array(z.string()).optional(),
    visual: Visual.optional(),
  }),
  z.object({
    tipo: z.literal('explorar'),
    instruccion: Texto,
    visual: Visual,
    /** Cada zona del dibujo que hay que pulsar, con su explicación corta. Los ids los define el componente visual. */
    zonas: z.array(z.object({ id: Texto, titulo: Texto, texto: z.string().min(1).max(400) })).min(2),
  }),
  z.object({
    tipo: z.literal('simulador-red'),
    instruccion: Texto,
    escenario: EscenarioRed,
    /** Qué se puede hacer: enviar tramas o cortar cables/equipos. */
    modo: z.enum(['enviar', 'averia']),
  }),
])
export type Paso = z.infer<typeof Paso>

/** "Para el examen" frente a "En la práctica real". */
export const Matiz = z.object({
  examen: Texto,
  real: Texto,
  ref: z.url().optional(),
})

export const Concepto = z.object({
  id: Texto,
  nombre: Texto,
  fuente: RefFuente,
  nivel_verdad: z.enum(['temario', 'realidad', 'simplificacion']),
  matiz: Matiz.optional(),
  requiere: z.array(Texto).default([]),
  /** Qué sabrá hacer el alumno al terminar (v2). */
  objetivo: z.string().min(1).max(200).optional(),
  descubrir: z.array(Paso).min(1),
  /** «Lo importante»: 2-4 frases para recordar; también forman los apuntes (v2). */
  clave: z.array(Texto).min(2).max(4).optional(),
  verificado: z.boolean(),
})

/** Término del glosario. Se cita en los textos como [[id]] o [[id|texto visible]]. */
export const Termino = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  termino: Texto,
  definicion: z.string().min(1).max(400),
  /** Concepto donde se enseña a fondo (si lo hay). */
  concepto: Texto.optional(),
})
export type Termino = z.infer<typeof Termino>
export type Concepto = z.infer<typeof Concepto>

const Base = {
  id: Texto,
  conceptos: z.array(Texto).min(1),
  dificultad: z.number().int().min(1).max(3),
  fuente: RefFuente,
  verificado: z.boolean(),
  /** "profesor" = pregunta del banco oficial del profesor (formulario de material del curso). */
  origen: z.enum(['juego', 'profesor']).default('juego'),
  explicacion: Texto,
}

export const Ejercicio = z.discriminatedUnion('motor', [
  z.object({
    ...Base,
    motor: z.literal('test'),
    enunciado: Texto,
    visual: Visual.optional(),
    opciones: z.array(Texto).min(2).max(5),
    correcta: z.number().int().min(0),
    /** Por qué falla cada opción (mismo orden que opciones; la correcta puede ir vacía). */
    por_opcion: z.array(z.string()).optional(),
  }),
  z.object({ ...Base, motor: z.literal('vf'), afirmacion: Texto, verdadero: z.boolean() }),
  z.object({
    ...Base,
    motor: z.literal('clasificar'),
    enunciado: Texto,
    categorias: z.array(z.object({ id: Texto, nombre: Texto })).min(2).max(4),
    elementos: z.array(z.object({ texto: Texto, categoria: Texto })).min(3),
  }),
  z.object({ ...Base, motor: z.literal('ordenar'), enunciado: Texto, pasos: z.array(Texto).min(3).max(7) }),
  z.object({
    ...Base,
    motor: z.literal('emparejar'),
    enunciado: Texto,
    pares: z.array(z.object({ a: Texto, b: Texto })).min(3).max(6),
  }),
])
export type Ejercicio = z.infer<typeof Ejercicio>

/** Generadores: ejercicios creados por el juego a partir de reglas verificadas (con tests). */
export const Generador = z.object({
  tipo: z.enum(['red-quien-recibe', 'red-averia', 'red-identifica', 'proceso-transicion']),
  conceptos: z.array(Texto).min(1),
  fuente: RefFuente,
  /** Opciones del generador (p. ej. qué topologías usar). */
  topologias: z.array(Topologia).optional(),
  centros: z.array(Centro).optional(),
})
export type Generador = z.infer<typeof Generador>

export const Juego = z.object({
  id: Texto,
  titulo: Texto,
  descripcion: Texto,
  tipo: z.enum(['practica', 'examen', 'banco-profesor']),
  /** Qué ejercicios entran: por conceptos y/o motores. Vacío = todos los de la unidad. */
  conceptos: z.array(Texto).optional(),
  motores: z.array(z.string()).optional(),
  solo_profesor: z.boolean().optional(),
  generadores: z.array(Generador).optional(),
  preguntas: z.number().int().min(3).max(40),
  /** Tiempo total en segundos (solo exámenes). */
  tiempo: z.number().int().positive().optional(),
})
export type Juego = z.infer<typeof Juego>

export const Fuente = z.object({
  id: Texto,
  titulo: Texto,
  /** Ruta relativa a la carpeta "1º curso", o URL si es una web. */
  ruta: Texto,
  /** Qué indica `pag` al citarla: página (por defecto), apartado de un documento web o nada (página web sin numerar). */
  localizador: z.enum(['pagina', 'apartado', 'ninguno']).optional(),
})

/** Avería de un tablero de diagnóstico (mismos tipos que el simulador de redes). */
export const AveriaTablero = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('cable-pc'), pc: Texto }),
  z.object({ tipo: z.literal('centro') }),
  z.object({ tipo: z.literal('switch'), sw: z.enum(['R', 'S1', 'S2']) }),
])

/** Dibujo de apoyo dentro de un paso de encargo (no produce respuesta por sí mismo). */
export const Ilustracion = z.discriminatedUnion('tipo', [
  /** Tarjeta de red vista desde fuera, con los pilotos en un estado concreto. */
  z.object({ tipo: z.literal('pilotos'), enlace: z.enum(['fijo', 'apagado']), actividad: z.enum(['parpadea', 'apagado']), pie: Texto.optional() }),
  /** Simulador de envío con pestañas para comparar (por ejemplo hub frente a switch). */
  z.object({ tipo: z.literal('simulador'), instruccion: Texto, pestanas: z.array(z.object({ etiqueta: Texto, escenario: EscenarioRed })).min(1).max(3) }),
])

/** Tablero interactivo: el alumno actúa sobre un dibujo y el resultado elige una de las opciones del paso (por `valor_taller`). */
export const Tablero = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('conectar'),
    instruccion: Texto,
    /** Equipo central (hub o switch) al que deben ir todos los equipos finales. */
    centro: Texto,
    nodos: z.array(z.object({
      id: Texto, etiqueta: Texto,
      clase: z.enum(['pc', 'impresora', 'switch', 'hub', 'router', 'internet']),
      x: z.number().min(0).max(600), y: z.number().min(0).max(360),
    })).min(3).max(10),
  }),
  z.object({
    tipo: z.literal('escena'),
    instruccion: Texto,
    /** Ilustración que dibuja el juego (cada una tiene sus propios elementos pulsables). */
    escena: z.enum(['taller']),
    /** Elementos pulsables de la escena: unos son riesgos y otros están bien, y todos explican por qué. */
    elementos: z.array(z.object({ id: Texto, etiqueta: Texto, riesgo: z.boolean(), explicacion: Texto })).min(4).max(8),
  }),
  z.object({
    tipo: z.literal('maquina-virtual'),
    instruccion: Texto,
    /** Recursos del equipo físico (anfitrión) donde se crea la máquina virtual. */
    host: z.object({ ram_gb: z.number().positive(), nucleos: z.number().int().positive(), disco_libre_gb: z.number().positive() }),
    /** Mínimos que pide el sistema invitado. */
    minimos: z.object({ ram_gb: z.number().positive(), nucleos: z.number().int().positive(), disco_gb: z.number().positive() }),
    /** Fracción máxima de RAM, núcleos y espacio libre que se puede ceder a la máquina virtual (criterio del caso). */
    reparto_max: z.number().min(0.3).max(0.8),
    opciones_ram: z.array(z.number().positive()).min(3).max(6),
    opciones_disco: z.array(z.number().positive()).min(3).max(6),
    /** Modo de red que cumple lo que pide el cliente. */
    red: z.enum(['nat', 'nat-network', 'interna', 'solo-anfitrion', 'puente']),
  }),
  z.object({
    tipo: z.literal('diagnostico'),
    instruccion: Texto,
    escenario: EscenarioRed,
    averia: AveriaTablero,
    /** Pruebas de comunicación disponibles (los pilotos se pueden mirar sin límite). */
    pruebas: z.number().int().min(1).max(6),
    /** Posibles causas; la opción i del paso corresponde a la causa i (valor_taller = i). */
    sospechosos: z.array(z.object({ id: Texto, etiqueta: Texto })).min(2).max(4),
  }),
])
export type Tablero = z.infer<typeof Tablero>
export type Ilustracion = z.infer<typeof Ilustracion>

/** Casos propios: cada decisión tiene una consecuencia y una referencia comprobable. */
export const PasoEncargo = z.object({
  titulo: Texto,
  mensaje: Texto,
  conceptos: z.array(Texto).min(1),
  fuente: RefFuente,
  nivel_verdad: z.enum(['temario', 'realidad', 'simplificacion']),
  matiz: Matiz.optional(),
  verificado: z.boolean(),
  /** Taller conceptual de tres puestos y una impresora; no configura equipos reales. */
  taller: z.enum(['conexion', 'inventario', 'alcance']).optional(),
  /** Dibujo explicativo sobre las opciones (pilotos de la tarjeta, comparador de dispositivos…). */
  ilustracion: Ilustracion.optional(),
  /** Actividad gráfica en lugar de elegir una opción de texto. */
  tablero: Tablero.optional(),
  /** Lo que hay que saber para decidir, mostrado antes de las opciones (enseñar antes de exigir). */
  explicacion: Texto.optional(),
  /** Datos del encargo (presupuestos, fichas…). Siempre son inventados para el ejercicio y se rotulan como ficticios. */
  datos: z.object({ titulo: Texto, filas: z.array(z.object({ nombre: Texto, detalle: Texto })).min(2).max(4) }).optional(),
  opciones: z.array(z.object({ texto: Texto, correcta: z.boolean(), consecuencia: Texto,
    valor_taller: z.number().int().min(-1).max(15).optional(),
  })).min(2).max(4),
})
export const Encargo = z.object({
  id: Texto,
  cliente: z.object({ nombre: Texto, empresa: Texto }),
  asunto: Texto,
  mensaje: Texto,
  verificado: z.boolean(),
  pasos: z.array(PasoEncargo).min(2).max(6),
  valoracion: z.object({ satisfecho: Texto, parcial: Texto, insatisfecho: Texto }),
  /**
   * Versiones de un mismo caso. Las respuestas se guardan por posición de opción, así que un caso que cambia de
   * significado se publica con otro id y el original se conserva intacto: `sustituido_por` lo retira para perfiles
   * que no lo habían empezado, y las dos versiones comparten un solo premio.
   */
  sustituye: Texto.optional(),
  sustituido_por: Texto.optional(),
})
export type Encargo = z.infer<typeof Encargo>

export const Unidad = z.object({
  id: Texto,
  modulo: z.enum(['MME', 'SOM', 'REDES', 'AOF', 'ING', 'IPE', 'SOC']),
  codigo: Texto,
  titulo: Texto,
  orden: z.number().int(),
  /** 2 = unidad migrada al formato didáctico v2 (comprobaciones más estrictas). */
  formato: z.union([z.literal(1), z.literal(2)]).default(1),
  fuentes: z.array(Fuente).min(1),
  /** Términos que esta unidad define; el glosario es común a todas las unidades. */
  glosario: z.array(Termino).default([]),
  conceptos: z.array(Concepto).min(1),
  ejercicios: z.array(Ejercicio),
  generadores: z.array(Generador).default([]),
  juegos: z.array(Juego).min(1),
  encargos: z.array(Encargo).default([]),
})
export type Unidad = z.infer<typeof Unidad>

export const EventoCalendario = z.object({
  id: Texto,
  fecha: z.iso.date(),
  hora: z.string().optional(),
  modulo: z.enum(['MME', 'SOM', 'REDES', 'AOF', 'ING', 'IPE', 'GENERAL']),
  tipo: z.enum(['entrega', 'examen', 'cuestionario', 'aviso']),
  titulo: Texto,
  detalle: z.string().optional(),
  fuente: z.object({ titulo: Texto, url: z.url(), revisado: z.iso.date() }).optional(),
})
export type EventoCalendario = z.infer<typeof EventoCalendario>

export const Profesor = z.object({
  id: Texto,
  nombre: Texto,
  correo: z.email(),
  modulos: z.array(z.enum(['MME', 'SOM', 'REDES', 'AOF', 'ING', 'IPE', 'SOC'])).min(1),
  tutora: z.boolean().default(false),
  nota: Texto.optional(),
  revisado: z.iso.date(),
  fuentes: z.array(z.object({ titulo: Texto, url: z.url() })).min(1),
})
export type Profesor = z.infer<typeof Profesor>

export const Curso = z.object({
  profesorado: z.array(Profesor).default([]),
  modulos: z.array(
    z.object({
      id: z.enum(['MME', 'SOM', 'REDES', 'AOF', 'ING', 'IPE', 'SOC']),
      planta: Texto,
      nombre: Texto,
      /** Nombre corto para etiquetas (p. ej. "Ofimática"). */
      corto: z.string().optional(),
      icono: Texto,
      /** Tono de color del módulo (0-360, rueda de color OKLCH). Identifica la asignatura en toda la interfaz. */
      tono: z.number().min(0).max(360).optional(),
      /** Unidades previstas según la guía; las que no tienen contenido aparecen como "Próximamente". */
      unidades: z.array(z.object({ codigo: Texto, titulo: Texto })),
    }),
  ),
})
export type Curso = z.infer<typeof Curso>
