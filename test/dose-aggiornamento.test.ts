// L'aggiornamento di un archivio di prima della dose ridisegnata (migrazione 79):
// il tipo agli esercizi con le regole confermate, le sezioni delle fasi raccolte
// in libreria senza cambiare cosa propongono, i modelli pronti.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3-multiple-ciphers'
import { MIGRATIONS, registraFunzioniMigrazioni, runMigrations } from '../src/main/migrations'
import { obiettivoDaNome, tipoDiPartenza } from '../src/shared/dose-partenza'

const tipo = (nome: string, contaCome: string | null = null, categoria = 'Varie'): string | null =>
  tipoDiPartenza(nome, null, categoria, null, contaCome)

test('Il tipo di partenza degli esercizi', () => {
  assert.equal(tipo('CMJ continuo'), 'plio_est')
  assert.equal(tipo('Single leg hop continui'), 'plio_est')
  assert.equal(tipo('Broad jump continui'), 'plio_est')
  assert.equal(tipo('CMJ zavorrato'), 'plio_int')
  assert.equal(tipo('Drop jump'), 'plio_int')
  assert.equal(tipo('Salto singolo massimale'), 'plio_int')
  assert.equal(tipo('Squat jump zavorrato'), 'rinforzo')
  assert.equal(tipo('Power clean'), 'rinforzo')
  assert.equal(tipo('Nordic hamstring'), 'rinforzo')
  assert.equal(tipo('Pogo jump', 'plio_est'), 'non_conta')
  assert.equal(tipo('Side plank'), 'non_conta')
  assert.equal(tipo('Isometria sottomassimale al muro', 'forza'), 'non_conta')
  assert.equal(tipo('Isometria massimale quadricipite'), 'rinforzo')
  assert.equal(tipo('Skip alto'), 'non_conta')
  assert.equal(tipo('Cat cow', null, 'Mobilità'), 'non_conta')
  // quello che era gia' stato detto sulla categoria
  assert.equal(tipo('Back squat', 'forza'), 'rinforzo')
  assert.equal(tipo('Alzata', 'potenza'), 'rinforzo')
  assert.equal(tipo('Broad jump', 'plio_est'), 'plio_est')
  assert.equal(tipo('Salto laterale', null, 'Pliometria intensiva'), 'plio_int')
  // non si capisce: da sistemare
  assert.equal(tipo('Step-up laterale'), null)
  assert.equal(tipo('Broad jump'), null)
  assert.equal(obiettivoDaNome('Rinforzo'), 'forza')
  assert.equal(obiettivoDaNome('Pliometria'), 'pliometria')
  assert.equal(obiettivoDaNome('Core e distale'), 'non_conta')
  assert.equal(obiettivoDaNome('Circuito'), null)
})

