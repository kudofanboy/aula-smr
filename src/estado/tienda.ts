// Estado global: contenido cargado, progreso y navegación. Guarda en el servidor o en el navegador según el modo.
import { create } from 'zustand'
import { validarCopiaProgreso } from '../motor/copias'
import { Rating, State } from 'ts-fsrs'
import type { Curso, EventoCalendario } from '../contenido/esquema'
import { validarTodo } from '../contenido/integridad'
import { ConflictoDeGuardado, enviarInforme, guardarProgreso, leerContenido, leerProgreso, MODO_COMPARTIR, MODO_PROFESOR, RECORRIDO_DIRECTO, versionDelProgreso } from './almacen'
import { motorDe, type Item } from '../motor/items'
import {
  actualizarRacha, estadoNuevo, hoy, migrar, notaFsrs, repasar, registrarEvidencia, type EvidenciaAprendizaje, type EstadoConcepto, type Partida, type Progreso,
} from '../motor/progreso'
import { indexar, type Indice, type Sesion } from '../motor/sesiones'
import { conTransicion, direccionNavegacion } from '../ui/efectos'
import { sonar } from '../ui/sonido'
import { catalogoEncargos, conoceEncargo, decidirEncargo, entregarEncargo, iniciarEncargo, prepararEncargo } from '../motor/encargos'

export type Pantalla =
  | { id: 'inicio' }
  | { id: 'demostracion' }
  | { id: 'departamento'; moduloId: string; unidadId?: string }
  | { id: 'agenda' }
  | { id: 'profesorado' }
  | { id: 'sesion'; sesion: Sesion; unidadId?: string }
  | { id: 'resultado'; resumen: ResumenSesion; unidadId?: string }
  | { id: 'expediente' }
  | { id: 'encargos'; moduloId?: string }
  | { id: 'practica'; moduloId?: string }
  | { id: 'apuntes'; conceptoId: string }
  | { id: 'encargo'; encargoId: string }

export interface RespuestaSesion {
  item: Item
  /** Lo que respondió el alumno (para enseñárselo en la revisión). Su forma depende del motor del ítem. */
  respuesta?: unknown
  acierto: boolean
  segundos: number
  puntos: number
  ayudas?: number
}

export interface ResumenSesion {
  sesion: Sesion
  respuestas: RespuestaSesion[]
  puntos: number
  estrellas: number
  nota?: number
  xp: number
  descubiertos: string[]
  record: boolean
  recordAnterior?: number
  subidasNivel: string[]
  recuperaciones?: { conceptos: string[]; acierto: boolean }[]
  /** Nuevo rango alcanzado en esta sesión. */
  ascenso?: string
}

interface Estado {
  cargado: boolean
  errores: string[]
  indice: Indice | null
  calendario: EventoCalendario[]
  curso: Curso | null
  progreso: Progreso
  pantalla: Pantalla
  /** Aviso o pregunta dentro del juego (sustituye a alert/confirm del navegador, que bloquean la ventana). */
  /** `bloqueante`: no se puede cerrar sin actuar (por ejemplo, recargar tras un conflicto de guardado). */
  dialogo: { texto: string; siTexto?: string; alConfirmar?: () => void; bloqueante?: boolean } | null
  avisar: (texto: string) => void
  preguntar: (texto: string, siTexto: string, alConfirmar: () => void) => void
  cerrarDialogo: () => void
  cargar: () => Promise<void>
  ir: (p: Pantalla) => void
  cambiar: (f: (p: Progreso) => Progreso) => void
  descubrir: (conceptoId: string) => void
  /** Aplica una respuesta al repaso espaciado según el tipo de sesión. */
  responder: (sesion: Sesion, item: Item, acierto: boolean, segundos: number, objetivo: number) => void
  registrar: (e: Omit<EvidenciaAprendizaje, 'fecha'>) => void
  terminarSesion: (r: Omit<ResumenSesion, 'record' | 'recordAnterior'>) => ResumenSesion
  informar: (item: Item, tipo: 'error' | 'no-entiendo', comentario: string) => Promise<void>
  /** Buscador abierto. */
  buscando: boolean
  buscar: (abierto: boolean) => void
  /** Estado de ánimo del avatar tras terminar algo; vuelve a neutro solo a los pocos segundos. */
  animo: 'neutra' | 'feliz' | 'preocupada'
  sentir: (animo: 'neutra' | 'feliz' | 'preocupada') => void
  /** Abre un caso práctico; si aún no se ha empezado y se conocen sus conceptos, lo empieza. */
  abrirCaso: (id: string) => void
  abrirEncargo: (id: string) => void
  decidirCliente: (id: string, paso: number, opcion: number) => void
  prepararCliente: (id: string, paso: number, valor: number) => void
  entregarCliente: (id: string) => void
}

