// Valida una copia entera antes de sustituir el progreso del alumno.
import { z } from 'zod'
import { migrar, VERSION_PROGRESO, type Progreso } from './progreso'
import type { Unidad } from '../contenido/esquema'
import { opcionTaller } from './encargos'
import { EstadoLaboratorioSchema } from './laboratorio'

const contador = z.number().finite().int().nonnegative()
const numero = z.number().finite().nonnegative()
const dia = z.iso.date()
const fecha = z.iso.datetime({ offset: true })
const diccionario = <T extends z.ZodType>(valor: T) => z.record(z.string(), valor)

const tarjeta = z.object({
  due: fecha,
  stability: numero,
  difficulty: numero.max(10),
  elapsed_days: numero,
  scheduled_days: numero,
  learning_steps: contador.default(0),
  reps: contador,
  lapses: contador,
  state: contador.max(3),
  last_review: fecha.optional(),
}).passthrough()

const partida = z.object({
  fecha,
  puntos: numero,
  estrellas: contador.max(3),
  aciertos: contador,
  total: contador,
  nota: numero.max(10).optional(),
}).passthrough()

const copia = z.object({
  version: contador.max(VERSION_PROGRESO).optional(),
  creado: fecha.optional(),
  conceptos: diccionario(z.object({
    tarjeta,
    descubierto: dia.optional(),
    aciertos: contador,
    fallos: contador,
    diasAcierto: z.array(dia).optional(),
    ultimoMotor: z.string().optional(),
    aplicacion: z.object({ estado: z.enum(['pendiente', 'con-ayuda', 'sin-ayuda']), fecha }).optional(),
  }).passthrough()),
  juegos: diccionario(z.object({
    mejor: numero,
    mejorEstrellas: contador.max(3),
    mejorNota: numero.max(10).optional(),
    historial: z.array(partida),
  }).passthrough()).optional(),
  xp: numero.optional(),
  sueldo: numero.optional(),
  racha: z.object({
    actual: contador.optional(), mejor: contador.optional(),
    ultimoDia: dia.optional(), comodinUsadoSemana: dia.optional(),
  }).passthrough().optional(),
  turnos: diccionario(z.object({ xp: numero, items: contador, aciertos: contador }).passthrough()).optional(),
  ocultos: z.array(z.string()).optional(),
  nombre: z.string().optional(),
  avatar: z.enum(['chica', 'chico']).optional(),
  actividad: diccionario(diccionario(contador)).optional(),
  xpDia: diccionario(numero).optional(),
  encargosHechos: z.array(z.string()).optional(),
  encargos: diccionario(z.object({
    recibido: dia, leido: z.boolean(), respuestas: z.array(contador),
    borradores: diccionario(contador).optional(), completado: dia.optional(),
  }).passthrough()).optional(),
  ultimoEncargoDia: dia.optional(),
  simulacros: diccionario(z.array(z.object({ fecha, nota: numero.max(10), aciertos: contador, total: contador }).passthrough())).optional(),
  evidencias: z.array(z.object({ fecha, tipo: z.enum(['practica', 'recuperacion', 'caso']), unidadId: z.string().min(1),
    conceptos: z.array(z.string().min(1)).max(20), actividad: z.string().min(1).max(200), acierto: z.boolean(),
    ayudas: contador.max(2), detalle: z.string().max(2000),
  })).max(200).optional(),
  laboratorios: diccionario(EstadoLaboratorioSchema).optional(),
  ajustes: z.object({
    sonido: z.boolean().optional(), tema: z.enum(['auto', 'claro', 'oscuro']).optional(),
    guiaVista: z.boolean().optional(), animaciones: z.boolean().optional(), tamano: z.enum(['normal', 'grande']).optional(),
  }).passthrough().optional(),
}).passthrough()

/** Los campos añadidos después se completan; un campo presente pero inválido se rechaza. */
export function validarCopiaProgreso(datos: unknown, unidades: readonly Unidad[] = []): Progreso {
  const resultado = copia.safeParse(datos)
  if (!resultado.success) {
    const campo = resultado.error.issues[0]?.path.map(String).join('.')
    throw new Error(`El archivo no es una copia válida de Aula SMR${campo ? ` (revisa ${campo})` : ''}. Tu progreso no se ha cambiado.`)
  }
  const progreso = migrar(resultado.data as Partial<Progreso>)
  for (const unidad of unidades) for (const encargo of unidad.encargos) {
    const estado = progreso.encargos[encargo.id]
    if (!estado) continue
    const respuestasValidas = estado.respuestas.length <= encargo.pasos.length
      && (!estado.completado || estado.respuestas.length === encargo.pasos.length)
      && estado.respuestas.every((opcion, paso) => Boolean(encargo.pasos[paso]?.opciones[opcion]))
    const borradoresValidos = Object.entries(estado.borradores ?? {}).every(([clave, valor]) => {
      const i = Number(clave)
      const paso = encargo.pasos[i]
      return String(i) === clave && Number.isInteger(i) && i >= 0 && i <= estado.respuestas.length
        && paso && opcionTaller(paso, valor) !== undefined
        && (estado.respuestas[i] === undefined || opcionTaller(paso, valor) === estado.respuestas[i])
    })
    if (!respuestasValidas || !borradoresValidos) throw new Error(`La copia contiene decisiones inválidas en el caso «${encargo.asunto}». Tu progreso no se ha cambiado.`)
  }
  return progreso
}
