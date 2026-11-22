// I conti del Quadro del paziente: la prima linguetta che si vede aprendo una
// scheda. Qui non c'e' niente di nuovo da scrivere a mano: sono letture
// incrociate di cose che l'app ha gia' (sedute, fasi, pedana, questionari).
// Funzioni pure, senza React e senza database, cosi' si provano da sole.
import type { GruppoPedana } from './pedana'
import type { CompilazioneRiepilogo, Promemoria, PuntoAndamentoDolore } from './types'

// ---- LSI ----------------------------------------------------------------

// Le soglie con cui si colora l'LSI nel Quadro (la convenzione di chi fa
// rientro allo sport): da 90 in su e' a posto, fra 80 e 89 si guarda, sotto
// 80 e' il test che frena. Servono solo al colore: l'LSI resta un numero e la
// decisione e' sempre del fisioterapista.
export const LSI_OTTIMO = 90
export const LSI_ATTENZIONE = 80

export type ClasseLsi = 'ok' | 'att' | 'no'

export const classeLsi = (valore: number): ClasseLsi =>
  valore >= LSI_OTTIMO ? 'ok' : valore >= LSI_ATTENZIONE ? 'att' : 'no'

export interface LsiBasso {
  valore: number
  // il test che lo ha dato e il giorno in cui e' stato fatto
  test: string
  data: string
  // quanti altri test hanno un LSI, e fra che valori stanno
  altri: number
  minimoAltri: number | null
  massimoAltri: number | null
}

// L'LSI piu' basso fra i test con confronto fra i due lati, guardando per
// ognuno il valore piu' recente: dice qual e' il test che oggi frena.
export function lsiPiuBasso(gruppi: GruppoPedana[]): LsiBasso | null {
  const ultimi: { valore: number; test: string; data: string }[] = []
  for (const g of gruppi) {
    if (!g.perLato) continue
    const riga = g.giorni.find((r) => r.lsi !== null)
    if (!riga || riga.lsi === null) continue
    ultimi.push({ valore: Math.round(riga.lsi), test: g.nome, data: riga.dataFine ?? riga.data })
  }
  if (ultimi.length === 0) return null
  ultimi.sort((a, b) => a.valore - b.valore)
  const [basso, ...altri] = ultimi
  return {
    ...basso,
    altri: altri.length,
    minimoAltri: altri.length > 0 ? altri[0].valore : null,
    massimoAltri: altri.length > 0 ? altri[altri.length - 1].valore : null
  }
}

// ---- Tempi --------------------------------------------------------------

const GIORNO = 86_400_000

const giorniFra = (da: string, a: string): number =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / GIORNO)

// Il lunedi' della settimana di una data ('aaaa-mm-gg'): la settimana in
// riabilitazione va da lunedi' a domenica.
export function lunediDi(data: string): string {
  const d = new Date(`${data}T00:00:00Z`)
  const indietro = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - indietro)
  return d.toISOString().slice(0, 10)
}

export interface SedutaPerQuadro {
  data: string
  fase_nome: string | null
}

// Da quando il paziente e' nella fase di adesso: il primo giorno dell'ultimo
// tratto di sedute fatte in quella fase. Se non c'e' ancora nessuna seduta
// fatta nella fase, non si sa (null) e il Quadro non scrive niente.
export function inFaseDal(
  sedute: SedutaPerQuadro[],
  faseNome: string | null,
  oggi: string
): string | null {
  if (!faseNome) return null
  const fatte = sedute.filter((s) => s.data <= oggi).sort((a, b) => b.data.localeCompare(a.data))
  let dal: string | null = null
  for (const s of fatte) {
    if (s.fase_nome !== faseNome) break
    dal = s.data
  }
  return dal
}

export interface Settimana {
  fatte: number
  // quante ne fa a settimana (null se non e' scritto)
  previste: number | null
}

