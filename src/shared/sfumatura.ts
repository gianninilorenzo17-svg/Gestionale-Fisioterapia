// L'area sfumata sotto la linea dei grafici: il colore della linea, pieno
// vicino alla linea e sempre piu' trasparente verso l'asse. Serve a tutti i
// grafici dei documenti (SVG scritto come testo); nella pagina si usa lo stesso
// disegno con gli stessi numeri.

export const SFUMATURA_SOPRA = 0.32
export const SFUMATURA_SOTTO = 0.02

let contatore = 0

// Un nome per ogni sfumatura: piu' grafici stanno nella stessa pagina HTML e
// condividono lo spazio dei nomi, quindi due «sfumatura» uguali si
// confonderebbero fra loro.
export function nuovoIdSfumatura(): string {
  contatore += 1
  return `sfum${contatore}`
}

// La definizione del gradiente verticale (da mettere dentro l'SVG).
export function defSfumatura(id: string, colore: string, sopra = SFUMATURA_SOPRA): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${colore}" stop-opacity="${sopra}"/>
      <stop offset="1" stop-color="${colore}" stop-opacity="${SFUMATURA_SOTTO}"/>
    </linearGradient>`
}

// L'area chiusa fra la linea e l'asse orizzontale `base`, riempita con la
// sfumatura. Va disegnata PRIMA della linea. Con meno di due punti non c'e'
// niente da riempire.
export function areaSfumata(
  punti: { x: number; y: number }[],
  base: number,
  colore: string,
  sopra = SFUMATURA_SOPRA
): string {
  if (punti.length < 2) return ''
  const id = nuovoIdSfumatura()
  const linea = punti.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const ultimo = punti[punti.length - 1]
  const d = `${linea} L${ultimo.x},${base} L${punti[0].x},${base} Z`
  return `<defs>${defSfumatura(id, colore, sopra)}</defs><path d="${d}" fill="url(#${id})" stroke="none"/>`
}
