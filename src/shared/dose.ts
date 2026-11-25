// Il conto della dose, in un posto solo e senza React: cosa c'e' in una seduta
// (contatti, serie, ripetizioni, secondi) e cosa manca al minimo del modello
// della fase. Lo usano la seduta che si compone, il Quadro, il carico
// settimanale e il processo principale; le prove stanno in test/dose.test.ts.
//
// Le regole vengono dagli appunti di programmazione del fisioterapista:
//  - l'esercizio ha un tipo (pliometria estensiva o intensiva, rinforzo, non
//    conta) e un muscolo principale, che e' la sua categoria;
//  - la sezione della seduta ha un obiettivo, che decide solo dove va il
//    rinforzo: la pliometria si conta ovunque, anche nel riscaldamento;
//  - la pliometria si conta in contatti (serie × cluster × ripetizioni, e a una
//    gamba valgono doppio), forza e ipertrofia in serie per muscolo, la potenza
//    in serie in tutto, l'eccentrica in ripetizioni, l'isometria massimale in
//    secondi;
//  - un cluster 4 × (3 × 2) vale 4 serie, "8-10" vale 8;
//  - la dose e' un minimo: sopra non si segnala mai niente, e nemmeno sotto se
//    le altre sedute della settimana hanno gia' raggiunto il minimo le volte
//    chieste.

export type TipoEsercizio = 'plio_est' | 'plio_int' | 'rinforzo' | 'non_conta'

export const TIPI_ESERCIZIO: { tipo: TipoEsercizio; nome: string }[] = [
  { tipo: 'rinforzo', nome: 'Rinforzo' },
  { tipo: 'plio_est', nome: 'Pliometria estensiva' },
  { tipo: 'plio_int', nome: 'Pliometria intensiva' },
  { tipo: 'non_conta', nome: 'Non conta' }
]

export type Voce = 'potenza' | 'plio_int' | 'plio_est' | 'forza' | 'ipertrofia' | 'eccentrica' | 'isometria'

export interface InfoVoce {
  voce: Voce
  nome: string
  breve: string
  unita: string
  // forza e ipertrofia si contano (e si giudicano) muscolo per muscolo
  perMuscolo: boolean
}

// L'ordine e' quello in cui si leggono ovunque, ed e' quello della seduta.
export const VOCI: InfoVoce[] = [
  { voce: 'potenza', nome: 'Potenza', breve: 'Potenza', unita: 'serie', perMuscolo: false },
  { voce: 'plio_int', nome: 'Pliometria intensiva', breve: 'Plio int.', unita: 'contatti', perMuscolo: false },
  { voce: 'plio_est', nome: 'Pliometria estensiva', breve: 'Plio est.', unita: 'contatti', perMuscolo: false },
  { voce: 'forza', nome: 'Forza', breve: 'Forza', unita: 'serie', perMuscolo: true },
  { voce: 'ipertrofia', nome: 'Ipertrofia', breve: 'Ipertrofia', unita: 'serie', perMuscolo: true },
  { voce: 'eccentrica', nome: 'Eccentrica', breve: 'Eccentrica', unita: 'ripetizioni', perMuscolo: false },
  { voce: 'isometria', nome: 'Isometria massimale', breve: 'Isometria', unita: 'secondi', perMuscolo: false }
]

export const infoVoce = (v: Voce): InfoVoce => VOCI.find((x) => x.voce === v)!
export const voceValida = (v: unknown): v is Voce => VOCI.some((x) => x.voce === v)

// Dove va il rinforzo messo in una sezione. 'pliometria' e 'non_conta' vogliono
// dire la stessa cosa per il rinforzo (non si conta), ma si leggono diversi.
export type ObiettivoSezione =
  | 'forza'
  | 'ipertrofia'
  | 'potenza'
  | 'eccentrica'
  | 'isometria'
  | 'pliometria'
  | 'non_conta'