let temporizadorGuardado: number | undefined
let temporizadorAnimo: number | undefined
/** true si hay cambios aún sin enviar al servidor. */
let pendiente = false
let guardando = false
let revision = 0
let errorDeGuardadoMostrado = false
let cargaEnCurso: Promise<void> | undefined

/** Guarda en orden y conserva pendiente cualquier cambio que llegue durante el envío. */
async function guardarPendiente(get: () => Estado, set: (partial: Partial<Estado>) => void) {
  if (guardando || !pendiente) return
  guardando = true
  while (pendiente) {
    const revisionActual = revision
    const progreso = get().progreso
    try {
      await guardarProgreso(progreso)
    } catch (e) {
      guardando = false
      if (e instanceof ConflictoDeGuardado) {
        // Otra ventana guardó antes: no se pisa su progreso. Hay que recargar para partir de la versión más reciente.
        if (!errorDeGuardadoMostrado) {
          errorDeGuardadoMostrado = true
          set({ dialogo: { texto: 'El juego está abierto en otra ventana y allí se ha guardado progreso más reciente. Para no perderlo, recarga esta ventana: se cargará la versión más reciente (lo último que hiciste aquí no se ha guardado).', siTexto: 'Recargar', alConfirmar: () => { pendiente = false; window.location.reload() }, bloqueante: true } })
        }
        return
      }
      if (!errorDeGuardadoMostrado) {
        errorDeGuardadoMostrado = true
        const detalle = e instanceof Error ? e.message : String(e)
        set({ dialogo: { texto: `No se pudo guardar tu progreso. Se conserva en esta pantalla e intentaremos guardarlo al hacer otro cambio o cuando vuelva la conexión. ${detalle}` } })
      }
      return
    }
    errorDeGuardadoMostrado = false
    if (revision === revisionActual) pendiente = false
  }
  guardando = false
}

