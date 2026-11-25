import { useEffect, useState } from 'react'
import type { Fase, PazienteDettaglio, SedutaRiepilogo, StatoProgressione } from '../../../../shared/types'
import { quoteLavoro, type Voce } from '../../../../shared/dose'
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
  // su cosa si e' lavorato: quota di serie per voce della dose
  lavoroUltima: { voce: Voce; nome: string; percento: number }[]
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
  lavoroUltima: [],
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

// Legge tutto quello che serve al Quadro. Una lettura che fallisce non si porta
// dietro le altre: al suo posto un valore vuoto, e l'errore (il primo) torna
// insieme ai dati, per avvisare una volta sola.
export async function leggiDatiQuadro(
  paziente: PazienteDettaglio,
  sedute: SedutaRiepilogo[]
): Promise<{ dati: DatiQuadro; errore: string | null }> {
  const api = window.api
  const oggi = oggiIso()
  const faseId = paziente.fase_corrente_id
  const ultima = sedute.find((s) => s.data <= oggi) ?? null
  let primoErrore: string | null = null
  const prendi = <T,>(p: Promise<T>, vuoto: T): Promise<T> =>
    p.catch((e) => {
      primoErrore ??= errMsg(e)
      return vuoto
    })

  const [punti, dettaglio, obiettivi, raggiunti, progressioni, pedana, compilazioni, promemoria, charts, valutazioni, segni, massimali, carico] =
    await Promise.all([
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
    ])
  const fatte = sedute.filter((s) => s.data <= oggi)
  return {
    errore: primoErrore,
    dati: {
      pronto: true,
      ultima,
      eserciziUltima: (dettaglio?.sezioni ?? []).flatMap((s) => s.esercizi.map((e) => e.nome)),
      lavoroUltima: quoteLavoro(
        (dettaglio?.sezioni ?? []).flatMap((s) =>
          s.esercizi.map((e) => ({ tipo: e.tipo ?? null, conta: e.conta, obiettivo: s.obiettivo ?? null, serie: e.serie }))
        )
      ),
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
    }
  }
}

// La scheda del paziente gia' letta, tenuta da parte.
//
// Aprendo un paziente (o tornando a lui da una seduta) la scheda si montava da
// capo e leggeva sedute, fasi e Quadro solo dopo essere comparsa: per un attimo
// si vedeva il Quadro vuoto («Questa patologia non ha fasi») e poi i riquadri
// che arrivavano. Adesso chi apre la scheda la prepara prima (`preparaScheda`):
// la scheda parte da qui, gia' piena, e si rilegge in silenzio.
export interface SchedaPronta {
  sedute: SedutaRiepilogo[]
  fasi: Fase[]
  dati: DatiQuadro
}

const schede = new Map<number, SchedaPronta>()

export const schedaPronta = (pazienteId: number): SchedaPronta | undefined => schede.get(pazienteId)

export function ricordaScheda(pazienteId: number, parte: Partial<SchedaPronta>): void {
  const prima = schede.get(pazienteId)
  if (prima) schede.set(pazienteId, { ...prima, ...parte })
  else if (parte.sedute && parte.fasi && parte.dati)
    schede.set(pazienteId, { sedute: parte.sedute, fasi: parte.fasi, dati: parte.dati })
}

// Legge tutto quello che la scheda mostra appena aperta. Non fallisce mai: nel
// peggiore dei casi la scheda si apre come prima e si riempie da sola.
export async function preparaScheda(paziente: PazienteDettaglio): Promise<void> {
  try {
    const [sedute, fasi] = await Promise.all([
      window.api.sedute.list(paziente.id),
      paziente.patologia_id == null ? Promise.resolve([] as Fase[]) : window.api.fasi.list(paziente.patologia_id)
    ])
    const { dati } = await leggiDatiQuadro(paziente, sedute)
    schede.set(paziente.id, { sedute, fasi, dati })
  } catch {
    // la scheda leggera' da se'
  }
}

// `quando` cambia ogni volta che si cambia linguetta: tornando al Quadro i
// numeri sono freschi anche se nel frattempo si e' compilato un questionario.
export function useDatiQuadro(
  paziente: PazienteDettaglio,
  sedute: SedutaRiepilogo[],
  quando: unknown
): DatiQuadro {
  const [dati, setDati] = useState<DatiQuadro>(() => schede.get(paziente.id)?.dati ?? VUOTO)

  useEffect(() => {
    let attuale = true
    void leggiDatiQuadro(paziente, sedute).then(({ dati: letti, errore }) => {
      if (!attuale) return
      if (errore) toastErrore(errore)
      setDati(letti)
      ricordaScheda(paziente.id, { dati: letti })
    })
    return () => {
      attuale = false
    }
    // Il paziente intero: dopo ogni seduta salvata l'oggetto cambia e tutto si rilegge.
  }, [paziente, sedute, quando])

  return dati
}
