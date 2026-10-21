import type { EventoCalendario } from '../contenido/esquema'
import { hoy } from './progreso'

/** Avisos voluntarios y festivos se consultan en Agenda; Pendiente reserva sitio a tareas. */
export function tareasPendientes(eventos: EventoCalendario[], hechas: ReadonlySet<string>, ahora = new Date()): EventoCalendario[] {
  const fecha = hoy(ahora)
  return eventos.filter((e) => (e.tipo === 'entrega' || e.tipo === 'cuestionario') && e.fecha >= fecha && !hechas.has(e.id))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? ''))
}
