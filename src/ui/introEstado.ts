let yaMostrada = false

/** La entrada se muestra una vez por apertura del juego (no cada vez que se recarga un dato). */
export const introPendiente = () => !yaMostrada

export function marcarIntroMostrada(): void {
  yaMostrada = true
}
