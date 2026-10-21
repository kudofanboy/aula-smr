// Solo se carga en las versiones que funcionan sin el servidor personal.
export const contenidoEmpaquetado = import.meta.glob('../../contenido/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>
