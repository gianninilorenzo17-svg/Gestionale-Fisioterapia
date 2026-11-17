// I farmaci: le schede di riferimento (per principio attivo), l'indice dei nomi
// che serve a riconoscerli nel testo, e la lista di ogni paziente.
// Senza niente di Electron (modello: sedute.ts): la scelta del file AIFA sta in
// ipc.ts, le prove in test/farmaci.test.ts.
//
// Il database dei farmaci e' solo di consultazione e non e' mescolato ai dati dei
// pazienti: il paziente ha solo un testo («Brufen») e una nota facoltativa; la
// scheda si ritrova dal testo, ogni volta, e quindi un collegamento fatto dopo
// vale anche per quelli scritti prima.
import { getDb } from './db'
import {
  chiavePrincipio,
  dividiPrincipio,
  leggiListaAifa,
  nomiDaElenco,
  normalizza,
  preparaRicerca,
  trovaFarmaci,
  type EsitoImportFarmaci,
  type FarmacoEtichetta,
  type FarmacoScheda,
  type FarmacoSchedaInput,
  type IndiceFarmaci,
  type NomeCollegato,
  type PazienteFarmaco,
  type RefFarmaco,
  type StatoFarmaci
} from '../shared/farmaci'
import {
  ETICHETTE_INIZIALI,
  FONTE_BOZZA,
  NOMI_INIZIALI,
  NOMI_VERSIONE,
  PAROLE_ESCLUSE_INIZIALI,
  SCHEDE_INIZIALI,
  SCHEDE_V2,
  SCHEDE_V3,
  SCHEDE_V4,
  SCHEDE_VERSIONE,
  type SchedaIniziale
} from './farmaci-iniziali'

type Db = ReturnType<typeof getDb>

const oggi = (): string => new Date().toISOString().slice(0, 10)

// ---- partenza ----------------------------------------------------------------

// La prima volta che si guarda il database dei farmaci, ci si trova le
// etichette, le schede iniziali (in bozza) e i nomi commerciali comuni. Una
// volta sola: chi le elimina non se le ritrova.
export function assicuraIniziali(): void {
  const db = getDb()
  if (meta(db, 'iniziali')) {
    completaNomiIniziali()
    return
  }
  db.transaction(() => {
    const nuova = db.prepare('INSERT OR IGNORE INTO farmaco_etichette (nome, ordine) VALUES (?, ?)')
    ETICHETTE_INIZIALI.forEach((n, i) => nuova.run(n, i))
    const idEtichetta = new Map(
      (db.prepare('SELECT id, nome FROM farmaco_etichette').all() as { id: number; nome: string }[]).map(
        (e) => [e.nome, e.id]
      )
    )
    aggiungiSchede(db, SCHEDE_INIZIALI.concat(SCHEDE_V2, SCHEDE_V3, SCHEDE_V4))
    const insNome = db.prepare(
      `INSERT OR IGNORE INTO farmaco_nomi (nome_norm, nome, principio, origine)
       VALUES (?, ?, ?, 'iniziale')`
    )
    for (const [nome, principio] of NOMI_INIZIALI) insNome.run(normalizza(nome), nome, principio)
    const insEsclusa = db.prepare('INSERT OR IGNORE INTO farmaco_escluse (parola) VALUES (?)')
    for (const p of PAROLE_ESCLUSE_INIZIALI) insEsclusa.run(p)
    impostaMeta(db, 'iniziali', oggi())
    impostaMeta(db, 'nomi_versione', String(NOMI_VERSIONE))
    impostaMeta(db, 'schede_versione', String(SCHEDE_VERSIONE))
  })()
}

