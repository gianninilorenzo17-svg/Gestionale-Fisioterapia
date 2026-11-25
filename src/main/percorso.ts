// Il percorso di riabilitazione: patologie, le loro fasi (palestra e campo) e,
// dentro a ogni fase, obiettivi, sezioni della seduta e test di avanzamento.
// Senza niente di Electron (modello: sedute.ts); il riordino e il posto in fondo
// vengono da elenchi.ts.
import { getDb } from './db'
import { eliminaConCestino, nomeDi } from './cestino'
import { prossimoOrdine } from './elenchi'
import { obiettivoValido, type ObiettivoSezione } from '../shared/dose'
import { chiaveNome, obiettivoDaNome } from '../shared/dose-partenza'
import type { SezioneConCategorie, SezioneLibreria } from '../shared/types'

const nuovoNome = (nome: string): string => nome.trim()
const dentroFase = (faseId: number): { colonna: string; id: number } => ({ colonna: 'fase_id', id: faseId })

// ---- Patologie ----
export const elencoPatologie = (): unknown[] =>
  getDb().prepare('SELECT * FROM patologie ORDER BY ordine, nome').all()

export function creaPatologia(nome: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO patologie (nome, ordine) VALUES (?, ?)')
      .run(nuovoNome(nome), prossimoOrdine('patologie')).lastInsertRowid
  )
}

// Poche patologie hanno un percorso al campo: l'interruttore sta qui, cosi'
// tutte le altre non vedono mai la parola "campo".
export function impostaCampo(id: number, attivo: boolean): void {
  getDb().prepare('UPDATE patologie SET ha_campo = ? WHERE id = ?').run(attivo ? 1 : 0, id)
}

export function rinominaPatologia(id: number, nome: string): void {
  getDb().prepare('UPDATE patologie SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaPatologia(id: number): void {
  eliminaConCestino('patologie', id, 'Patologia', nomeDi('patologie', id))
}

// ---- Fasi ----
// Tutte le fasi della patologia, palestra e campo insieme: chi le usa
// filtra secondo il posto in cui deve mostrarle.
export const elencoFasi = (patologiaId: number): unknown[] =>
  getDb().prepare('SELECT * FROM fasi WHERE patologia_id = ? ORDER BY campo, ordine, id').all(patologiaId)

export function creaFase(patologiaId: number, nome: string, campo = false): number {
  const db = getDb()
  // L'ordine si conta dentro all'elenco di appartenenza: palestra e campo
  // sono due elenchi, ognuno con la sua numerazione.
  const { next } = db
    .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM fasi WHERE patologia_id = ? AND campo = ?')
    .get(patologiaId, campo ? 1 : 0) as { next: number }
  return Number(
    db
      .prepare('INSERT INTO fasi (patologia_id, nome, ordine, campo) VALUES (?, ?, ?, ?)')
      .run(patologiaId, nuovoNome(nome), next, campo ? 1 : 0).lastInsertRowid
  )
}

export function rinominaFase(id: number, nome: string): void {
  getDb().prepare('UPDATE fasi SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaFase(id: number): void {
  eliminaConCestino('fasi', id, 'Fase', nomeDi('fasi', id))
}

// ---- Obiettivi ----
export const elencoObiettivi = (faseId: number): unknown[] =>
  getDb().prepare('SELECT * FROM obiettivi WHERE fase_id = ? ORDER BY ordine, id').all(faseId)

export function creaObiettivo(faseId: number, nome: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO obiettivi (fase_id, nome, ordine) VALUES (?, ?, ?)')
      .run(faseId, nuovoNome(nome), prossimoOrdine('obiettivi', dentroFase(faseId))).lastInsertRowid
  )
}

export function rinominaObiettivo(id: number, nome: string): void {
  getDb().prepare('UPDATE obiettivi SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaObiettivo(id: number): void {
  eliminaConCestino('obiettivi', id, 'Obiettivo', nomeDi('obiettivi', id))
}

// ---- Sezioni (struttura della seduta per fase) ----
// Una sezione della fase richiama quella della libreria (libreria_id: nome,
// categorie e obiettivo sono i suoi) oppure e' "solo di questa fase" e ha i
// propri.
export function elencoSezioni(faseId: number): SezioneConCategorie[] {
  const db = getDb()
  const sezioni = db
    .prepare(
      `SELECT z.id, z.fase_id, z.nome, z.ordine, z.libreria_id,
              CASE WHEN z.libreria_id IS NULL THEN z.obiettivo ELSE l.obiettivo END AS obiettivo
       FROM sezioni z LEFT JOIN sezioni_libreria l ON l.id = z.libreria_id
       WHERE z.fase_id = ? ORDER BY z.ordine, z.id`
    )
    .all(faseId) as Omit<SezioneConCategorie, 'categoria_ids'>[]
  const proprie = db.prepare(
    'SELECT categoria_id FROM sezione_categorie WHERE sezione_id = ? ORDER BY ordine, categoria_id'
  )
  const dellaLibreria = db.prepare(
    'SELECT categoria_id FROM sezione_libreria_categorie WHERE libreria_id = ? ORDER BY ordine, categoria_id'
  )
  return sezioni.map((s) => ({
    ...s,
    categoria_ids: (
      (s.libreria_id == null ? proprie.all(s.id) : dellaLibreria.all(s.libreria_id)) as { categoria_id: number }[]
    ).map((r) => r.categoria_id)
  }))
}

export function creaSezione(faseId: number, nome: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO sezioni (fase_id, nome, ordine) VALUES (?, ?, ?)')
      .run(faseId, nuovoNome(nome), prossimoOrdine('sezioni', dentroFase(faseId))).lastInsertRowid
  )
}

export function rinominaSezione(id: number, nome: string): void {
  getDb().prepare('UPDATE sezioni SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaSezione(id: number): void {
  eliminaConCestino('sezioni', id, 'Sezione', nomeDi('sezioni', id))
}

// Le categorie di esercizi che una sezione propone, nell'ordine scelto.
export function impostaCategorieSezione(sezioneId: number, categoriaIds: number[]): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM sezione_categorie WHERE sezione_id = ?').run(sezioneId)
    const ins = db.prepare('INSERT INTO sezione_categorie (sezione_id, categoria_id, ordine) VALUES (?, ?, ?)')
    categoriaIds.forEach((cid, i) => ins.run(sezioneId, cid, i))
  })()
}