export const useTienda = create<Estado>((set, get) => ({
  cargado: false,
  errores: [],
  indice: null,
  calendario: [],
  curso: null,
  progreso: migrar(null),
  pantalla: RECORRIDO_DIRECTO ? { id: 'demostracion' } : { id: 'inicio' },
  dialogo: null,
  animo: 'neutra',
  sentir: (animo) => {
    window.clearTimeout(temporizadorAnimo)
    set({ animo })
    if (animo !== 'neutra') temporizadorAnimo = window.setTimeout(() => set({ animo: 'neutra' }), 14_000)
  },
  avisar: (texto) => set({ dialogo: { texto } }),
  preguntar: (texto, siTexto, alConfirmar) => set({ dialogo: { texto, siTexto, alConfirmar } }),
  cerrarDialogo: () => set({ dialogo: null }),
  buscando: false,
  buscar: (buscando) => set({ buscando }),
  registrar: (e) => get().cambiar((p) => registrarEvidencia(p, { ...e, fecha: new Date().toISOString() })),
  abrirCaso: (id) => {
    const { indice, progreso } = get()
    const ficha = catalogoEncargos(indice?.unidades ?? []).find((x) => x.encargo.id === id)
    if (!ficha) return
    if (!progreso.encargos[id]) {
      if (!conoceEncargo(ficha.encargo, progreso)) return get().avisar('Te faltan lecciones para este caso práctico.')
      get().cambiar((p) => iniciarEncargo(p, ficha.encargo))
      sonar('encargo')
    }
    get().abrirEncargo(id)
  },
  abrirEncargo: (id) => {
    const actual = get().progreso.encargos[id]
    if (!actual) return
    if (!actual.leido) get().cambiar((p) => ({ ...p, encargos: { ...p.encargos, [id]: { ...p.encargos[id], leido: true } } }))
    get().ir({ id: 'encargo', encargoId: id })
  },
  prepararCliente: (id, paso, valor) => {
    const ficha = catalogoEncargos(get().indice?.unidades ?? []).find((x) => x.encargo.id === id)
    if (ficha) get().cambiar((p) => prepararEncargo(p, ficha.encargo, paso, valor))
  },
  decidirCliente: (id, paso, opcion) => {
    const ficha = catalogoEncargos(get().indice?.unidades ?? []).find((x) => x.encargo.id === id)
    if (!ficha) return
    get().cambiar((p) => {
      const q = decidirEncargo(p, ficha.encargo, paso, opcion)
      if (q === p) return p
      const conceptos = { ...q.conceptos }
      const acierto = ficha.encargo.pasos[paso].opciones[opcion].correcta
      for (const conceptoId of ficha.encargo.pasos[paso].conceptos) {
        const e = conceptos[conceptoId]
        if (!e) continue
        conceptos[conceptoId] = !acierto && e.tarjeta.state !== State.New
          ? repasar(e, Rating.Again)
          : { ...e, aciertos: e.aciertos + Number(acierto), fallos: e.fallos + Number(!acierto) }
      }
      const dia = hoy()
      const actividad = { ...(q.actividad[dia] ?? {}) }
      actividad[ficha.unidad.modulo] = (actividad[ficha.unidad.modulo] ?? 0) + 1
      return { ...q, conceptos, actividad: Object.fromEntries(Object.entries({ ...q.actividad, [dia]: actividad }).sort().slice(-60)) }
    })
  },
  entregarCliente: (id) => {
    const ficha = catalogoEncargos(get().indice?.unidades ?? []).find((x) => x.encargo.id === id)
    if (ficha) get().cambiar((p) => entregarEncargo(p, ficha.encargo))
  },

  cargar: () => {
    if (cargaEnCurso) return cargaEnCurso
    cargaEnCurso = (async () => {
      try {
        const [contenido, progreso] = await Promise.all([leerContenido(), MODO_PROFESOR ? Promise.resolve(null) : leerProgreso()])
        const v = validarTodo(contenido)
        const ix = indexar(v.unidades)
        let guardado = progreso === null ? migrar(null) : validarCopiaProgreso(progreso, v.unidades)
        if (MODO_PROFESOR) {
          // Profesorado: todo aprendido (para poder entrar en cualquier lección, apuntes y caso) y sin tocar el progreso real.
          guardado = migrar(null)
          guardado.nombre = 'Profesorado'
          guardado.ajustes = { ...guardado.ajustes, guiaVista: true }
          for (const id of ix.concepto.keys()) guardado.conceptos[id] = { ...estadoNuevo(), descubierto: hoy() }
        }
        set({ cargado: true, errores: v.errores, indice: ix, calendario: v.calendario, curso: v.curso, progreso: guardado })
      } catch (e) {
        set({ cargado: true, errores: [MODO_COMPARTIR ? `No se pudo cargar el juego: ${String(e)}` : `No se pudo conectar con el servidor del juego: ${String(e)}`] })
      } finally {
        cargaEnCurso = undefined
      }
    })()
    return cargaEnCurso
  },

  ir: (pantalla) => {
    const de = get().pantalla.id
    // La pantalla cambia con una transición deslizante cuando el navegador la admite (si no, al instante).
    conTransicion(() => {
      set({ pantalla })
      window.scrollTo(0, 0)
    }, direccionNavegacion(de, pantalla.id))
  },

  cambiar: (f) => {
    const progreso = f(get().progreso)
    if (progreso === get().progreso) return
    set({ progreso })
    // En modo profesorado se puede jugar con todo, pero nunca se guarda nada.
    if (MODO_PROFESOR) return
    pendiente = true
    revision++
    window.clearTimeout(temporizadorGuardado)
    if (MODO_COMPARTIR) {
      void guardarPendiente(get, set)
      return
    }
    temporizadorGuardado = window.setTimeout(() => {
      void guardarPendiente(get, set)
    }, 400)
  },

  descubrir: (conceptoId) =>
    get().cambiar((p) => {
      const actual: EstadoConcepto = p.conceptos[conceptoId] ?? estadoNuevo()
      if (actual.descubierto) return p
      return { ...p, conceptos: { ...p.conceptos, [conceptoId]: { ...actual, descubierto: hoy() } } }
    }),

  responder: (sesion, item, acierto, segundos, objetivo) =>
    get().cambiar((p) => {
      const conceptos = { ...p.conceptos }
      for (const id of item.conceptos) {
        const e = conceptos[id]
        if (!e?.descubierto) continue
        if (sesion.tipo === 'turno' || sesion.tipo === 'aprender' || (sesion.tipo === 'breve' && sesion.repasoEspaciado)) {
          // La primera revisión de un concepto nuevo nunca cuenta como "muy fácil": un solo acierto rápido no justifica esperar una semana.
          let nota = notaFsrs(acierto, segundos, objetivo)
          if (e.tarjeta.state === State.New && nota === Rating.Easy) nota = Rating.Good
          conceptos[id] = { ...repasar(e, nota), ultimoMotor: motorDe(item) }
        } else if (!acierto && e.tarjeta.state !== State.New) {
          // Juego libre y exámenes: un fallo trae el concepto a repaso pronto; un acierto no altera el calendario.
          conceptos[id] = repasar(e, Rating.Again)
        } else {
          // Aun así cuentan para las estadísticas (dónde fallas más, qué dominas).
          conceptos[id] = acierto ? { ...e, aciertos: e.aciertos + 1 } : { ...e, fallos: e.fallos + 1 }
        }
      }
      // Actividad por día y asignatura (para "lo que menos has tocado esta semana").
      const dia = hoy()
      const modulo = get().indice?.unidades.find((u) => u.id === item.unidadId)?.modulo ?? '?'
      const deHoy = { ...(p.actividad[dia] ?? {}) }
      deHoy[modulo] = (deHoy[modulo] ?? 0) + 1
      const actividad = Object.fromEntries(Object.entries({ ...p.actividad, [dia]: deHoy }).sort().slice(-60))
      return { ...p, conceptos, actividad }
    }),

  terminarSesion: (r) => {
    const { sesion } = r
    // En un examen que termina por tiempo, el total son todas sus preguntas (las no respondidas cuentan como falladas).
    const total = sesion.tipo === 'examen' ? sesion.pasos.filter((x) => x.tipo === 'item').length : r.respuestas.length
    let record = false
    let recordAnterior: number | undefined
    get().cambiar((p) => {
      const dia = hoy()
      let q: Progreso = {
        ...p,
        xp: p.xp + r.xp,
        sueldo: p.sueldo + r.respuestas.filter((x) => x.acierto).length * 10,
        xpDia: { ...p.xpDia, [dia]: (p.xpDia[dia] ?? 0) + r.xp },
      }
      if (sesion.juegoId) {
        const prev = p.juegos[sesion.juegoId] ?? { mejor: 0, mejorEstrellas: 0, historial: [] }
        const porNota = sesion.tipo === 'examen' && r.nota !== undefined
        recordAnterior = prev.historial.length ? (porNota ? prev.mejorNota : prev.mejor) : undefined
        record = prev.historial.length > 0 && (porNota ? r.nota! > (prev.mejorNota ?? 0) : r.puntos > prev.mejor)
        const partida: Partida = { fecha: new Date().toISOString(), puntos: r.puntos, estrellas: r.estrellas, aciertos: r.respuestas.filter((x) => x.acierto).length, total, nota: r.nota }
        q = {
          ...q,
          juegos: {
            ...q.juegos,
            [sesion.juegoId]: {
              mejor: Math.max(prev.mejor, r.puntos),
              mejorEstrellas: Math.max(prev.mejorEstrellas, r.estrellas),
              mejorNota: r.nota !== undefined ? Math.max(prev.mejorNota ?? 0, r.nota) : prev.mejorNota,
              historial: [...prev.historial, partida].slice(-50),
            },
          },
        }
      }
      if (sesion.modulo && r.nota !== undefined) {
        const previos = q.simulacros?.[sesion.modulo] ?? []
        const aciertos = r.respuestas.filter((x) => x.acierto).length
        q = { ...q, simulacros: { ...q.simulacros, [sesion.modulo]: [...previos, { fecha: new Date().toISOString(), nota: r.nota, aciertos, total }].slice(-20) } }
      }
      if (sesion.tipo === 'turno') {
        const d = hoy()
        const t = q.turnos[d] ?? { xp: 0, items: 0, aciertos: 0 }
        q = {
          ...q,
          racha: actualizarRacha(q.racha, d),
          turnos: { ...q.turnos, [d]: { xp: t.xp + r.xp, items: t.items + r.respuestas.length, aciertos: t.aciertos + r.respuestas.filter((x) => x.acierto).length } },
        }
      }
      if (sesion.tipo === 'breve' && r.respuestas.length > 0) q = { ...q, racha: actualizarRacha(q.racha, dia) }
      return q
    })
    return { ...r, record, recordAnterior }
  },

  informar: async (item, tipo, comentario) => {
    await enviarInforme({ ejercicio: item.clave, unidad: item.unidadId, tipo, comentario, vista: item.vista })
    // Un ejercicio del contenido con informe de error se retira hasta que se revise (los generados no se pueden retirar uno a uno).
    if (tipo === 'error' && !item.clave.startsWith('gen:'))
      get().cambiar((p) => ({ ...p, ocultos: [...new Set([...p.ocultos, item.clave])] }))
  },
}))