// Le sedute di questa settimana, da lunedi' a oggi, contro quelle previste.
export function settimanaCorrente(
  sedute: SedutaPerQuadro[],
  oggi: string,
  previste: number | null
): Settimana {
  const lunedi = lunediDi(oggi)
  const fatte = sedute.filter((s) => s.data >= lunedi && s.data <= oggi).length
  return { fatte, previste }
}

// ---- Dolore -------------------------------------------------------------

export interface SintesiDolore {
  ultimo: number
  // il primo valore segnato (dall'anamnesi o dalla prima seduta)
  primo: number
  // l'ultimo - il primo: negativo = e' calato
  differenza: number
  // i valori nel tempo, dal piu' vecchio, per la lineetta
  serie: { data: string; dolore: number }[]
}

export function sintesiDolore(punti: PuntoAndamentoDolore[]): SintesiDolore | null {
  if (punti.length === 0) return null
  const serie = [...punti]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((p) => ({ data: p.data, dolore: p.dolore }))
  const primo = serie[0].dolore
  const ultimo = serie[serie.length - 1].dolore
  return { ultimo, primo, differenza: ultimo - primo, serie }
}

// ---- Questionari e promemoria ------------------------------------------

export interface UltimoQuestionario {
  nome: string
  data: string
  // il punteggio che si legge: quello su cui l'app misura il cambiamento se c'e', altrimenti il primo
  punteggioNome: string
  valore: number
  // quanto e' cambiato dalla prima compilazione di questo questionario: il
  // numero e' la differenza vera (con il suo segno); se meglio vuol dire di piu'
  // o di meno lo sa solo il questionario, e senza saperlo `migliora` e' null
  cambio: { differenza: number; dal: string; migliora: boolean | null } | null
}

// L'ultimo questionario compilato (le compilazioni arrivano dalla piu' recente).
export function ultimoQuestionario(compilazioni: CompilazioneRiepilogo[]): UltimoQuestionario | null {
  const ordinate = [...compilazioni].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
  const c = ordinate[0]
  if (!c || c.punteggi.length === 0) return null
  const scelto =
    (c.variazione && c.punteggi.find((p) => p.nome === c.variazione!.punteggio_nome)) ||
    c.punteggi[0]
  // la prima volta che ha compilato questo stesso questionario (con lo stesso punteggio)
  const prima = [...ordinate]
    .reverse()
    .find((x) => x.id !== c.id && x.questionario_id === c.questionario_id && x.punteggi.some((p) => p.nome === scelto.nome))
  const valorePrima = prima?.punteggi.find((p) => p.nome === scelto.nome)?.valore
  return {
    nome: c.questionario_nome,
    data: c.data,
    punteggioNome: scelto.nome,
    valore: scelto.valore,
    cambio:
      prima && valorePrima !== undefined
        ? {
            differenza: Math.round((scelto.valore - valorePrima) * 10) / 10,
            dal: prima.data,
            // `punti` della variazione e' gia' girato: positivo = meglio, comunque vada il punteggio
            migliora: c.variazione ? c.variazione.punti > 0 : null
          }
        : null
  }
}

export interface PromemoriaInVista {
  // quanti ce ne sono ancora da fare, e quanti sono gia' scaduti
  aperti: number
  scaduti: number
  // il piu' urgente: il piu' vecchio fra gli scaduti, altrimenti il prossimo
  primo: Promemoria | null
  giorniScaduto: number | null
}

export function promemoriaInVista(elenco: Promemoria[], oggi: string): PromemoriaInVista {
  const aperti = elenco
    .filter((m) => !m.fatto_il)
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza))
  const scaduti = aperti.filter((m) => m.scadenza < oggi)
  const primo = aperti[0] ?? null
  return {
    aperti: aperti.length,
    scaduti: scaduti.length,
    primo,
    giorniScaduto: primo && primo.scadenza < oggi ? giorniFra(primo.scadenza, oggi) : null
  }
}