test('Un archivio di prima si aggiorna: esercizi, sezioni, sedute e modelli', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  registraFunzioniMigrazioni(db)
  for (let i = 0; i < 78; i++) {
    db.exec(MIGRATIONS[i])
    db.pragma(`user_version = ${i + 1}`)
  }
  const ins = (sql: string, ...a: unknown[]): number => Number(db.prepare(sql).run(...a).lastInsertRowid)
  const rinforzo = ins("INSERT INTO categorie (nome, conta_come) VALUES ('Rinforzo', 'forza')")
  const quad = ins("INSERT INTO categorie (nome, padre_id) VALUES ('Quadricipite', ?)", rinforzo)
  const gluteo = ins("INSERT INTO categorie (nome, padre_id) VALUES ('Gluteo', ?)", rinforzo)
  const plio = ins("INSERT INTO categorie (nome, conta_come) VALUES ('Balzi', 'plio_est')")
  const squat = ins("INSERT INTO esercizi (nome, categoria_id) VALUES ('Back squat', ?)", quad)
  const hop = ins("INSERT INTO esercizi (nome, categoria_id) VALUES ('Hop', ?)", plio)
  const altro = ins("INSERT INTO categorie (nome) VALUES ('Varie')")
  const boh = ins("INSERT INTO esercizi (nome, categoria_id) VALUES ('Step-up', ?)", altro)

  const pat = ins("INSERT INTO patologie (nome) VALUES ('LCA')")
  const fase = (nome: string): number => ins('INSERT INTO fasi (patologia_id, nome) VALUES (?, ?)', pat, nome)
  const sezione = (f: number, nome: string, ordine: number, categorie: number[]): number => {
    const id = ins('INSERT INTO sezioni (fase_id, nome, ordine) VALUES (?, ?, ?)', f, nome, ordine)
    categorie.forEach((c, i) => ins('INSERT INTO sezione_categorie (sezione_id, categoria_id, ordine) VALUES (?, ?, ?)', id, c, i))
    return id
  }
  const [f1, f2, f3] = [fase('Uno'), fase('Due'), fase('Tre')]
  const s1 = sezione(f1, 'Forza', 0, [quad]) // diversa dalle altre: resta della fase
  const s2 = sezione(f2, 'Forza', 0, [quad, gluteo])
  const s3 = sezione(f3, 'forza ', 0, [quad, gluteo])
  const s4 = sezione(f1, 'Salti', 1, [plio])

  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('A', 'B')")
  const seduta = ins("INSERT INTO sedute (paziente_id, data, fase_id) VALUES (?, '2026-11-01', ?)", pz, f2)
  const ss = ins("INSERT INTO seduta_sezioni (seduta_id, sezione_id, nome) VALUES (?, ?, 'Forza')", seduta, s2)
  const alVolo = ins("INSERT INTO seduta_sezioni (seduta_id, nome, ordine) VALUES (?, 'Extra', 1)", seduta)
  ins('INSERT INTO seduta_esercizi (seduta_id, esercizio_id, seduta_sezione_id) VALUES (?, ?, ?)', seduta, squat, ss)
  db.prepare("INSERT INTO fase_dose (fase_id, chiave, minimo) VALUES (?, 'plio_est', 80)").run(f1)

  runMigrations(db)

  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  assert.deepEqual(db.pragma('foreign_key_check'), [])
  const tipoDi = (id: number): unknown => (db.prepare('SELECT tipo FROM esercizi WHERE id = ?').get(id) as { tipo: unknown }).tipo
  assert.deepEqual([tipoDi(squat), tipoDi(hop), tipoDi(boh)], ['rinforzo', 'plio_est', null])

  const libreria = db.prepare('SELECT id, nome, obiettivo FROM sezioni_libreria ORDER BY ordine, id').all() as {
    id: number
    nome: string
    obiettivo: string | null
  }[]
  assert.equal(libreria.length, 12, 'le undici pronte piu\' «Salti»')
  const forza = libreria.find((l) => l.nome === 'Forza')!
  assert.equal(forza.obiettivo, 'forza')
  const categorie = (id: number): number[] =>
    (db.prepare('SELECT categoria_id FROM sezione_libreria_categorie WHERE libreria_id = ? ORDER BY ordine, categoria_id').all(id) as {
      categoria_id: number
    }[]).map((r) => r.categoria_id)
  assert.deepEqual(categorie(forza.id), [quad, gluteo], 'quelle piu\' usate')
  const salti = libreria.find((l) => l.nome === 'Salti')!
  assert.equal(salti.obiettivo, null)
  assert.deepEqual(categorie(salti.id), [plio])
  // le pronte che nessuna fase aveva prendono le categorie gia' dette
  assert.deepEqual(categorie(libreria.find((l) => l.nome === 'Ipertrofia')!.id), [rinforzo])
  assert.deepEqual(categorie(libreria.find((l) => l.nome === 'Pliometria estensiva')!.id), [plio])

  const di = (id: number): unknown => db.prepare('SELECT nome, libreria_id, obiettivo FROM sezioni WHERE id = ?').get(id)
  assert.deepEqual(di(s1), { nome: 'Forza', libreria_id: null, obiettivo: 'forza' })
  assert.deepEqual(di(s2), { nome: 'Forza', libreria_id: forza.id, obiettivo: null })
  assert.deepEqual(di(s3), { nome: 'forza ', libreria_id: forza.id, obiettivo: null })
  assert.deepEqual(di(s4), { nome: 'Salti', libreria_id: salti.id, obiettivo: null })
  // la fase "Uno" propone quello che proponeva
  assert.deepEqual(
    db.prepare('SELECT categoria_id FROM sezione_categorie WHERE sezione_id = ?').all(s1),
    [{ categoria_id: quad }]
  )

  const obiettivo = (id: number): unknown => (db.prepare('SELECT obiettivo FROM seduta_sezioni WHERE id = ?').get(id) as { obiettivo: unknown }).obiettivo
  assert.equal(obiettivo(ss), 'forza')
  assert.equal(obiettivo(alVolo), null)
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM dose_modelli').get() as { n: number }).n, 3)
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM fasi WHERE dose_modello_id IS NOT NULL').get() as { n: number }).n, 0)
  db.close()
})