// Señal de vida para que el servidor sepa que la ventana sigue abierta.
export function iniciarLatido() {
  const latir = () => void fetch('/api/ping').catch(() => undefined)
  let intervalo: number | undefined
  if (!MODO_COMPARTIR) {
    latir()
    intervalo = window.setInterval(latir, 10_000)
  }
  // Al cerrar, solo se envía si quedan cambios sin guardar: así no se pisa el progreso con una copia antigua.
  const alCerrar = (evento: BeforeUnloadEvent) => {
    if (!pendiente || MODO_PROFESOR) return
    const p = useTienda.getState().progreso
    if (MODO_COMPARTIR) {
      void guardarPendiente(useTienda.getState, useTienda.setState)
      // Un Web Lock puede seguir en cola. El navegador debe advertir antes de perder cambios.
      evento.preventDefault()
      evento.returnValue = ''
      return
    }
    const base = versionDelProgreso()
    // Un PUT en vuelo puede cambiar la base antes del beacon. Si ya falló el guardado,
    // tampoco se puede dar por enviado: se conserva pendiente y se avisa al salir.
    if (!guardando && !errorDeGuardadoMostrado && base) {
      try {
        if (navigator.sendBeacon?.(`/api/progreso-beacon?base=${encodeURIComponent(base)}`, JSON.stringify(p))) return
      } catch { /* El navegador no pudo encolar el envío; el aviso permite quedarse. */ }
    }
    evento.preventDefault()
    evento.returnValue = ''
  }
  const alOcultar = () => {
    if (document.visibilityState === 'hidden') void guardarPendiente(useTienda.getState, useTienda.setState)
  }
  const alVolver = () => void guardarPendiente(useTienda.getState, useTienda.setState)
  window.addEventListener('beforeunload', alCerrar)
  document.addEventListener('visibilitychange', alOcultar)
  window.addEventListener('online', alVolver)
  return () => {
    window.clearInterval(intervalo)
    window.removeEventListener('beforeunload', alCerrar)
    document.removeEventListener('visibilitychange', alOcultar)
    window.removeEventListener('online', alVolver)
  }
}
