// Come si scrive la dose nella scheda che si mostra al paziente.
//
// Due stili: «bolle» (la dose a frase, con carico e recupero in due bolle
// colorate) e «caselle» (quattro caselle bianche fisse: Serie, Rip., Carico,
// Recupero). Si sceglie in Impostazioni > Accesso e aspetto, e per la scheda
// SENZA immagini e quella CON immagini la scelta e' indipendente.
//
// Come il tema (vedi temi.ts) lo scelto e' ricordato in impostazioni.json e il
// processo principale lo scrive qui all'avvio e a ogni cambio: i generatori dei
// documenti non dipendono da Electron e lo leggono da qui.

export type StileScheda = 'bolle' | 'caselle'
export type QualeScheda = 'senza' | 'con'

export const STILI_SCHEDA: { valore: StileScheda; etichetta: string }[] = [
  { valore: 'bolle', etichetta: 'Bolle colorate' },
  { valore: 'caselle', etichetta: 'Caselle bianche' }
]

export function stileValido(v: unknown): StileScheda {
  return v === 'caselle' ? 'caselle' : 'bolle'
}

const corrente: Record<QualeScheda, StileScheda> = { senza: 'bolle', con: 'bolle' }

export function impostaStileCorrente(quale: QualeScheda, stile: unknown): void {
  corrente[quale] = stileValido(stile)
}

export function stileScheda(quale: QualeScheda): StileScheda {
  return corrente[quale]
}