export const OBIETTIVI: { obiettivo: ObiettivoSezione; nome: string }[] = [
  { obiettivo: 'forza', nome: 'Forza' },
  { obiettivo: 'ipertrofia', nome: 'Ipertrofia' },
  { obiettivo: 'potenza', nome: 'Potenza' },
  { obiettivo: 'eccentrica', nome: 'Eccentrica' },
  { obiettivo: 'isometria', nome: 'Isometria' },
  { obiettivo: 'pliometria', nome: 'Pliometria' },
  { obiettivo: 'non_conta', nome: 'Non conta' }
]

export const obiettivoValido = (o: unknown): o is ObiettivoSezione => OBIETTIVI.some((x) => x.obiettivo === o)
export const tipoEsercizioValido = (t: unknown): t is TipoEsercizio => TIPI_ESERCIZIO.some((x) => x.tipo === t)

// L'eccezione scritta sulla singola riga della seduta: "qui conta come".
export type Conta = Voce | 'non_conta'
export const contaValida = (c: unknown): c is Conta => c === 'non_conta' || voceValida(c)

// Quante gambe: 'scelta' = in seduta si puo' segnare monopodalico; 'una' =
// lo e' sempre (single leg hop: il nome lo dice gia').
export type Gambe = 'due' | 'scelta' | 'una'

// Una riga di seduta come serve al conto.
export interface RigaConto {
  // il muscolo principale: la categoria dell'esercizio
  categoria_id: number | null
  // il tipo dell'esercizio com'era sulla riga (null = non si sa: non si conta)
  tipo: TipoEsercizio | null
  // l'eccezione scelta sulla riga
  conta?: Conta | null
  // l'obiettivo della sezione in cui sta
  obiettivo: ObiettivoSezione | null
  gambe: Gambe | null
  monopodalico?: number | null
  serie: string | null
  cluster: string | null
  ripetizioni: string | null
  // per le isometrie scritte nella casella del carico ("30" con unita' "sec")
  carico?: string | null
  unita_carico?: string | null
}