const validaObiettivo = (o: ObiettivoSezione | null): void => {
  if (o != null && !obiettivoValido(o)) throw new Error("L'obiettivo della sezione non è valido: riprova.")
}

// L'obiettivo di una sezione solo di questa fase (quelle della libreria hanno
// il loro).
export function impostaObiettivoSezione(id: number, obiettivo: ObiettivoSezione | null): void {
  validaObiettivo(obiettivo)
  getDb().prepare('UPDATE sezioni SET obiettivo = ? WHERE id = ? AND libreria_id IS NULL').run(obiettivo, id)
}

// Spuntare o togliere in una fase una sezione della libreria.
export function usaSezioneDiLibreria(faseId: number, libreriaId: number, usata: boolean): void {
  const db = getDb()
  if (!usata) {
    // i suoi dati restano in libreria: si rimette spuntandola di nuovo
    db.prepare('DELETE FROM sezioni WHERE fase_id = ? AND libreria_id = ?').run(faseId, libreriaId)
    return
  }
  if (db.prepare('SELECT 1 FROM sezioni WHERE fase_id = ? AND libreria_id = ?').get(faseId, libreriaId)) return
  db.prepare(
    `INSERT INTO sezioni (fase_id, nome, ordine, libreria_id)
     SELECT ?, nome, ?, id FROM sezioni_libreria WHERE id = ?`
  ).run(faseId, prossimoOrdine('sezioni', dentroFase(faseId)), libreriaId)
}

// ---- Le sezioni della libreria ----
export function elencoSezioniLibreria(): SezioneLibreria[] {
  const db = getDb()
  const categorie = db.prepare(
    'SELECT categoria_id FROM sezione_libreria_categorie WHERE libreria_id = ? ORDER BY ordine, categoria_id'
  )
  const usi = db.prepare(
    `SELECT p.nome AS patologia, f.nome AS fase
     FROM sezioni z JOIN fasi f ON f.id = z.fase_id JOIN patologie p ON p.id = f.patologia_id
     WHERE z.libreria_id = ? ORDER BY p.ordine, p.nome, f.campo, f.ordine`
  )
  return (
    db.prepare('SELECT id, nome, obiettivo, ordine FROM sezioni_libreria ORDER BY ordine, id').all() as Omit<
      SezioneLibreria,
      'categoria_ids' | 'usata_in'
    >[]
  ).map((s) => ({
    ...s,
    categoria_ids: (categorie.all(s.id) as { categoria_id: number }[]).map((r) => r.categoria_id),
    usata_in: (usi.all(s.id) as { patologia: string; fase: string }[]).map((u) => `${u.patologia} — ${u.fase}`)
  }))
}

