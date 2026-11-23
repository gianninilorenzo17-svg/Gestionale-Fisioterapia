// Come si scrive una riga della scheda del paziente (a schermo e nel PDF): la
// dose come frase e le gambe accanto al nome. Sta in `shared` perche' la usano
// la finestra e i documenti (che girano nel processo principale).
import {
  aCluster,
  intensitaTesto,
  recuperoTesto,
  ripetizioniTesto,
  volumeTesto,
  type Dosaggio
} from './dosaggio'

export interface Segmento {
  testo: string
  forte: boolean
}

export interface FraseDose {
  // "3 serie da 5 rip.": i pezzi forti si scrivono in grande e colorati.
  lunga: Segmento[]
  // "3 × 5": per le finestre strette.
  corta: string
}

const pieno = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

// Un valore con un tempo ("30"", "15'", "2 min") non e' un numero di ripetizioni:
// dopo non si scrive «rip.».
const eUnTempo = (v: string): boolean => /["'″′]|\b(s|sec|secondi|min|minuti)\b/i.test(v)

// La dose come si direbbe a voce. Con i cluster resta com'e' ("4 × (3 × 2)"):
// spezzarla in parole la renderebbe piu' lunga di quanto serva.
export function fraseDose(d: Partial<Dosaggio>): FraseDose | null {
  const corta = volumeTesto(d)
  if (corta === null) return null
  if (aCluster(d)) return { lunga: [{ testo: corta, forte: true }], corta }
  const serie = pieno(d.serie)
  const rip = pieno(d.ripetizioni)
  if (serie && rip) {
    return {
      lunga: [
        { testo: `${serie} serie`, forte: true },
        { testo: ' da ', forte: false },
        { testo: rip, forte: true },
        ...(eUnTempo(rip) ? [] : [{ testo: ' rip.', forte: false }])
      ],
      corta
    }
  }
  if (serie) return { lunga: [{ testo: `${serie} serie`, forte: true }], corta }
  return {
    lunga: [
      { testo: rip!, forte: true },
      ...(eUnTempo(rip!) || /^\s*\D/.test(rip!) ? [] : [{ testo: ' rip.', forte: false }])
    ],
    corta
  }
}

// Le gambe accanto al nome: «Monopodalico» dove e' segnato, «Bipodalico» dove
// l'esercizio si puo' fare in tutti e due i modi e si e' scelto a due gambe.
// Un esercizio che e' sempre a due gambe, o sempre a una, non scrive niente: lo
// dice gia' il nome.
export function gambeTesto(e: {
  monopodalico?: 0 | 1 | null
  gambe?: string | null
}): { pieno: string; corto: string } | null {
  if (e.monopodalico === 1) return { pieno: 'Monopodalico', corto: 'Mono' }
  if (e.gambe === 'scelta') return { pieno: 'Bipodalico', corto: 'Bi' }
  return null
}

// Le quattro caselle bianche: serie, ripetizioni, carico e recupero, ognuna al
// suo posto. Un dato che manca e' null (la casella resta, vuota e grigia).
export function caselleDose(d: Partial<Dosaggio> & { carico?: string | null; unita_carico?: string | null }): {
  serie: string | null
  rip: string | null
  carico: string | null
  recupero: string | null
} {
  return {
    serie: pieno(d.serie),
    rip: ripetizioniTesto(d),
    carico: intensitaTesto(d),
    recupero: recuperoTesto(d)
  }
}
