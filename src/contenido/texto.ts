// Formato ligero de los textos del contenido (v2): **negrita**, *cursiva*, listas con "- " y términos del glosario
// como [[id]] o [[id|texto visible]]. Un término puede ir dentro de una negrita o una cursiva. Aquí solo se analiza;
// el dibujo está en src/ui/TextoRico.tsx.

export type Trozo =
  | { tipo: 'texto'; texto: string; negrita?: boolean; cursiva?: boolean }
  | { tipo: 'termino'; id: string; texto: string; negrita?: boolean; cursiva?: boolean }

export type Bloque = { tipo: 'parrafo'; trozos: Trozo[] } | { tipo: 'lista'; elementos: Trozo[][] }

const NEGRITA = /\*\*(.+?)\*\*/g
/** Un solo asterisco a cada lado (no parte de una negrita). */
const CURSIVA = /(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g
const TERMINO = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g

const visible = (id: string, texto?: string) => texto ?? id.replace(/-/g, ' ')

/** Texto normal y términos del glosario de un fragmento sin negritas ni cursivas. */
function terminos(fragmento: string, negrita: boolean, cursiva = false): Trozo[] {
  const res: Trozo[] = []
  const n = { ...(negrita ? { negrita } : {}), ...(cursiva ? { cursiva } : {}) }
  let ultimo = 0
  for (const m of fragmento.matchAll(TERMINO)) {
    if (m.index > ultimo) res.push({ tipo: 'texto', texto: fragmento.slice(ultimo, m.index), ...n })
    res.push({ tipo: 'termino', id: m[1], texto: visible(m[1], m[2]), ...n })
    ultimo = m.index + m[0].length
  }
  if (ultimo < fragmento.length) res.push({ tipo: 'texto', texto: fragmento.slice(ultimo), ...n })
  return res
}

/** Cursivas dentro de un fragmento ya separado de las negritas. */
function cursivas(fragmento: string, negrita: boolean): Trozo[] {
  const res: Trozo[] = []
  let ultimo = 0
  for (const m of fragmento.matchAll(CURSIVA)) {
    if (m.index > ultimo) res.push(...terminos(fragmento.slice(ultimo, m.index), negrita))
    res.push(...terminos(m[1], negrita, true))
    ultimo = m.index + m[0].length
  }
  if (ultimo < fragmento.length) res.push(...terminos(fragmento.slice(ultimo), negrita))
  return res
}

/** Trozos de una línea: texto normal, negrita, cursiva y términos del glosario (también dentro de ellas). */
export function trozos(linea: string): Trozo[] {
  const res: Trozo[] = []
  let ultimo = 0
  for (const m of linea.matchAll(NEGRITA)) {
    if (m.index > ultimo) res.push(...cursivas(linea.slice(ultimo, m.index), false))
    res.push(...cursivas(m[1], true))
    ultimo = m.index + m[0].length
  }
  if (ultimo < linea.length) res.push(...cursivas(linea.slice(ultimo), false))
  return res
}

/** Párrafos (separados por salto de línea) y listas (líneas seguidas que empiezan por "- "). */
export function bloques(texto: string): Bloque[] {
  const res: Bloque[] = []
  for (const linea of texto.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (linea.startsWith('- ')) {
      const anterior = res.at(-1)
      const elemento = trozos(linea.slice(2))
      if (anterior?.tipo === 'lista') anterior.elementos.push(elemento)
      else res.push({ tipo: 'lista', elementos: [elemento] })
    } else res.push({ tipo: 'parrafo', trozos: trozos(linea) })
  }
  return res
}

/** El texto sin marcas, para buscar, comparar o mostrarlo donde no cabe formato (botones). */
export function textoPlano(texto: string): string {
  return texto.replace(TERMINO, (_, id: string, texto?: string) => visible(id, texto)).replace(NEGRITA, '$1').replace(CURSIVA, '$1')
}

/** Ids del glosario citados en un texto (también los que van dentro de una negrita). */
export function terminosCitados(texto: string): string[] {
  return [...texto.matchAll(TERMINO)].map((m) => m[1])
}

/** Cómo citar la posición dentro de una fuente: «, pág. 3», «, apartado 7» o nada para una web sin numerar. */
export function lugarEnFuente(fuente: { ruta: string; localizador?: 'pagina' | 'apartado' | 'ninguno' } | undefined, pag: number): string {
  const tipo = fuente?.localizador ?? (fuente?.ruta.startsWith('http') ? 'ninguno' : 'pagina')
  if (tipo === 'ninguno') return ''
  return tipo === 'apartado' ? `, apartado ${pag}` : `, pág. ${pag}`
}
