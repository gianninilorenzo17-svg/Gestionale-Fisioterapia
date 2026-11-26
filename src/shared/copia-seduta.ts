// Copiare una seduta (da un altro giorno, o programmandola sulla settimana): la
// copia prende la fase in cui il paziente e' adesso, non quella di allora. Lo
// usano la seduta che si compone e il processo principale.
import type { ObiettivoSezione } from './dose'

// La fase della copia: quella impostata nel Percorso. Una seduta al campo resta
// sulla sua fase del campo, che e' un percorso parallelo. Senza una fase
// impostata resta quella della seduta copiata.
export function faseDellaCopia(
  corrente: number | null,
  copiata: number | null,
  alCampo: (faseId: number) => boolean
): number | null {
  if (corrente == null) return copiata
  if (copiata != null && alCampo(copiata) && !alCampo(corrente)) return copiata
  return corrente
}

// Le sezioni copiate portate nella fase nuova: quella con lo stesso nome prende
// il suo collegamento (proposte e obiettivo), le altre restano solo di quella
// seduta. Gli esercizi non si toccano.
export function sezioniNellaFase<
  T extends { sezione_id: number | null; nome: string; obiettivo?: ObiettivoSezione | null }
>(sezioni: T[], dellaFase: { id: number; nome: string; obiettivo: ObiettivoSezione | null }[]): T[] {
  const chiave = (nome: string): string => nome.trim().toLowerCase()
  return sezioni.map((s) => {
    const uguale = dellaFase.find((t) => chiave(t.nome) === chiave(s.nome))
    return uguale
      ? { ...s, sezione_id: uguale.id, obiettivo: uguale.obiettivo ?? s.obiettivo ?? null }
      : { ...s, sezione_id: null }
  })
}