// Inserisce le schede che non ci sono ancora (si confronta il principio attivo), tutte
// in bozza. Quelle gia' presenti, modificate o validate non si toccano.
function aggiungiSchede(db: Db, schede: SchedaIniziale[]): void {
  const idEtichetta = new Map(
    (db.prepare('SELECT id, nome FROM farmaco_etichette').all() as { id: number; nome: string }[]).map(
      (e) => [e.nome, e.id]
    )
  )
  const esistenti = new Set(
    (db.prepare('SELECT principio_attivo FROM farmaco_schede').all() as { principio_attivo: string }[]).map(
      (s) => chiavePrincipio(s.principio_attivo)
    )
  )
  const insScheda = db.prepare(
    `INSERT INTO farmaco_schede
       (principio_attivo, classe, usi, info_fisio, avvertenze, livello, fonte, data_revisione, stato)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bozza')`
  )
  const insLegame = db.prepare(
    'INSERT OR IGNORE INTO farmaco_scheda_etichette (scheda_id, etichetta_id) VALUES (?, ?)'
  )
  for (const s of schede) {
    if (esistenti.has(chiavePrincipio(s.principio_attivo))) continue
    const id = Number(
      insScheda.run(
        s.principio_attivo,
        vuotoNull(s.classe),
        vuotoNull(s.usi),
        vuotoNull(s.info_fisio),
        vuotoNull(s.avvertenze),
        s.livello,
        FONTE_BOZZA,
        oggi()
      ).lastInsertRowid
    )
    for (const e of s.etichette) {
      const eid = idEtichetta.get(e)
      if (eid != null) insLegame.run(id, eid)
    }
  }
}

// Chi ha gia' il database riceve i nomi commerciali e le schede aggiunti dopo (una
// volta per versione dell'elenco). Non si toglie e non si cambia niente: si aggiunge solo
// quello che manca; le schede eliminate nelle versioni precedenti non tornano.
function completaNomiIniziali(): void {
  const db = getDb()
  if (!meta(db, 'iniziali')) return
  const nomiOk = Number(meta(db, 'nomi_versione') ?? 1) >= NOMI_VERSIONE
  const schedeVersione = Number(meta(db, 'schede_versione') ?? 1)
  const schedeOk = schedeVersione >= SCHEDE_VERSIONE
  if (nomiOk && schedeOk) return
  db.transaction(() => {
    if (!nomiOk) {
      const insNome = db.prepare(
        `INSERT OR IGNORE INTO farmaco_nomi (nome_norm, nome, principio, origine)
         VALUES (?, ?, ?, 'iniziale')`
      )
      for (const [nome, principio] of NOMI_INIZIALI) insNome.run(normalizza(nome), nome, principio)
      impostaMeta(db, 'nomi_versione', String(NOMI_VERSIONE))
    }
    if (!schedeOk) {
      if (schedeVersione < 2) aggiungiSchede(db, SCHEDE_V2)
      if (schedeVersione < 3) aggiungiSchede(db, SCHEDE_V3)
      if (schedeVersione < 4) aggiungiSchede(db, SCHEDE_V4)
      impostaMeta(db, 'schede_versione', String(SCHEDE_VERSIONE))
    }
  })()
}

function meta(db: Db, chiave: string): string | null {
  const r = db.prepare('SELECT valore FROM farmaco_meta WHERE chiave = ?').get(chiave) as
    | { valore: string | null }
    | undefined
  return r?.valore ?? null
}

function impostaMeta(db: Db, chiave: string, valore: string): void {
  db.prepare(
    'INSERT INTO farmaco_meta (chiave, valore) VALUES (?, ?) ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore'
  ).run(chiave, valore)
}

const vuotoNull = (t: string | null | undefined): string | null => {
  const p = (t ?? '').trim()
  return p === '' ? null : p
}

// ---- schede ------------------------------------------------------------------

function leggiSchede(db: Db): FarmacoScheda[] {
  const righe = db
    .prepare(
      `SELECT id, principio_attivo, classe, usi, info_fisio, avvertenze, livello, fonte,
              data_revisione, stato
       FROM farmaco_schede ORDER BY principio_attivo COLLATE NOCASE`
    )
    .all() as Omit<FarmacoScheda, 'etichette'>[]
  const legami = db
    .prepare('SELECT scheda_id, etichetta_id FROM farmaco_scheda_etichette ORDER BY etichetta_id')
    .all() as { scheda_id: number; etichetta_id: number }[]
  const perScheda = new Map<number, number[]>()
  for (const l of legami) perScheda.set(l.scheda_id, [...(perScheda.get(l.scheda_id) ?? []), l.etichetta_id])
  return righe.map((r) => ({ ...r, etichette: perScheda.get(r.id) ?? [] }))
}

function leggiEtichette(db: Db): FarmacoEtichetta[] {
  return db
    .prepare('SELECT id, nome, ordine FROM farmaco_etichette ORDER BY ordine, nome COLLATE NOCASE')
    .all() as FarmacoEtichetta[]
}

