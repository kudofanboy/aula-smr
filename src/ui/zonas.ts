// Zonas pulsables dentro de cada sala (centro y tamaño en píxeles de la ilustración 1672 × 941).
// Las salas de las asignaturas se muestran recortadas: según el tamaño de ventana se ven entre y≈183 y y≈666 como mínimo
// (en pantallas anchas) y hasta y≈124–755 en portátiles. Las zonas deben tener su parte alta por debajo de y≈230 para que
// su cartel se vea siempre, y su centro por encima de y≈650.
export type Caja = [cx: number, cy: number, ancho: number, alto: number]

export interface ZonasSala {
  /** Pizarra, pantalla o tablón: lleva a la siguiente lección. */
  leccion: Caja
  /** Mesa de trabajo: lleva a los casos prácticos. */
  casos: Caja
  /** Estantería, armario o taquillas: lleva a la práctica libre de la asignatura. */
  practicar: Caja
}

export const ZONAS: Record<string, ZonasSala> = {
  REDES: { leccion: [900, 300, 440, 130], casos: [1260, 570, 800, 200], practicar: [590, 420, 360, 120] },
  SOM: { leccion: [1245, 375, 590, 160], casos: [1500, 560, 340, 110], practicar: [840, 350, 160, 220] },
  MME: { leccion: [1200, 420, 200, 170], casos: [1210, 590, 800, 160], practicar: [1550, 320, 200, 150] },
  AOF: { leccion: [1008, 330, 360, 170], casos: [1000, 510, 520, 110], practicar: [1330, 350, 200, 200] },
  ING: { leccion: [1350, 290, 420, 100], casos: [1250, 480, 560, 120], practicar: [870, 380, 330, 200] },
  IPE: { leccion: [1290, 290, 440, 120], casos: [1070, 540, 780, 130], practicar: [790, 300, 190, 140] },
}

/** Puertas de la oficina, una por asignatura, con el rótulo corto de su cartel. `fila` evita que se pisen los carteles contiguos. */
export const PUERTAS: Record<string, { caja: Caja; rotulo: string; fila: 0 | 1 }> = {
  REDES: { caja: [1256, 335, 34, 220], rotulo: 'Redes', fila: 0 },
  SOM: { caja: [1302, 330, 42, 245], rotulo: 'Sistemas', fila: 1 },
  MME: { caja: [1360, 335, 52, 275], rotulo: 'Montaje', fila: 0 },
  AOF: { caja: [1424, 330, 66, 335], rotulo: 'Ofimática', fila: 1 },
  ING: { caja: [1516, 330, 82, 395], rotulo: 'Inglés', fila: 0 },
  IPE: { caja: [1628, 340, 100, 485], rotulo: 'IPE', fila: 0 },
}
