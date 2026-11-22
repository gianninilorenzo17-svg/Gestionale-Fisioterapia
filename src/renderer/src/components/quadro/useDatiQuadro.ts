import { useEffect, useState } from 'react'
import type { PazienteDettaglio, SedutaRiepilogo, StatoProgressione } from '../../../../shared/types'
import { riepilogoPedana } from '../../../../shared/pedana'
import {
  inFaseDal,
  lsiPiuBasso,
  promemoriaInVista,
  settimanaCorrente,
  sintesiDolore,
  ultimoQuestionario,
  type LsiBasso,
  type PromemoriaInVista,
  type Settimana,
  type SintesiDolore,
  type UltimoQuestionario
} from '../../../../shared/quadro'
import { errMsg, oggiIso } from '../../lib'
import { toastErrore } from '../Toast'

// Tutto quello che la scheda del paziente sa di lui, letto una volta sola e
// passato al Quadro e agli elenchi di Clinica e Percorso: cosi' lo stesso dato
// (gli obiettivi, le progressioni) non si chiede due volte. Non c'e' niente di
// nuovo da scrivere: sono letture di cose che l'app ha gia'.
export interface DatiQuadro {
  // false finche' non e' arrivata la prima lettura: niente riquadri a meta'
  pronto: boolean
  // sedute
  ultima: SedutaRiepilogo | null
  eserciziUltima: string[]
  programmate: SedutaRiepilogo[]
  fatte: number
  settimana: Settimana
  inFaseDal: string | null
  // percorso
  obiettivi: { nome: string; raggiunto: boolean }[]
  progressioni: StatoProgressione[]
  // numeri
  dolore: SintesiDolore | null
  lsi: LsiBasso | null
  questionario: UltimoQuestionario | null
  promemoria: PromemoriaInVista
  // quante cose ci sono in ogni parte (per le note degli elenchi)
  compilazioni: number
  bodyChart: { quante: number; ultima: string | null }
  valutazioni: { quante: number; ultima: string | null }
  segni: number
  massimali: number
  carico: { settimane: number; avviso: boolean } | null
}

const VUOTO: DatiQuadro = {
  pronto: false,
  ultima: null,
  eserciziUltima: [],
  programmate: [],
  fatte: 0,
  settimana: { fatte: 0, previste: null },
  inFaseDal: null,
  obiettivi: [],
  progressioni: [],
  dolore: null,
  lsi: null,
  questionario: null,
  promemoria: { aperti: 0, scaduti: 0, primo: null, giorniScaduto: null },
  compilazioni: 0,
  bodyChart: { quante: 0, ultima: null },
  valutazioni: { quante: 0, ultima: null },
  segni: 0,
  massimali: 0,
  carico: null
}

// Il piu' recente di un elenco di date
const piuRecente = (date: string[]): string | null =>
  date.length === 0 ? null : [...date].sort((a, b) => b.localeCompare(a))[0]

// `quando` cambia ogni volta che si cambia linguetta: tornando al Quadro i
// numeri sono freschi anche se nel frattempo si e' compilato un questionario.
export function useDatiQuadro(
  paziente: PazienteDettaglio,
  sedute: SedutaRiepilogo[],
  quando: unknown
): DatiQuadro {
  const [dati, setDati] = useState<DatiQuadro>(VUOTO)

  useEffect(() => {
    let attuale = true
    const api = window.api
    const oggi = oggiIso()
    const faseId = paziente.fase_corrente_id
    const ultima = sedute.find((s) => s.data <= oggi) ?? null
    let primoErrore: string | null = null
    // Una lettura che fallisce non deve portarsi dietro le altre: si mette un
    // valore vuoto e si avvisa una volta sola.
    const prendi = <T,>(p: Promise<T>, vuoto: T): Promise<T> =>
      p.catch((e) => {
        primoErrore ??= errMsg(e)
        return vuoto
      })

    void Promise.all([
      prendi(api.pazienti.andamentoDolore(paziente.id), []),
      ultima ? prendi(api.sedute.get(ultima.id), null) : Promise.resolve(null),
      faseId != null ? prendi(api.obiettivi.list(faseId), []) : Promise.resolve([]),
      prendi(api.pazienti.obiettiviRaggiunti(paziente.id), []),
      prendi(api.progressioni.stato(paziente.id, faseId, oggi, null), []),
      prendi(api.pedana.archivio(paziente.id), null),
      prendi(api.compilazioni.list(paziente.id), []),
      prendi(api.promemoria.list(paziente.id), []),
      prendi(api.bodyChart.list(paziente.id), []),
      prendi(api.valutazioni.list(paziente.id), []),
      prendi(api.segni.andamento(paziente.id), []),
      prendi(api.massimali.list(paziente.id), []),
      prendi(api.dose.caricoPaziente(paziente.id), null)
    ]).then(
      ([punti, dettaglio, obiettivi, raggiunti, progressioni, pedana, compilazioni, promemoria, charts, valutazioni, segni, massimali, carico]) => {
        if (!attuale) return
        if (primoErrore) toastErrore(primoErrore)
        const fatte = sedute.filter((s) => s.data <= oggi)
        setDati({
          pronto: true,
          ultima,
          eserciziUltima: (dettaglio?.sezioni ?? []).flatMap((s) => s.esercizi.map((e) => e.nome)),
          programmate: sedute
            .filter((s) => s.data > oggi)
            .sort((a, b) => a.data.localeCompare(b.data) || (a.ora ?? '').localeCompare(b.ora ?? '')),
          fatte: fatte.length,
          settimana: settimanaCorrente(fatte, oggi, paziente.sedute_settimana),
          inFaseDal: inFaseDal(sedute, paziente.fase_nome, oggi),
          obiettivi: obiettivi.map((o) => ({ nome: o.nome, raggiunto: raggiunti.includes(o.id) })),
          progressioni,
          dolore: sintesiDolore(punti),
          lsi: pedana ? lsiPiuBasso(riepilogoPedana(pedana)) : null,
          questionario: ultimoQuestionario(compilazioni),
          promemoria: promemoriaInVista(promemoria, oggi),
          compilazioni: compilazioni.length,
          bodyChart: { quante: charts.length, ultima: piuRecente(charts.map((c) => c.data)) },
          valutazioni: { quante: valutazioni.length, ultima: piuRecente(valutazioni.map((v) => v.data)) },
          segni: segni.length,
          massimali: massimali.length,
          carico:
            carico && carico.chiavi.length > 0 && carico.settimane.length > 0
              ? { settimane: carico.settimane.length, avviso: carico.avviso != null }
              : null
        })
      }
    )
    return () => {
      attuale = false
    }
    // Il paziente intero: dopo ogni seduta salvata l'oggetto cambia e tutto si rilegge.
  }, [paziente, sedute, quando])

  return dati
}