export function salvaSchedaFarmaco(input: FarmacoSchedaInput): number {
  assicuraIniziali()
  const db = getDb()
  const principio = input.principio_attivo.trim().replace(/\s+/g, ' ')
  if (!principio) throw new Error('Scrivi il principio attivo.')
  if (![0, 1, 2].includes(input.livello)) throw new Error('Il livello di attenzione non è valido.')
  if (input.stato !== 'bozza' && input.stato !== 'validata') throw new Error('Lo stato non è valido.')
  const chiave = chiavePrincipio(principio)
  const doppia = (
    db.prepare('SELECT id, principio_attivo FROM farmaco_schede').all() as {
      id: number
      principio_attivo: string
    }[]
  ).find((s) => s.id !== input.id && chiavePrincipio(s.principio_attivo) === chiave)
  if (doppia) throw new Error(`C’è già una scheda per «${doppia.principio_attivo}».`)
  const valori = [
    principio,
    vuotoNull(input.classe),
    vuotoNull(input.usi),
    vuotoNull(input.info_fisio),
    vuotoNull(input.avvertenze),
    input.livello,
    vuotoNull(input.fonte),
    vuotoNull(input.data_revisione),
    input.stato
  ]
  return db.transaction(() => {
    let id: number
    if (input.id != null) {
      const r = db
        .prepare(
          `UPDATE farmaco_schede SET principio_attivo = ?, classe = ?, usi = ?, info_fisio = ?,
             avvertenze = ?, livello = ?, fonte = ?, data_revisione = ?, stato = ? WHERE id = ?`
        )
        .run(...valori, input.id)
      if (r.changes === 0) throw new Error('Questa scheda non c’è più.')
      id = input.id
    } else {
      id = Number(
        db
          .prepare(
            `INSERT INTO farmaco_schede
               (principio_attivo, classe, usi, info_fisio, avvertenze, livello, fonte, data_revisione, stato)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(...valori).lastInsertRowid
      )
    }
    db.prepare('DELETE FROM farmaco_scheda_etichette WHERE scheda_id = ?').run(id)
    const ins = db.prepare(
      `INSERT OR IGNORE INTO farmaco_scheda_etichette (scheda_id, etichetta_id)
       SELECT ?, id FROM farmaco_etichette WHERE id = ?`
    )
    for (const e of input.etichette) ins.run(id, e)
    return id
  })()
}

export function eliminaSchedaFarmaco(id: number): void {
  getDb().prepare('DELETE FROM farmaco_schede WHERE id = ?').run(id)
}

// ---- etichette ---------------------------------------------------------------

export function salvaEtichettaFarmaco(id: number | null, nome: string): number {
  assicuraIniziali()
  const db = getDb()
  const pulito = nome.trim().replace(/\s+/g, ' ')
  if (!pulito) throw new Error('Scrivi il nome dell’etichetta.')
  const doppia = db
    .prepare('SELECT id FROM farmaco_etichette WHERE nome = ? COLLATE NOCASE AND id IS NOT ?')
    .get(pulito, id)
  if (doppia) throw new Error('C’è già un’etichetta con questo nome.')
  if (id == null) {
    const ordine = (
      db.prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS o FROM farmaco_etichette').get() as { o: number }
    ).o
    return Number(db.prepare('INSERT INTO farmaco_etichette (nome, ordine) VALUES (?, ?)').run(pulito, ordine).lastInsertRowid)
  }
  db.prepare('UPDATE farmaco_etichette SET nome = ? WHERE id = ?').run(pulito, id)
  return id
}

export function eliminaEtichettaFarmaco(id: number): void {
  getDb().prepare('DELETE FROM farmaco_etichette WHERE id = ?').run(id)
}

// ---- indice dei nomi -----------------------------------------------------------

export function indiceFarmaci(): IndiceFarmaci {
  assicuraIniziali()
  const db = getDb()
  const schede = leggiSchede(db)
  const perChiave = new Map<string, number>()
  for (const s of schede) perChiave.set(chiavePrincipio(s.principio_attivo), s.id)
  const nomi: Record<string, RefFarmaco[]> = Object.create(null)
  const aggiungi = (nome: string, ref: RefFarmaco): void => {
    const lista = (nomi[nome] ??= [])
    if (!lista.some((r) => r.schedaId === ref.schedaId && (ref.schedaId != null || r.principio === ref.principio))) {
      lista.push(ref)
    }
  }
  const dalPrincipio = (principio: string): RefFarmaco[] =>
    dividiPrincipio(principio).map((p) => ({ schedaId: perChiave.get(p.chiave) ?? null, principio: p.etichetta }))

  const righe = db
    .prepare('SELECT nome_norm, principio, scheda_id FROM farmaco_nomi')
    .all() as { nome_norm: string; principio: string | null; scheda_id: number | null }[]
  const schedaPerId = new Map(schede.map((s) => [s.id, s]))
  const aMano = new Map<string, RefFarmaco[]>()
  const visti = new Set<string>()
  for (const r of righe) {
    if (r.scheda_id != null) {
      const s = schedaPerId.get(r.scheda_id)
      if (s) aMano.set(r.nome_norm, [...(aMano.get(r.nome_norm) ?? []), { schedaId: s.id, principio: s.principio_attivo }])
    } else if (r.principio) {
      for (const ref of dalPrincipio(r.principio)) aggiungi(r.nome_norm, ref)
      if (!visti.has(r.principio)) {
        visti.add(r.principio)
        // il principio attivo si riconosce anche da solo
        for (const p of dividiPrincipio(r.principio)) {
          aggiungi(p.chiave, { schedaId: perChiave.get(p.chiave) ?? null, principio: p.etichetta })
        }
      }
    }
  }
  for (const s of schede) {
    aggiungi(chiavePrincipio(s.principio_attivo), { schedaId: s.id, principio: s.principio_attivo })
  }
  // un collegamento fatto a mano vale piu' di quello che dice l'elenco
  for (const [nome, refs] of aMano) nomi[nome] = refs

  const escluse = (db.prepare('SELECT parola FROM farmaco_escluse ORDER BY parola').all() as { parola: string }[]).map(
    (e) => e.parola
  )
  return { schede, etichette: leggiEtichette(db), nomi, escluse }
}

// ---- collegamenti fatti a mano ------------------------------------------------

export function collegaNomeFarmaco(nome: string, schedaId: number): number {
  assicuraIniziali()
  const db = getDb()
  const norm = normalizza(nome).split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ')
  if (norm.length < 3) throw new Error('Scrivi il nome del farmaco (almeno tre lettere).')
  if (!db.prepare('SELECT 1 FROM farmaco_schede WHERE id = ?').get(schedaId)) {
    throw new Error('Questa scheda non c’è più.')
  }
  const gia = db
    .prepare("SELECT id FROM farmaco_nomi WHERE nome_norm = ? AND scheda_id = ? AND origine = 'manuale'")
    .get(norm, schedaId) as { id: number } | undefined
  if (gia) return gia.id
  return Number(
    db
      .prepare("INSERT INTO farmaco_nomi (nome_norm, nome, scheda_id, origine) VALUES (?, ?, ?, 'manuale')")
      .run(norm, nome.trim(), schedaId).lastInsertRowid
  )
}

export function scollegaNomeFarmaco(id: number): void {
  getDb().prepare("DELETE FROM farmaco_nomi WHERE id = ? AND origine = 'manuale'").run(id)
}

export function collegamentiFarmaci(): NomeCollegato[] {
  assicuraIniziali()
  return getDb()
    .prepare(
      `SELECT n.id, COALESCE(n.nome, n.nome_norm) AS nome, n.scheda_id, s.principio_attivo
       FROM farmaco_nomi n JOIN farmaco_schede s ON s.id = n.scheda_id
       WHERE n.origine = 'manuale' ORDER BY n.nome_norm`
    )
    .all() as NomeCollegato[]
}

// ---- parole da ignorare -------------------------------------------------------

export function aggiungiEsclusaFarmaci(parola: string): void {
  assicuraIniziali()
  const norm = normalizza(parola).split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ')
  if (!norm) throw new Error('Scrivi la parola da ignorare.')
  getDb().prepare('INSERT OR IGNORE INTO farmaco_escluse (parola) VALUES (?)').run(norm)
}

export function togliEsclusaFarmaci(parola: string): void {
  getDb().prepare('DELETE FROM farmaco_escluse WHERE parola = ?').run(parola)
}

// ---- elenco AIFA ---------------------------------------------------------------

// Si aggiunge, non si sostituisce: le schede, i collegamenti fatti a mano e i
// nomi di prima restano (anche un nome ritirato dal commercio, che un paziente
// puo' ancora avere in casa).
export function importaListaAifa(byte: Uint8Array): EsitoImportFarmaci {
  assicuraIniziali()
  const db = getDb()
  const { voci } = leggiListaAifa(byte)
  const nomi = nomiDaElenco(voci)
  // i principi attivi dell'elenco, uno per parte (le associazioni si dividono)
  const principi = new Map<string, { chiave: string; etichetta: string; principio: string }>()
  for (const v of voci) {
    for (const p of dividiPrincipio(v.principio)) {
      principi.set(`${p.chiave} ${v.principio}`, { ...p, principio: v.principio })
    }
  }
  let aggiunti = 0
  db.transaction(() => {
    const ins = db.prepare(
      `INSERT OR IGNORE INTO farmaco_nomi (nome_norm, nome, principio, origine)
       VALUES (?, ?, ?, 'aifa')`
    )
    for (const n of nomi) aggiunti += ins.run(n.nome_norm, n.nome_norm, n.principio).changes
    // anche i principi attivi dell'elenco, perche' si riconoscano da soli
    for (const p of principi.values()) aggiunti += ins.run(p.chiave, p.etichetta, p.principio).changes
    impostaMeta(db, 'aifa_importato_il', new Date().toISOString())
  })()
  const totale = nomi.length + principi.size
  return {
    nomiAggiunti: aggiunti,
    nomiGiaPresenti: Math.max(0, totale - aggiunti),
    principi: new Set(voci.map((v) => v.principio)).size
  }
}

export function statoFarmaci(): StatoFarmaci {
  assicuraIniziali()
  const db = getDb()
  const n = (sql: string): number => (db.prepare(sql).get() as { n: number }).n
  return {
    schede: n('SELECT COUNT(*) AS n FROM farmaco_schede'),
    nomiAifa: n("SELECT COUNT(*) AS n FROM farmaco_nomi WHERE origine = 'aifa'"),
    aifaImportatoIl: meta(db, 'aifa_importato_il')
  }
}

// ---- farmaci del paziente ---------------------------------------------------------

export function farmaciPaziente(pazienteId: number): PazienteFarmaco[] {
  return getDb()
    .prepare('SELECT id, paziente_id, testo, nota FROM paziente_farmaci WHERE paziente_id = ? ORDER BY ordine, id')
    .all(pazienteId) as PazienteFarmaco[]
}

export function aggiungiFarmacoPaziente(pazienteId: number, testo: string, nota: string | null): number {
  const db = getDb()
  const pulito = testo.trim().replace(/\s+/g, ' ')
  if (!pulito) throw new Error('Scrivi il nome del farmaco.')
  const gia = (
    db.prepare('SELECT id, testo FROM paziente_farmaci WHERE paziente_id = ?').all(pazienteId) as {
      id: number
      testo: string
    }[]
  ).find((f) => normalizza(f.testo) === normalizza(pulito))
  if (gia) return gia.id
  const ordine = (
    db.prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS o FROM paziente_farmaci WHERE paziente_id = ?').get(
      pazienteId
    ) as { o: number }
  ).o
  return Number(
    db
      .prepare('INSERT INTO paziente_farmaci (paziente_id, testo, nota, ordine) VALUES (?, ?, ?, ?)')
      .run(pazienteId, pulito, vuotoNull(nota), ordine).lastInsertRowid
  )
}

export function aggiornaFarmacoPaziente(id: number, testo: string, nota: string | null): void {
  const pulito = testo.trim().replace(/\s+/g, ' ')
  if (!pulito) throw new Error('Scrivi il nome del farmaco.')
  getDb().prepare('UPDATE paziente_farmaci SET testo = ?, nota = ? WHERE id = ?').run(pulito, vuotoNull(nota), id)
}

export function togliFarmacoPaziente(id: number): void {
  getDb().prepare('DELETE FROM paziente_farmaci WHERE id = ?').run(id)
}

// Per i documenti: i farmaci come li ha scritti chi compila. Niente note, niente
// schede, niente etichette.
export function farmaciPerDocumento(pazienteId: number): string[] {
  return farmaciPaziente(pazienteId).map((f) => f.testo)
}

// Per prove e strumenti: cosa riconosce l'app in un testo.
export function riconosciNelTesto(testo: string): { testo: string; refs: RefFarmaco[] }[] {
  const ricerca = preparaRicerca(indiceFarmaci())
  return trovaFarmaci(testo, ricerca).map((t) => ({ testo: t.testo, refs: t.refs }))
}