function nomeLibreria(nome: string, id: number | null): string {
  const pulito = nome.trim()
  if (pulito === '') throw new Error('Scrivi il nome.')
  const doppia = (
    getDb().prepare('SELECT id, nome FROM sezioni_libreria').all() as { id: number; nome: string }[]
  ).some((s) => s.id !== id && chiaveNome(s.nome) === chiaveNome(pulito))
  if (doppia) throw new Error(`In libreria c'è già una sezione «${pulito}».`)
  return pulito
}

export function creaSezioneLibreria(nome: string): number {
  const pulito = nomeLibreria(nome, null)
  return Number(
    getDb()
      .prepare('INSERT INTO sezioni_libreria (nome, obiettivo, ordine) VALUES (?, ?, ?)')
      .run(pulito, obiettivoDaNome(pulito), prossimoOrdine('sezioni_libreria')).lastInsertRowid
  )
}

export function rinominaSezioneLibreria(id: number, nome: string): void {
  const pulito = nomeLibreria(nome, id)
  const db = getDb()
  db.transaction(() => {
    db.prepare('UPDATE sezioni_libreria SET nome = ? WHERE id = ?').run(pulito, id)
    // le fasi che la richiamano si leggono con il nome nuovo
    db.prepare('UPDATE sezioni SET nome = ? WHERE libreria_id = ?').run(pulito, id)
  })()
}

export function impostaObiettivoLibreria(id: number, obiettivo: ObiettivoSezione | null): void {
  validaObiettivo(obiettivo)
  getDb().prepare('UPDATE sezioni_libreria SET obiettivo = ? WHERE id = ?').run(obiettivo, id)
}

export function impostaCategorieLibreria(id: number, categoriaIds: number[]): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM sezione_libreria_categorie WHERE libreria_id = ?').run(id)
    const ins = db.prepare(
      'INSERT INTO sezione_libreria_categorie (libreria_id, categoria_id, ordine) VALUES (?, ?, ?)'
    )
    categoriaIds.forEach((cid, i) => ins.run(id, cid, i))
  })()
}

// Eliminandola, le fasi che la usavano non perdono niente: la sezione diventa
// "solo di quella fase", con le stesse categorie e lo stesso obiettivo. Dal
// cestino torna in libreria e le fasi tornano a richiamarla.
export function eliminaSezioneLibreria(id: number): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM sezione_categorie WHERE sezione_id IN (SELECT id FROM sezioni WHERE libreria_id = ?)').run(id)
    db.prepare(
      `INSERT INTO sezione_categorie (sezione_id, categoria_id, ordine)
       SELECT z.id, c.categoria_id, c.ordine
       FROM sezioni z JOIN sezione_libreria_categorie c ON c.libreria_id = z.libreria_id
       WHERE z.libreria_id = ?`
    ).run(id)
    db.prepare(
      'UPDATE sezioni SET obiettivo = (SELECT obiettivo FROM sezioni_libreria WHERE id = ?) WHERE libreria_id = ?'
    ).run(id, id)
    eliminaConCestino('sezioni_libreria', id, 'Sezione della libreria', nomeDi('sezioni_libreria', id))
  })()
}

// ---- Test di avanzamento (per fase) ----
export const elencoTestAvanzamento = (faseId: number): unknown[] =>
  getDb().prepare('SELECT * FROM test_avanzamento WHERE fase_id = ? ORDER BY ordine, id').all(faseId)

export function creaTestAvanzamento(faseId: number, nome: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO test_avanzamento (fase_id, nome, ordine) VALUES (?, ?, ?)')
      .run(faseId, nuovoNome(nome), prossimoOrdine('test_avanzamento', dentroFase(faseId))).lastInsertRowid
  )
}

export function rinominaTestAvanzamento(id: number, nome: string): void {
  getDb().prepare('UPDATE test_avanzamento SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaTestAvanzamento(id: number): void {
  eliminaConCestino('test_avanzamento', id, 'Test di avanzamento', nomeDi('test_avanzamento', id))
}
