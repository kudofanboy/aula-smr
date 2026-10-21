// Tipografías incluidas en el juego (solo el subconjunto latino, que cubre el español): funcionan sin internet.
// Inter para leer, Space Grotesk para títulos y JetBrains Mono para códigos, cifras y datos técnicos. Licencia OFL.
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import grotesk from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url'
import mono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url'

export function cargarFuentes() {
  const fuentes: [string, string, string][] = [
    ['Inter', inter, '100 900'],
    ['Space Grotesk', grotesk, '300 700'],
    ['JetBrains Mono', mono, '100 800'],
  ]
  for (const [nombre, url, peso] of fuentes) {
    const f = new FontFace(nombre, `url(${url}) format('woff2')`, { weight: peso, display: 'swap' })
    document.fonts.add(f)
    f.load().catch(() => { /* si falla, se usa la fuente del sistema */ })
  }
}
