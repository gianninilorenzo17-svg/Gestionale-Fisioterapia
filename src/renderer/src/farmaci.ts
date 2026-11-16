// I farmaci nella pagina: l'indice dei nomi si legge una volta sola e si tiene
// qui; quando si cambia qualcosa (una scheda, un collegamento, l'elenco AIFA) si
// invalida e chi lo usa lo rilegge. Il riconoscimento nel testo e' una ricerca
// in una mappa: niente di pesante, e parte solo quando si smette di scrivere.
import { useEffect, useState } from 'react'
import {
  preparaRicerca,
  type FarmacoScheda,
  type IndiceDiRicerca,
  type IndiceFarmaci
} from '../../shared/farmaci'

export interface DatiFarmaci {
  indice: IndiceFarmaci
  ricerca: IndiceDiRicerca
  schedaPerId: Map<number, FarmacoScheda>
  // I nomi da proporre mentre si scrive, con la maiuscola iniziale
  suggerimenti: string[]
}

let dati: DatiFarmaci | null = null
let inCorso: Promise<DatiFarmaci> | null = null
const ascoltatori = new Set<() => void>()

function costruisci(indice: IndiceFarmaci): DatiFarmaci {
  const nomi = new Set<string>()
  for (const chiave of Object.keys(indice.nomi)) nomi.add(chiave)
  return {
    indice,
    ricerca: preparaRicerca(indice),
    schedaPerId: new Map(indice.schede.map((s) => [s.id, s])),
    suggerimenti: [...nomi].sort((a, b) => a.localeCompare(b, 'it'))
  }
}

export function caricaFarmaci(): Promise<DatiFarmaci> {
  if (dati) return Promise.resolve(dati)
  inCorso ??= window.api.farmaci
    .indice()
    .then((indice) => {
      dati = costruisci(indice)
      return dati
    })
    .finally(() => {
      inCorso = null
    })
  return inCorso
}

// Dopo ogni modifica ai farmaci: chi ascolta si aggiorna.
export function invalidaFarmaci(): void {
  dati = null
  inCorso = null
  void caricaFarmaci().then(() => ascoltatori.forEach((a) => a()))
}

// null finche' non e' arrivato: la pagina funziona senza, solo senza sottolineature.
export function useFarmaci(): DatiFarmaci | null {
  const [corrente, setCorrente] = useState<DatiFarmaci | null>(dati)
  useEffect(() => {
    let vivo = true
    const aggiorna = (): void => {
      if (dati && vivo) setCorrente(dati)
    }
    ascoltatori.add(aggiorna)
    void caricaFarmaci().then(aggiorna, () => undefined)
    return () => {
      vivo = false
      ascoltatori.delete(aggiorna)
    }
  }, [])
  return corrente
}
