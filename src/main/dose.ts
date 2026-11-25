// La dose: i modelli (per seduta + volte a settimana), quale modello usa ogni
// fase, e il conto delle sedute (le altre della settimana, il carico settimana
// per settimana). Senza niente di Electron (modello: sedute.ts); il calcolo sta
// in shared/dose.ts.
import { getDb } from './db'
import { eliminaConCestino, nomeDi } from './cestino'
import { prossimoOrdine } from './elenchi'
import {
  contaRighe,
  settimanaDi,
  voceValida,
  type DoseModello,
  type DoseModelloInput,
  type DoseSettimana,
  type RigaConto,
  type VoceModello
} from '../shared/dose'
import { caricoSettimane, type CaricoPaziente, type SedutaCarico } from '../shared/carico-settimane'
import type { FaseConModello } from '../shared/types'

// L'obiettivo della sezione di una seduta (`ss`): quello salvato con la seduta
// e, se non ne ha, quello che ha adesso la sezione della fase da cui viene.
export const OBIETTIVO_SEZIONE = `COALESCE(ss.obiettivo, (
  SELECT CASE WHEN z.libreria_id IS NULL THEN z.obiettivo ELSE l.obiettivo END
  FROM sezioni z LEFT JOIN sezioni_libreria l ON l.id = z.libreria_id
  WHERE z.id = ss.sezione_id
))`

// Le righe di seduta pronte per il conto. `dove` filtra le sedute (alias s).
export function righeConto(dove: string, parametri: unknown[]): (RigaConto & { seduta_id: number })[] {
  return getDb()
    .prepare(
      `SELECT se.seduta_id, e.categoria_id, e.gambe, se.monopodalico, se.serie, se.cluster, se.ripetizioni,
              se.carico, e.unita_carico, COALESCE(se.tipo, e.tipo) AS tipo, se.conta,
              ${OBIETTIVO_SEZIONE} AS obiettivo
       FROM seduta_esercizi se
       JOIN sedute s ON s.id = se.seduta_id
       LEFT JOIN esercizi e ON e.id = se.esercizio_id
       LEFT JOIN seduta_sezioni ss ON ss.id = se.seduta_sezione_id
       WHERE ${dove}`
    )
    .all(...parametri) as (RigaConto & { seduta_id: number })[]
}

export function perSeduta(righe: (RigaConto & { seduta_id: number })[]): Map<number, RigaConto[]> {
  const mappa = new Map<number, RigaConto[]>()
  for (const { seduta_id, ...r } of righe) mappa.set(seduta_id, [...(mappa.get(seduta_id) ?? []), r])
  return mappa
}

// ---- I modelli ----

export function elencoModelli(): DoseModello[] {
  const db = getDb()
  const voci = db.prepare(
    'SELECT voce, minimo, massimo, volte_min, volte_max, indicazione FROM dose_modello_voci WHERE modello_id = ?'
  )
  return (
    db.prepare('SELECT id, nome, alternativa, ordine FROM dose_modelli ORDER BY ordine, id').all() as Omit<
      DoseModello,
      'voci'
    >[]
  ).map((m) => ({ ...m, voci: voci.all(m.id) as VoceModello[] }))
}

const nomeValido = (nome: string): string => {
  const pulito = nome.trim()
  if (pulito === '') throw new Error('Scrivi il nome del modello.')
  return pulito
}

export function creaModello(nome: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO dose_modelli (nome, ordine) VALUES (?, ?)')
      .run(nomeValido(nome), prossimoOrdine('dose_modelli')).lastInsertRowid
  )
}

const numero = (v: number | null, cosa: string): number | null => {
  if (v == null) return null
  if (!Number.isInteger(v) || v < 0 || v > 10000) {
    throw new Error(`${cosa}: scrivi un numero intero, senza virgola.`)
  }
  return v
}

const ordinati = (da: number | null, a: number | null, cosa: string): void => {
  if (da != null && a != null && da > a) {
    throw new Error(`${cosa}: il primo numero è più alto del secondo. Scrivili dal più basso al più alto.`)
  }
}

