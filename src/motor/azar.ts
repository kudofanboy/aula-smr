/** Devuelve una copia barajada (Fisher-Yates). */
export function barajar<T>(lista: readonly T[]): T[] {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function elegir<T>(lista: readonly T[]): T {
  if (lista.length === 0) throw new Error('Lista vacía')
  return lista[Math.floor(Math.random() * lista.length)]
}

/** Entero aleatorio entre min y max, ambos incluidos. */
export function entero(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}
