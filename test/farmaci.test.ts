// I farmaci: riconoscimento nel testo, lettura dell'elenco AIFA, schede,
// collegamenti fatti a mano e lista del paziente. Il database dei farmaci e' solo
// di consultazione: niente di questo deve finire nei documenti.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  aggiornaFarmacoPaziente,
  aggiungiEsclusaFarmaci,
  aggiungiFarmacoPaziente,
  assicuraIniziali,
  collegaNomeFarmaco,
  collegamentiFarmaci,
  eliminaSchedaFarmaco,
  farmaciPaziente,
  farmaciPerDocumento,
  importaListaAifa,
  indiceFarmaci,
  riconosciNelTesto,
  salvaEtichettaFarmaco,
  salvaSchedaFarmaco,
  scollegaNomeFarmaco,
  statoFarmaci,
  togliEsclusaFarmaci,
  togliFarmacoPaziente
} from '../src/main/farmaci'
import {
  chiavePrincipio,
  dividiPrincipio,
  leggiCsv,
  leggiListaAifa,
  nomiDaElenco,
  normalizza,
  preparaRicerca,
  trovaFarmaci,
  type FarmacoSchedaInput
} from '../src/shared/farmaci'
import { eliminaPazienteDefinitivamente } from '../src/main/pazienti'
import { NOMI_INIZIALI, SCHEDE_INIZIALI, SCHEDE_V2, SCHEDE_V3 } from '../src/main/farmaci-iniziali'
import { sezRemota } from '../src/main/cartella-sezioni'
import { relazioneAnamnesi } from '../src/main/relazione-anamnesi'

archivioDiProva()