// Il modello intero, al posto di quello di prima. Una voce senza niente di
// scritto non si salva.
export function salvaModello(id: number, input: DoseModelloInput): void {
  const db = getDb()
  const nome = nomeValido(input.nome)
  const voci = input.voci.map((v) => {
    if (!voceValida(v.voce)) throw new Error('Una voce della dose non è valida: riprova.')
    const pulita: VoceModello = {
      voce: v.voce,
      minimo: numero(v.minimo, 'Il numero più basso'),
      massimo: numero(v.massimo, 'Il numero più alto'),
      volte_min: numero(v.volte_min, 'Le volte a settimana'),
      volte_max: numero(v.volte_max, 'Le volte a settimana'),
      indicazione: v.indicazione?.trim() || null
    }
    ordinati(pulita.minimo, pulita.massimo, 'Per seduta')
    ordinati(pulita.volte_min, pulita.volte_max, 'A settimana')
    return pulita
  })
  db.transaction(() => {
    const cambiato = db
      .prepare('UPDATE dose_modelli SET nome = ?, alternativa = ? WHERE id = ?')
      .run(nome, input.alternativa === 1 ? 1 : 0, id).changes
    if (cambiato === 0) throw new Error('Modello non trovato: forse è stato eliminato.')
    db.prepare('DELETE FROM dose_modello_voci WHERE modello_id = ?').run(id)
    const ins = db.prepare(
      `INSERT INTO dose_modello_voci (modello_id, voce, minimo, massimo, volte_min, volte_max, indicazione)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    for (const v of voci) {
      if ([v.minimo, v.massimo, v.volte_min, v.volte_max, v.indicazione].every((x) => x == null)) continue
      ins.run(id, v.voce, v.minimo, v.massimo, v.volte_min, v.volte_max, v.indicazione)
    }
  })()
}

export function eliminaModello(id: number): void {
  eliminaConCestino('dose_modelli', id, 'Modello di dose', nomeDi('dose_modelli', id))
}

// ---- Il modello delle fasi ----

export function impostaModelloFase(faseId: number, modelloId: number | null): void {
  getDb().prepare('UPDATE fasi SET dose_modello_id = ? WHERE id = ?').run(modelloId, faseId)
}

// null = la fase non ha un modello: si conta e basta.
export function modelloDiFase(faseId: number): DoseModello | null {
  const riga = getDb().prepare('SELECT dose_modello_id FROM fasi WHERE id = ?').get(faseId) as
    | { dose_modello_id: number | null }
    | undefined
  if (riga?.dose_modello_id == null) return null
  return elencoModelli().find((m) => m.id === riga.dose_modello_id) ?? null
}

// Tutte le fasi, patologia per patologia: per dare il modello in un colpo solo.
export function fasiConModello(): FaseConModello[] {
  return getDb()
    .prepare(
      `SELECT f.id, f.nome, f.campo, f.dose_modello_id, p.id AS patologia_id, p.nome AS patologia_nome
       FROM fasi f JOIN patologie p ON p.id = f.patologia_id
       ORDER BY p.ordine, p.nome, p.id, f.campo, f.ordine, f.id`
    )
    .all() as FaseConModello[]
}

// ---- Il conto ----

// Le altre sedute della settimana (da lunedi' a domenica) di quel paziente,
// una per una: fatte o programmate, tranne quella che si sta componendo e
// quelle al campo.
export function doseSettimana(pazienteId: number, data: string, sedutaId: number | null): DoseSettimana {
  const [lun, dom] = settimanaDi(data)
  const filtro = `s.paziente_id = ? AND s.data BETWEEN ? AND ?
    AND (? IS NULL OR s.id <> ?)
    AND COALESCE((SELECT f.campo FROM fasi f WHERE f.id = s.fase_id), 0) = 0`
  const args = [pazienteId, lun, dom, sedutaId, sedutaId]
  const sedute = getDb()
    .prepare(`SELECT s.id FROM sedute s WHERE ${filtro} ORDER BY s.data, s.id`)
    .all(...args) as { id: number }[]
  const righe = perSeduta(righeConto(filtro, args))
  return { altre: sedute.map((s) => contaRighe(righe.get(s.id) ?? [])) }
}

// Il carico settimana per settimana del paziente, per la linguetta Percorso:
// tutte le sedute fino a oggi. Il calcolo sta in shared/carico-settimane.ts.
export function caricoPaziente(pazienteId: number): CaricoPaziente {
  const db = getDb()
  const { oggi } = db.prepare(`SELECT date('now', 'localtime') AS oggi`).get() as { oggi: string }
  const sedute = db
    .prepare(
      `SELECT s.id, s.data, f.nome AS fase_nome, COALESCE(f.campo, 0) AS campo, s.dolore, s.sforzo
       FROM sedute s LEFT JOIN fasi f ON f.id = s.fase_id
       WHERE s.paziente_id = ? AND s.data <= ?
       ORDER BY s.data, s.id`
    )
    .all(pazienteId, oggi) as (Omit<SedutaCarico, 'righe'> & { id: number })[]
  const righe = perSeduta(righeConto('s.paziente_id = ? AND s.data <= ?', [pazienteId, oggi]))
  const calcolo = caricoSettimane({
    sedute: sedute.map(({ id, ...s }) => ({ ...s, righe: righe.get(id) ?? [] })),
    oggi
  })

  const nomi: Record<number, string> = {}
  const nome = db.prepare('SELECT nome FROM categorie WHERE id = ?')
  for (const s of calcolo.settimane) {
    for (const muscoli of Object.values(s.muscoli)) {
      for (const { categoria } of muscoli) {
        nomi[categoria] = (nome.get(categoria) as { nome: string } | undefined)?.nome ?? 'altro'
      }
    }
  }
  return { ...calcolo, nomi }
}
