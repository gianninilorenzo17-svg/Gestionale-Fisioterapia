// Il carico settimana per settimana, per la linguetta Percorso del paziente:
// quanto si e' fatto, voce per voce, senza confronti con la dose. Come la dose
// serve SOLO a programmare e non finisce in nessun documento. Il conto delle
// righe e' lo stesso della seduta (contaRighe in shared/dose.ts); qui si sommano
// le sedute di ogni settimana. Le prove stanno in test/carico-settimane.test.ts.
//
// La fase della settimana e' quella dell'ultima seduta che ne ha una. Le sedute
// al campo non contano nel carico, ma dolore e sforzo si' (sono del paziente).
import { contaRighe, muscoliVoce, settimanaDi, totaleVoce, VOCI, type RigaConto, type Voce } from './dose'

export interface SedutaCarico {
  data: string
  fase_nome: string | null
  campo: 0 | 1
  dolore: number | null
  sforzo: number | null
  righe: RigaConto[]
}

export interface SettimanaCarico {
  lunedi: string
  domenica: string
  // la settimana di oggi non e' finita
  inCorso: boolean
  sedute: number
  seduteCampo: number
  fase: string | null
  // quanto in tutto per voce, e per forza e ipertrofia muscolo per muscolo
  voci: Partial<Record<Voce, number>>
  muscoli: Partial<Record<Voce, { categoria: number; fatto: number }[]>>
  dolore: number | null
  sforzo: number | null
}

export interface AvvisoCarico {
  chiave: Voce
  // dalla piu' vecchia alla piu' recente, tre settimane
  valori: [number, number, number]
  dolori: [number, number, number]
}

export interface CaricoPaziente {
  // dalla piu' recente alla piu' vecchia, comprese quelle vuote in mezzo
  settimane: SettimanaCarico[]
  // le voci con qualcosa di contato in almeno una settimana
  chiavi: Voce[]
  // il nome di ogni muscolo (la categoria)
  nomi: Record<number, string>
  avviso: AvvisoCarico | null
}

const unDecimale = (n: number): number => Math.round(n * 10) / 10

const media = (valori: (number | null)[]): number | null => {
  const v = valori.filter((x): x is number => x != null)
  return v.length === 0 ? null : unDecimale(v.reduce((s, x) => s + x, 0) / v.length)
}

function piuGiorni(iso: string, giorni: number): string {
  const [y, m, g] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, g + giorni))
  return d.toISOString().slice(0, 10)
}

export function caricoSettimane(input: { sedute: SedutaCarico[]; oggi: string }): Omit<CaricoPaziente, 'nomi'> {
  const { oggi } = input
  const sedute = input.sedute.filter((s) => s.data <= oggi).sort((a, b) => a.data.localeCompare(b.data))
  if (sedute.length === 0) return { settimane: [], chiavi: [], avviso: null }

  const perSettimana = new Map<string, SedutaCarico[]>()
  for (const s of sedute) {
    const [lun] = settimanaDi(s.data)
    perSettimana.set(lun, [...(perSettimana.get(lun) ?? []), s])
  }

  const chiavi = new Set<Voce>()
  const settimane: SettimanaCarico[] = []
  const [primo] = settimanaDi(sedute[0].data)
  const [ultimo] = settimanaDi(sedute[sedute.length - 1].data)
  for (let lun = primo; lun <= ultimo; lun = piuGiorni(lun, 7)) {
    const tutte = perSettimana.get(lun) ?? []
    const contate = tutte.filter((s) => s.campo === 0)
    const conto = contaRighe(contate.flatMap((s) => s.righe))
    const voci: SettimanaCarico['voci'] = {}
    const muscoli: SettimanaCarico['muscoli'] = {}
    for (const { voce, perMuscolo } of VOCI) {
      const totale = totaleVoce(conto, voce)
      if (totale <= 0) continue
      chiavi.add(voce)
      voci[voce] = totale
      if (perMuscolo) muscoli[voce] = muscoliVoce(conto, voce)
    }

    const conFase = [...contate].reverse().find((s) => s.fase_nome != null)
    const domenica = piuGiorni(lun, 6)
    settimane.push({
      lunedi: lun,
      domenica,
      inCorso: domenica >= oggi,
      sedute: contate.length,
      seduteCampo: tutte.length - contate.length,
      fase: conFase?.fase_nome ?? null,
      voci,
      muscoli,
      dolore: media(tutte.map((s) => s.dolore)),
      sforzo: media(tutte.map((s) => s.sforzo))
    })
  }
  settimane.reverse()

  const elenco = VOCI.map((v) => v.voce).filter((v) => chiavi.has(v))
  return { settimane, chiavi: elenco, avviso: avvisoCarico(settimane, elenco) }
}

// Un avviso solo, e solo se succede: nelle ultime tre settimane (di fila, tutte
// con sedute) il dolore medio e' salito ogni settimana, di almeno un punto in
// tutto, mentre una voce del carico cresceva. Se le voci che crescono sono
// piu' d'una si dice quella cresciuta di piu', in proporzione.
export function avvisoCarico(settimane: SettimanaCarico[], chiavi: Voce[]): AvvisoCarico | null {
  if (settimane.length < 3) return null
  const [w2, w1, w0] = settimane // w2 la piu' recente
  if ([w0, w1, w2].some((w) => w.sedute + w.seduteCampo === 0 || w.dolore == null)) return null
  const d = [w0.dolore!, w1.dolore!, w2.dolore!] as [number, number, number]
  if (!(d[0] < d[1] && d[1] < d[2] && d[2] - d[0] >= 1)) return null

  let scelta: AvvisoCarico | null = null
  let crescita = 0
  for (const k of chiavi) {
    const v = [w0, w1, w2].map((w) => w.voci[k] ?? 0) as [number, number, number]
    if (!(v[2] > v[0] && v[1] >= v[0])) continue
    const quanto = v[0] === 0 ? Infinity : (v[2] - v[0]) / v[0]
    if (scelta == null || quanto > crescita) {
      scelta = { chiave: k, valori: v, dolori: d }
      crescita = quanto
    }
  }
  return scelta
}
