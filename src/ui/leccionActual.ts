import { createContext } from 'react'

/** Concepto que se está estudiando: un término del glosario que se explica en él no remite a «la lección» actual. */
export const LeccionActual = createContext<string | undefined>(undefined)