// Una ripetizione scritta a tempo: 30", 45'', 1', 40 sec, 2 min.
const aTempo = (t: string): boolean => /["'’”″′]|\bsec|\bmin|\d\s*s\b/i.test(t)

// Il primo numero scritto: "8-10" → 8, "10 per gamba" → 10. null se non c'e'
// un numero, o se e' un tempo.
export function primoNumero(testo: string | null | undefined): number | null {
  const t = (testo ?? '').trim()
  if (t === '' || aTempo(t)) return null
  const m = t.match(/\d+(?:[.,]\d+)?/)
  if (!m) return null
  const n = Number(m[0].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// I secondi di un tempo scritto: 30" → 30, 1' → 60, 1'30" → 90, "30-45 sec" →
// 30. null se non e' un tempo.
export function secondiDi(testo: string | null | undefined): number | null {
  const t = (testo ?? '')
    .trim()
    .toLowerCase()
    .replace(/''|’’|”|″/g, '"')
    .replace(/’|′/g, "'")
    .replace(/,/g, '.')
  if (t === '' || !aTempo(t)) return null
  const minuti = t.match(/(\d+(?:\.\d+)?)\s*(?:'|min[a-z]*\.?)\s*(\d+)?/)
  if (minuti) return Number(minuti[1]) * 60 + Number(minuti[2] ?? 0)
  const secondi = t.match(/(\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:"|s)/)
  return secondi ? Number(secondi[1]) : null
}

export const unaGamba = (r: Pick<RigaConto, 'gambe' | 'monopodalico'>): boolean =>
  r.gambe === 'una' || r.monopodalico === 1

// In quale voce finisce una riga: null = non si conta; 'senza' = e' rinforzo ma
// la sezione non ha un obiettivo.
export function voceRiga(r: Pick<RigaConto, 'tipo' | 'conta' | 'obiettivo'>): Voce | 'senza' | null {
  if (r.conta) return r.conta === 'non_conta' ? null : r.conta
  if (r.tipo == null || r.tipo === 'non_conta') return null
  if (r.tipo !== 'rinforzo') return r.tipo
  if (r.obiettivo == null) return 'senza'
  if (r.obiettivo === 'non_conta' || r.obiettivo === 'pliometria') return null
  return r.obiettivo
}

// I secondi tenuti in una riga: dalle ripetizioni ("30""), o dal carico degli
// esercizi che si tengono in secondi (le ripetizioni allora sono le tenute).
function secondiRiga(r: RigaConto): number {
  const dalleRipetizioni = secondiDi(r.ripetizioni)
  if (dalleRipetizioni != null) return dalleRipetizioni
  const unita = (r.unita_carico ?? '').trim().toLowerCase()
  const fattore = /^(s|sec|sec\.|secondi|"|'')$/.test(unita) ? 1 : /^(m|min|min\.|minuti|')$/.test(unita) ? 60 : 0
  const carico = primoNumero(r.carico)
  if (fattore === 0 || carico == null) return secondiDi(r.carico) ?? 0
  return carico * fattore * (primoNumero(r.ripetizioni) ?? 1)
}

// Quanto vale una riga in quella voce.
export function quanto(r: RigaConto, voce: Voce): number {
  const serie = primoNumero(r.serie)
  const cluster = primoNumero(r.cluster) ?? 1
  if (voce === 'plio_est' || voce === 'plio_int') {
    const rip = primoNumero(r.ripetizioni)
    if (rip == null) return 0
    return (serie ?? 1) * cluster * rip * (unaGamba(r) ? 2 : 1)
  }
  if (voce === 'eccentrica') {
    const rip = primoNumero(r.ripetizioni)
    return rip == null ? 0 : (serie ?? 1) * cluster * rip
  }
  if (voce === 'isometria') return (serie ?? 1) * cluster * secondiRiga(r)
  // un'isometria a tempo non e' una serie di forza: le isometrie si contano
  // solo nell'isometria massimale
  if ((r.ripetizioni ?? '').trim() !== '' && aTempo(r.ripetizioni ?? '')) return 0
  return serie ?? 0
}

// La chiave del conto: la voce, e per forza e ipertrofia anche il muscolo.
export const chiaveDose = (voce: Voce, categoriaId: number | null): string =>
  infoVoce(voce).perMuscolo ? `${voce}:${categoriaId ?? 0}` : voce

// Il conto di un elenco di righe: 'plio_est' → 90, 'forza:12' → 4...
export function contaRighe(righe: RigaConto[]): Record<string, number> {
  const conto: Record<string, number> = {}
  for (const r of righe) {
    const voce = voceRiga(r)
    if (voce == null || voce === 'senza') continue
    const n = quanto(r, voce)
    if (n <= 0) continue
    const k = chiaveDose(voce, r.categoria_id)
    conto[k] = (conto[k] ?? 0) + n
  }
  return conto
}

// Le chiavi di una voce presenti in un conto.
const chiaviDi = (conto: Record<string, number>, info: InfoVoce): string[] =>
  Object.keys(conto).filter((k) => (info.perMuscolo ? k.startsWith(`${info.voce}:`) : k === info.voce))

export const totaleVoce = (conto: Record<string, number>, voce: Voce): number =>
  chiaviDi(conto, infoVoce(voce)).reduce((t, k) => t + conto[k], 0)

// I muscoli di una voce, con quanto hanno fatto.
export const muscoliVoce = (conto: Record<string, number>, voce: Voce): { categoria: number; fatto: number }[] =>
  chiaviDi(conto, infoVoce(voce))
    .filter((k) => k.includes(':'))
    .map((k) => ({ categoria: Number(k.slice(k.indexOf(':') + 1)), fatto: conto[k] }))

// ---- Il modello di dose ----

export interface VoceModello {
  voce: Voce
  // per seduta; null tutti e due = si conta ma non si giudica
  minimo: number | null
  massimo: number | null
  // volte a settimana
  volte_min: number | null
  volte_max: number | null
  indicazione: string | null
}

export interface DoseModello {
  id: number
  nome: string
  ordine: number
  // potenza e pliometria intensiva sono alternative: ne basta una
  alternativa: 0 | 1
  voci: VoceModello[]
}

export type DoseModelloInput = Pick<DoseModello, 'nome' | 'alternativa' | 'voci'>

// Le altre sedute della settimana (non quella che si compone, non quelle al
// campo), una per una, gia' contate.
export interface DoseSettimana {
  altre: Record<string, number>[]
}

export interface Mancanza {
  // null = non c'e' nessun muscolo (o la voce non e' per muscolo)
  categoria: number | null
  fatto: number
  minimo: number
}

export interface VoceSeduta {
  voce: Voce
  totale: number
  muscoli: { categoria: number; fatto: number }[]
  minimo: number | null
  // vuoto = niente da segnalare
  mancano: Mancanza[]
}

// Le altre sedute della settimana che quella voce (per un muscolo, o per
// qualunque muscolo) l'hanno fatta con la dose piena.
function sedutePiene(altre: Record<string, number>[], info: InfoVoce, chiave: string | null, minimo: number): number {
  return altre.filter((a) =>
    chiave != null ? (a[chiave] ?? 0) >= minimo : chiaviDi(a, info).some((k) => a[k] >= minimo)
  ).length
}

// La seduta confrontata con il modello: le voci da mostrare (quelle con
// qualcosa dentro e quelle a cui manca qualcosa), nell'ordine di sempre.
export function valutaSeduta(
  modello: DoseModello | null,
  conto: Record<string, number>,
  altre: Record<string, number>[]
): VoceSeduta[] {
  const regola = (v: Voce): VoceModello | undefined => modello?.voci.find((x) => x.voce === v)
  const settimanaFatta = (r: VoceModello, piene: number): boolean => r.volte_min != null && piene >= r.volte_min

  const voci: VoceSeduta[] = VOCI.map((info) => {
    const r = regola(info.voce)
    const minimo = r?.minimo != null && r.minimo > 0 ? r.minimo : null
    const totale = totaleVoce(conto, info.voce)
    const muscoli = muscoliVoce(conto, info.voce)
    const mancano: Mancanza[] = []
    if (r && minimo != null) {
      if (!info.perMuscolo) {
        if (totale < minimo && !settimanaFatta(r, sedutePiene(altre, info, info.voce, minimo))) {
          mancano.push({ categoria: null, fatto: totale, minimo })
        }
      } else if (muscoli.length === 0) {
        if (!settimanaFatta(r, sedutePiene(altre, info, null, minimo))) mancano.push({ categoria: null, fatto: 0, minimo })
      } else {
        for (const m of muscoli) {
          const chiave = chiaveDose(info.voce, m.categoria)
          if (m.fatto < minimo && !settimanaFatta(r, sedutePiene(altre, info, chiave, minimo))) {
            mancano.push({ categoria: m.categoria, fatto: m.fatto, minimo })
          }
        }
      }
    }
    return { voce: info.voce, totale, muscoli, minimo, mancano }
  })

  // Potenza o pliometria intensiva: raggiunta una (qui, o abbastanza volte
  // nella settimana fra l'una e l'altra), l'altra non si segnala.
  const potenza = regola('potenza')
  const plio = regola('plio_int')
  if (modello?.alternativa === 1 && potenza?.minimo && plio?.minimo) {
    const piena = (c: Record<string, number>): boolean =>
      (c.potenza ?? 0) >= potenza.minimo! || (c.plio_int ?? 0) >= plio.minimo!
    const volte = Math.max(potenza.volte_min ?? 0, plio.volte_min ?? 0)
    if (piena(conto) || (volte > 0 && altre.filter(piena).length >= volte)) {
      for (const v of voci) if (v.voce === 'potenza' || v.voce === 'plio_int') v.mancano = []
    }
  }

  return voci.filter((v) => v.totale > 0 || v.mancano.length > 0)
}

// Il numero che si legge nella riga: "90", "20/80", "6 · −1", "0/3".
export function testoVoceSeduta(v: VoceSeduta): string {
  if (v.mancano.length === 0) return String(v.totale)
  if (!infoVoce(v.voce).perMuscolo || v.totale === 0) return `${v.totale}/${v.mancano[0].minimo}`
  return `${v.totale} · −${v.mancano.reduce((t, m) => t + (m.minimo - m.fatto), 0)}`
}

// "80–120", "almeno 3", "al massimo 40", "60"
export function intervalloTesto(da: number | null, a: number | null): string {
  if (da != null && a != null) return da === a ? `${da}` : `${da}–${a}`
  if (da != null) return `almeno ${da}`
  if (a != null) return `al massimo ${a}`
  return ''
}

// Il colore di un numero rispetto al minimo: verde raggiunto, arancione almeno
// a meta', rosso sotto la meta'. null = senza minimo, non si colora.
export type LivelloDose = 'raggiunta' | 'vicina' | 'lontana'

export function livelloDose(fatto: number, minimo: number | null | undefined): LivelloDose | null {
  if (minimo == null || minimo <= 0) return null
  if (fatto >= minimo) return 'raggiunta'
  return fatto * 2 >= minimo ? 'vicina' : 'lontana'
}

// Il colore di una voce nella riga: decide cio' che manca di piu'. Verde anche
// se non manca niente perche' la settimana e' gia' a posto.
export function livelloVoce(v: VoceSeduta): LivelloDose | null {
  if (v.mancano.length === 0) return v.minimo == null ? null : 'raggiunta'
  return v.mancano.some((m) => livelloDose(m.fatto, m.minimo) === 'lontana') ? 'lontana' : 'vicina'
}

// ---- Com'e' divisa una seduta ----

// Le serie di una riga: uno se non e' scritto (un cluster e' una serie sola).
export const serieDellaRiga = (r: Pick<RigaConto, 'serie'>): number => primoNumero(r.serie) ?? 1

// La quota di ogni voce sulle serie, in percentuale intera (somma 100), nell'
// ordine di sempre; cio' che non conta resta fuori.
export function quoteLavoro(
  righe: Pick<RigaConto, 'tipo' | 'conta' | 'obiettivo' | 'serie'>[]
): { voce: Voce; nome: string; serie: number; percento: number }[] {
  const serie = new Map<Voce, number>()
  for (const r of righe) {
    const voce = voceRiga(r)
    if (voce == null || voce === 'senza') continue
    serie.set(voce, (serie.get(voce) ?? 0) + serieDellaRiga(r))
  }
  const totale = [...serie.values()].reduce((t, n) => t + n, 0)
  if (totale <= 0) return []
  const quote = VOCI.filter((v) => (serie.get(v.voce) ?? 0) > 0).map((v) => ({
    voce: v.voce,
    nome: v.breve,
    serie: serie.get(v.voce)!,
    percento: Math.round((serie.get(v.voce)! / totale) * 100)
  }))
  // l'arrotondamento puo' dare 99 o 101: si aggiusta sulla voce piu' grande
  const grande = quote.reduce((m, q) => (q.serie > m.serie ? q : m), quote[0])
  grande.percento += 100 - quote.reduce((t, q) => t + q.percento, 0)
  return quote
}

// Il lunedi' e la domenica della settimana di una data (AAAA-MM-GG).
export function settimanaDi(data: string): [string, string] {
  const [y, m, g] = data.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, g))
  const lun = new Date(d)
  lun.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  const dom = new Date(lun)
  dom.setUTCDate(lun.getUTCDate() + 6)
  const iso = (x: Date): string => x.toISOString().slice(0, 10)
  return [iso(lun), iso(dom)]
}