const paziente = (cognome: string): number =>
  Number(getDb().prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Ana', ?)").run(cognome).lastInsertRowid)

// Un pezzetto dell'elenco vero: stesse colonne, punto e virgola, euro in
// Windows-1252, un campo fra virgolette con le virgolette dentro.
const INTESTAZIONE =
  'Principio attivo;Confezione di riferimento;ATC;AIC;Farmaco;Confezione;Ditta;Prezzo riferimento SSN;Prezzo Pubblico 15 ottobre 2026;Differenza;Nota;Codice gruppo equivalenza'
function elencoAifa(righe: string[][]): Uint8Array {
  const corpo = righe
    .map(([principio, farmaco]) =>
      [principio, '40 UNITA', 'X', '1', farmaco, '"""100 MG COMPRESSE"" 40 COMPRESSE"', 'DITTA SRL', '5,63 €', '5,63 €', '0,00 €', '', 'H1A'].join(';')
    )
    .join('\r\n')
  // € in Windows-1252 = 0x80
  const testo = `${INTESTAZIONE}\r\n${corpo}\r\n`
  const byte: number[] = []
  for (const c of testo) byte.push(c === '€' ? 0x80 : c.charCodeAt(0) & 0xff)
  return Uint8Array.from(byte)
}

const ELENCO = elencoAifa([
  ['Ibuprofene', 'BRUFEN'],
  ['Ibuprofene', 'IBUPROFENE DOC GENERICI'],
  ['Ibuprofene', 'MOMENTACT'],
  ['Diclofenac', 'VOLTAREN'],
  ['Amoxicillina + Acido clavulanico', 'AUGMENTIN DUO'],
  ['Amoxicillina + Acido clavulanico', 'AUGMENTIN'],
  ['Tramadolo cloridrato', 'CONTRAMAL'],
  ['Calcio carbonato + Colecalciferolo', 'CALCIO CARBONATO VITAMINA D3 DOC'],
  ['Calcio carbonato + Colecalciferolo', 'CACIT VITAMINA D3']
])

test('Normalizzare: senza accenti e maiuscole; le chiavi dei principi attivi', () => {
  assert.equal(normalizza('TachipirÌna'), 'tachipirina')
  assert.equal(chiavePrincipio('Tramadolo cloridrato'), 'tramadolo')
  assert.equal(chiavePrincipio('Ossicodone (oxicodone) cloridrato'), 'ossicodone')
  assert.equal(chiavePrincipio('Sodio Risedronato'), 'risedronato')
  assert.equal(chiavePrincipio('Candesartan cilexetil'), 'candesartan')
  assert.equal(chiavePrincipio('Acido acetilsalicilico'), 'acido acetilsalicilico')
  assert.deepEqual(
    dividiPrincipio('Amoxicillina + Acido clavulanico').map((p) => p.chiave),
    ['amoxicillina', 'acido clavulanico']
  )
  assert.deepEqual(
    dividiPrincipio('Salmeterolo/Fluticasone').map((p) => p.chiave),
    ['salmeterolo', 'fluticasone']
  )
})

test('Riconoscere nel testo: parola intera, numeri attaccati, negazioni, esclusioni', () => {
  const ricerca = preparaRicerca({
    nomi: {
      brufen: [{ schedaId: 1, principio: 'Ibuprofene' }],
      'augmentin duo': [{ schedaId: null, principio: 'Amoxicillina' }],
      augmentin: [{ schedaId: null, principio: 'Amoxicillina' }],
      oki: [{ schedaId: null, principio: 'Ketoprofene' }],
      target: [{ schedaId: null, principio: 'Altro' }]
    },
    escluse: ['target']
  })
  const trova = (t: string): string[] => trovaFarmaci(t, ricerca).map((x) => x.testo)
  assert.deepEqual(trova('Prende BRUFEN 600 la sera'), ['BRUFEN'])
  // "non prende" si sottolinea lo stesso: l'app non capisce se lo assume
  assert.deepEqual(trova('non prende Brufen'), ['Brufen'])
  assert.deepEqual(trova('brufén, poi Brufen.'), ['brufén', 'Brufen'])
  // parola intera
  assert.deepEqual(trova('Brufenone e okimoto'), [])
  assert.deepEqual(trova('Oki'), ['Oki'])
  // numeri attaccati
  assert.deepEqual(trova('Brufen600'), ['Brufen'])
  assert.deepEqual(trovaFarmaci('Brufen600', ricerca)[0].fine, 6)
  // nome di piu' parole: vince il piu' lungo, se le parole sono vicine
  assert.deepEqual(trova('prende Augmentin duo da una settimana'), ['Augmentin duo'])
  assert.deepEqual(trova('Augmentin, duo'), ['Augmentin'])
  // parole da escludere
  assert.deepEqual(trova('il target è il ritorno'), [])
  // posizioni nel testo originale
  const t = 'ha preso Brufen ieri'
  const x = trovaFarmaci(t, ricerca)[0]
  assert.equal(t.slice(x.inizio, x.fine), 'Brufen')
})

test('Leggere il CSV: virgolette, euro, intestazione sbagliata', () => {
  assert.deepEqual(leggiCsv('a;"b ""c""";d\r\ne;f;g\r\n'), [
    ['a', 'b "c"', 'd'],
    ['e', 'f', 'g']
  ])
  const { voci } = leggiListaAifa(ELENCO)
  // i doppioni (stesso nome e principio) si contano una volta
  assert.equal(voci.length, 9)
  assert.ok(voci.some((v) => v.nome === 'AUGMENTIN DUO' && v.principio === 'Amoxicillina + Acido clavulanico'))
  assert.throws(() => leggiListaAifa(new TextEncoder().encode('a;b\r\n1;2\r\n')), /AIFA/)
  assert.throws(() => leggiListaAifa(new TextEncoder().encode('')), /vuoto/)
})

test('Dai nomi dell elenco ai nomi dell indice: niente generici, prima parola solo se sicura', () => {
  const { voci } = leggiListaAifa(ELENCO)
  const nomi = nomiDaElenco(voci)
  const nomiNorm = nomi.map((n) => n.nome_norm)
  assert.ok(nomiNorm.includes('brufen'))
  assert.ok(nomiNorm.includes('voltaren'))
  assert.ok(nomiNorm.includes('contramal'))
  // il generico si riconosce dal principio attivo: non entra
  assert.ok(!nomiNorm.includes('ibuprofene doc generici'))
  // "Augmentin duo" ha la sua prima parola, ma "augmentin" e' anche un nome intero
  assert.ok(nomiNorm.includes('augmentin duo'))
  assert.equal(nomiNorm.filter((n) => n === 'augmentin').length, 1)
  // "Cacit vitamina D3": "cacit" vale da sola. "Calcio carbonato..." e' un generico
  assert.ok(nomiNorm.includes('cacit'))
  assert.ok(!nomiNorm.includes('calcio'))
})

test('La prima volta ci sono etichette, schede in bozza e nomi comuni', () => {
  assicuraIniziali()
  assicuraIniziali() // una volta sola
  const indice = indiceFarmaci()
  assert.equal(indice.etichette.length, 6)
  assert.equal(indice.schede.length, SCHEDE_INIZIALI.length + SCHEDE_V2.length + SCHEDE_V3.length)
  assert.ok(indice.schede.every((s) => s.stato === 'bozza' && s.fonte && s.data_revisione))
  // niente e' inventato: dove non c'e' certezza il campo e' vuoto, non "-"
  assert.ok(indice.schede.every((s) => s.avvertenze === null || s.avvertenze.trim() !== ''))
  const flu = indice.schede.find((s) => s.principio_attivo === 'Ciprofloxacina')!
  assert.equal(flu.livello, 2)
  assert.equal(flu.etichette.length, 1)
  // Tachipirina non e' nell'elenco AIFA ma e' fra i nomi iniziali
  const [r] = riconosciNelTesto('prende Tachipirina al bisogno')
  assert.equal(r.testo, 'Tachipirina')
  assert.equal(r.refs[0].principio, 'Paracetamolo')
  assert.ok(r.refs[0].schedaId != null)
  // il principio attivo di una scheda si riconosce da solo, anche con maiuscole
  assert.equal(riconosciNelTesto('IBUPROFENE 600')[0].refs[0].principio, 'Ibuprofene')
  // la parola comune di default non si sottolinea
  assert.deepEqual(riconosciNelTesto('carenza di ferro, il target'), [])
})

test('Importare l elenco AIFA: nomi commerciali, associazioni, aggiornamenti senza perdere niente', () => {
  const prima = statoFarmaci()
  assert.equal(prima.aifaImportatoIl, null)
  const esito = importaListaAifa(ELENCO)
  assert.ok(esito.nomiAggiunti > 0)
  assert.equal(esito.principi, 5)
  assert.ok(statoFarmaci().aifaImportatoIl)

  const brufen = riconosciNelTesto('Brufen 600')
  assert.equal(brufen[0].refs[0].principio, 'Ibuprofene')
  assert.ok(brufen[0].refs[0].schedaId != null, 'Ibuprofene ha la scheda iniziale')
  // associazione: una voce per ciascun principio attivo
  const aug = riconosciNelTesto('Augmentin')[0]
  assert.deepEqual(
    aug.refs.map((r) => r.principio),
    ['Amoxicillina', 'Acido clavulanico']
  )
  // ogni principio dell'associazione porta alla sua scheda
  assert.ok(aug.refs.every((r) => r.schedaId != null))
  // il sale non cambia il principio attivo
  assert.equal(riconosciNelTesto('Contramal')[0].refs[0].schedaId != null, true)
  assert.equal(riconosciNelTesto('Cacit')[0].refs.length, 2)

  // di nuovo lo stesso elenco: niente doppioni
  const ancora = importaListaAifa(ELENCO)
  assert.equal(ancora.nomiAggiunti, 0)
  const copie = getDb()
    .prepare("SELECT nome_norm, COUNT(*) AS n FROM farmaco_nomi WHERE origine = 'aifa' GROUP BY nome_norm, principio HAVING n > 1")
    .all()
  assert.equal(copie.length, 0)
})

test('Scheda: principio unico, etichette, livello; un nome sconosciuto si collega a mano', () => {
  const base: FarmacoSchedaInput = {
    principio_attivo: 'Ranolazina',
    classe: 'Antianginoso',
    usi: null,
    info_fisio: '  ',
    avvertenze: null,
    livello: 1,
    fonte: 'RCP',
    data_revisione: '2026-11-12',
    stato: 'validata',
    etichette: []
  }
  const eti = salvaEtichettaFarmaco(null, 'Prova etichetta')
  assert.throws(() => salvaEtichettaFarmaco(null, 'prova ETICHETTA'), /già/)
  const id = salvaSchedaFarmaco({ ...base, etichette: [eti, 99999] })
  const salvata = indiceFarmaci().schede.find((s) => s.id === id)!
  assert.equal(salvata.info_fisio, null)
  assert.deepEqual(salvata.etichette, [eti])
  assert.equal(salvata.stato, 'validata')
  assert.throws(() => salvaSchedaFarmaco({ ...base }), /C’è già una scheda/)
  assert.throws(() => salvaSchedaFarmaco({ ...base, principio_attivo: ' ' }), /principio attivo/)
  assert.throws(() => salvaSchedaFarmaco({ ...base, principio_attivo: 'X', livello: 5 as 1 }), /livello/)

  // "Ranexa" l'app non lo conosce: resta testo libero...
  assert.deepEqual(riconosciNelTesto('prende Ranexa'), [])
  // ...e si collega: "Ranexa = Ranolazina"
  const link = collegaNomeFarmaco('Ranexa', id)
  assert.equal(collegaNomeFarmaco('ranexa', id), link, 'lo stesso collegamento non si ripete')
  const r = riconosciNelTesto('prende Ranexa')[0]
  assert.deepEqual(r.refs, [{ schedaId: id, principio: 'Ranolazina' }])
  assert.equal(collegamentiFarmaci().find((c) => c.id === link)?.principio_attivo, 'Ranolazina')
  // un collegamento a mano vale piu' dell'elenco AIFA
  collegaNomeFarmaco('Brufen', id)
  assert.deepEqual(riconosciNelTesto('Brufen')[0].refs.map((x) => x.principio), ['Ranolazina'])
  scollegaNomeFarmaco(getDb().prepare("SELECT id FROM farmaco_nomi WHERE nome_norm = 'brufen' AND origine = 'manuale'").pluck().get() as number)
  assert.equal(riconosciNelTesto('Brufen')[0].refs[0].principio, 'Ibuprofene')

  // un aggiornamento dell'elenco non tocca schede e collegamenti
  importaListaAifa(ELENCO)
  assert.equal(riconosciNelTesto('Ranexa').length, 1)

  // eliminare la scheda toglie i suoi collegamenti, non i testi dei pazienti
  eliminaSchedaFarmaco(id)
  assert.deepEqual(riconosciNelTesto('prende Ranexa'), [])
})

test('Parole da escludere: si aggiungono e si tolgono', () => {
  assert.equal(riconosciNelTesto('Tachipirina').length, 1)
  aggiungiEsclusaFarmaci('  TACHIPIRÌNA ')
  assert.deepEqual(riconosciNelTesto('Tachipirina'), [])
  togliEsclusaFarmaci('tachipirina')
  assert.equal(riconosciNelTesto('Tachipirina').length, 1)
  assert.throws(() => aggiungiEsclusaFarmaci('  '), /parola/)
})

test('Farmaci del paziente: come scritti, con nota facoltativa; nei documenti solo i nomi', () => {
  const p = paziente('Rossi')
  const altro = paziente('Bianchi')
  const a = aggiungiFarmacoPaziente(p, '  Brufen   600 ', null)
  assert.equal(aggiungiFarmacoPaziente(p, 'brufen 600', 'duplicato'), a, 'lo stesso farmaco non si ripete')
  aggiungiFarmacoPaziente(p, 'Tachipirina', '1000 mg quando serve')
  aggiungiFarmacoPaziente(altro, 'Lasix', null)
  assert.deepEqual(
    farmaciPaziente(p).map((f) => [f.testo, f.nota]),
    [
      ['Brufen 600', null],
      ['Tachipirina', '1000 mg quando serve']
    ]
  )
  // anche un farmaco sconosciuto si scrive e resta com'e'
  const x = aggiungiFarmacoPaziente(p, 'Xyzzyfarm', null)
  aggiornaFarmacoPaziente(x, 'Xyzzyfarm 5', '  ')
  assert.deepEqual(farmaciPaziente(p).at(-1), { id: x, paziente_id: p, testo: 'Xyzzyfarm 5', nota: null })
  assert.throws(() => aggiungiFarmacoPaziente(p, ' ', null), /nome del farmaco/)
  // nei documenti: solo il testo scritto, mai note o schede
  assert.deepEqual(farmaciPerDocumento(p), ['Brufen 600', 'Tachipirina', 'Xyzzyfarm 5'])
  togliFarmacoPaziente(x)
  assert.equal(farmaciPaziente(p).length, 2)
  // eliminando il paziente per sempre se ne va anche la sua lista, non le schede
  const schede = indiceFarmaci().schede.length
  eliminaPazienteDefinitivamente(p)
  assert.equal(farmaciPaziente(p).length, 0)
  assert.equal(farmaciPaziente(altro).length, 1)
  assert.equal(indiceFarmaci().schede.length, schede)
})

test('Nei documenti i farmaci compaiono come scritti: mai note, schede, informazioni o etichette', () => {
  const p = paziente('Verdi')
  aggiungiFarmacoPaziente(p, 'Brufen', 'una al giorno, dice lui')
  aggiungiFarmacoPaziente(p, 'Lyrica', null)
  const cartella = JSON.stringify(sezRemota(p))
  const relazione = JSON.stringify(relazioneAnamnesi(p))
  for (const doc of [cartella, relazione]) {
    assert.ok(doc.includes('Brufen, Lyrica'), doc)
    assert.ok(!doc.includes('una al giorno'), 'la nota non esce')
    assert.ok(!/ibuprofene|pregabalin|attenzione|bozza|Rischio|FANS/i.test(doc), 'niente dalla scheda')
  }
  // senza altro scritto nell'anamnesi remota, i soli farmaci bastano a far comparire la sezione
  assert.ok(sezRemota(p).length > 0)
  assert.deepEqual(sezRemota(paziente('Neri')), [])
})

test('farmaci: chi ha già il database riceve i nomi commerciali aggiunti dopo', () => {
  assicuraIniziali()
  const db = getDb()
  // Simula un database creato con la prima tranche: senza Brufen e Buscopan, versione 1.
  db.prepare("DELETE FROM farmaco_nomi WHERE nome_norm IN ('brufen', 'buscopan')").run()
  db.prepare("DELETE FROM farmaco_meta WHERE chiave = 'nomi_versione'").run()
  assicuraIniziali()
  const nomi = indiceFarmaci().nomi
  assert.ok(nomi[normalizza('Brufen')]?.length, 'Brufen deve essere riconosciuto')
  assert.ok(nomi[normalizza('Buscopan')]?.length, 'Buscopan deve essere riconosciuto')
  assert.ok(riconosciNelTesto('prende Buscopan al bisogno').some((p) => p.refs.length > 0))
})

test('farmaci: le schede e i nomi della terza tranche arrivano anche a chi ha già il database', () => {
  assicuraIniziali()
  const db = getDb()
  // Simula un database fermo alla seconda tranche: senza Nicetile, senza la scheda di Anastrozolo.
  db.prepare("DELETE FROM farmaco_nomi WHERE nome_norm IN ('nicetile', 'arimidex')").run()
  db.prepare("DELETE FROM farmaco_schede WHERE principio_attivo IN ('Anastrozolo', 'Acetilcarnitina')").run()
  db.prepare("UPDATE farmaco_meta SET valore = '1' WHERE chiave IN ('nomi_versione', 'schede_versione')").run()
  assicuraIniziali()
  const indice = indiceFarmaci()
  const ref = indice.nomi[normalizza('Nicetile')]
  assert.ok(ref?.length, 'Nicetile deve essere riconosciuto')
  const scheda = indice.schede.find((s) => s.principio_attivo === 'Acetilcarnitina')
  assert.ok(scheda, 'la scheda di Acetilcarnitina deve esserci')
  assert.equal(scheda.stato, 'bozza')
  assert.equal(ref[0].schedaId, scheda.id)
  const aromatasi = indice.schede.find((s) => s.principio_attivo === 'Anastrozolo')
  assert.ok(aromatasi && aromatasi.livello === 2)
  assert.ok(indice.nomi[normalizza('Arimidex')]?.length)
})

test('farmaci: ogni principio attivo ha una sola scheda e ogni nome iniziale porta a una scheda', () => {
  const tutte = [...SCHEDE_INIZIALI, ...SCHEDE_V2, ...SCHEDE_V3]
  const chiavi = tutte.map((x) => chiavePrincipio(x.principio_attivo))
  assert.equal(new Set(chiavi).size, chiavi.length, 'principi attivi doppi nelle schede iniziali')
  const conScheda = new Set(chiavi)
  const senza: string[] = []
  for (const [nome, principio] of NOMI_INIZIALI)
    for (const p of dividiPrincipio(principio))
      if (!conScheda.has(p.chiave)) senza.push(`${nome} → ${p.etichetta}`)
  assert.deepEqual(senza, [], 'nomi che portano a un principio senza scheda')
})
