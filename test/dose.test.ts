// La dose: il conto (shared/dose.ts), cosa manca al minimo del modello, i
// modelli e le sezioni in libreria, le altre sedute della settimana e quello che
// si fotografa sulla seduta.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  contaRighe,
  intervalloTesto,
  livelloDose,
  primoNumero,
  quanto,
  quoteLavoro,
  secondiDi,
  settimanaDi,
  testoVoceSeduta,
  valutaSeduta,
  voceRiga,
  type DoseModello,
  type RigaConto,
  type VoceModello
} from '../src/shared/dose'
import { nomeConMonopodalico } from '../src/shared/varianti'
import {
  creaModello,
  doseSettimana,
  elencoModelli,
  eliminaModello,
  fasiConModello,
  impostaModelloFase,
  modelloDiFase,
  salvaModello
} from '../src/main/dose'
import { creaEsercizio, elencoEsercizi, impostaTipo } from '../src/main/esercizi'
import {
  creaSezione,
  creaSezioneLibreria,
  elencoSezioni,
  elencoSezioniLibreria,
  eliminaSezioneLibreria,
  impostaCategorieLibreria,
  impostaObiettivoSezione,
  rinominaSezioneLibreria,
  usaSezioneDiLibreria
} from '../src/main/percorso'
import { elencoCestino, ripristina } from '../src/main/cestino'
import { impostaSeduteSettimana } from '../src/main/pazienti'
import { creaSeduta, elencoSedute, leggiSeduta, programmaSeduta } from '../src/main/sedute'
import { ultimaVoltaPerPaziente } from '../src/main/ultima-volta'
import { datiScheda } from '../src/main/scheda-dati'
import type { SedutaInput } from '../src/shared/types'

archivioDiProva()

const riga = (altro: Partial<RigaConto> = {}): RigaConto => ({
  categoria_id: 1,
  tipo: 'rinforzo',
  obiettivo: 'forza',
  gambe: 'due',
  serie: '3',
  cluster: null,
  ripetizioni: '8',
  ...altro
})

test('I numeri scritti: "8-10" vale 8, un tempo si legge in secondi', () => {
  assert.equal(primoNumero('8-10'), 8)
  assert.equal(primoNumero('10 per gamba'), 10)
  assert.equal(primoNumero('30"'), null)
  assert.equal(primoNumero('max'), null)
  assert.equal(secondiDi('30"'), 30)
  assert.equal(secondiDi("45''"), 45)
  assert.equal(secondiDi('30-45 sec'), 30)
  assert.equal(secondiDi("1'"), 60)
  assert.equal(secondiDi("1'30\""), 90)
  assert.equal(secondiDi('2 min'), 120)
  assert.equal(secondiDi('5s'), 5)
  assert.equal(secondiDi('10'), null)
})

test("La voce di una riga: la sezione decide solo il rinforzo, la pliometria si conta ovunque", () => {
  assert.equal(voceRiga(riga()), 'forza')
  assert.equal(voceRiga(riga({ obiettivo: 'ipertrofia' })), 'ipertrofia')
  assert.equal(voceRiga(riga({ obiettivo: 'non_conta' })), null)
  assert.equal(voceRiga(riga({ obiettivo: 'pliometria' })), null)
  assert.equal(voceRiga(riga({ obiettivo: null })), 'senza')
  assert.equal(voceRiga(riga({ tipo: 'plio_int', obiettivo: 'non_conta' })), 'plio_int')
  assert.equal(voceRiga(riga({ tipo: 'non_conta' })), null)
  assert.equal(voceRiga(riga({ tipo: null })), null)
  // l'eccezione sulla riga vince su tutto
  assert.equal(voceRiga(riga({ conta: 'ipertrofia' })), 'ipertrofia')
  assert.equal(voceRiga(riga({ conta: 'non_conta' })), null)
  assert.equal(voceRiga(riga({ tipo: 'non_conta', conta: 'plio_est' })), 'plio_est')
})

test('Quanto vale una riga, voce per voce', () => {
  // contatti: 3 × 10 = 30, a una gamba si sommano le due
  assert.equal(quanto(riga({ ripetizioni: '10' }), 'plio_est'), 30)
  assert.equal(quanto(riga({ ripetizioni: '10', monopodalico: 1 }), 'plio_est'), 60)
  assert.equal(quanto(riga({ ripetizioni: '10', gambe: 'una' }), 'plio_int'), 60)
  assert.equal(quanto(riga({ cluster: '3', ripetizioni: '4' }), 'plio_est'), 36)
  // un cluster 4 × (3 × 2) vale 4 serie; a una gamba le serie non raddoppiano
  assert.equal(quanto(riga({ serie: '4', cluster: '3', ripetizioni: '2', gambe: 'una' }), 'forza'), 4)
  assert.equal(quanto(riga({ ripetizioni: '45"' }), 'forza'), 0)
  // eccentrica in ripetizioni, isometria in secondi
  assert.equal(quanto(riga({ serie: '2', ripetizioni: '3', gambe: 'una' }), 'eccentrica'), 6)
  assert.equal(quanto(riga({ serie: '4', ripetizioni: '5"', cluster: '3' }), 'isometria'), 60)
  // tenute in secondi scritte nel carico
  assert.equal(quanto(riga({ serie: '3', ripetizioni: null, carico: '20', unita_carico: 'sec' }), 'isometria'), 60)
  assert.equal(quanto(riga({ serie: '3', ripetizioni: '4', carico: '80', unita_carico: 'kg' }), 'isometria'), 0)
})

test('Il conto: forza e ipertrofia per muscolo, il resto in tutto', () => {
  assert.deepEqual(
    contaRighe([
      riga({ categoria_id: 2, serie: '4' }),
      riga({ categoria_id: 2, serie: '3', obiettivo: 'ipertrofia' }),
      riga({ categoria_id: 3, serie: '2' }),
      riga({ tipo: 'plio_int', serie: '5', ripetizioni: '6' }),
      riga({ obiettivo: 'potenza', serie: '3' }),
      riga({ obiettivo: null }),
      riga({ tipo: null })
    ]),
    { 'forza:2': 4, 'ipertrofia:2': 3, 'forza:3': 2, plio_int: 30, potenza: 3 }
  )
})

const voce = (v: VoceModello['voce'], minimo: number | null, massimo: number | null, volte: number | null): VoceModello => ({
  voce: v,
  minimo,
  massimo,
  volte_min: volte,
  volte_max: volte,
  indicazione: null
})
const modello = (voci: VoceModello[], alternativa: 0 | 1 = 0): DoseModello => ({
  id: 1,
  nome: 'prova',
  ordine: 0,
  alternativa,
  voci
})
const testi = (m: DoseModello | null, conto: Record<string, number>, altre: Record<string, number>[] = []): string[] =>
  valutaSeduta(m, conto, altre).map((v) => `${v.voce} ${testoVoceSeduta(v)}`)

test('Si segnala solo cio\' che manca al minimo, compreso quello non ancora messo', () => {
  const m = modello([voce('plio_est', 80, 120, 2), voce('forza', 3, 5, 2), voce('eccentrica', 3, 5, 2), voce('ipertrofia', null, null, null)])
  assert.deepEqual(testi(m, {}), ['plio_est 0/80', 'forza 0/3', 'eccentrica 0/3'])
  assert.deepEqual(testi(m, { plio_est: 20, 'forza:1': 4, 'forza:2': 2, eccentrica: 4 }), [
    'plio_est 20/80',
    'forza 6 · −1',
    'eccentrica 4'
  ])
  // sopra la dose non succede niente; senza minimo si conta e basta
  assert.deepEqual(testi(m, { plio_est: 500, 'forza:1': 12, eccentrica: 9, 'ipertrofia:1': 1 }), [
    'plio_est 500',
    'forza 12',
    'ipertrofia 1',
    'eccentrica 9'
  ])
  // senza modello: solo i numeri
  assert.deepEqual(testi(null, { plio_est: 20 }), ['plio_est 20'])
})

test('La settimana: se le altre sedute hanno gia\' dato il minimo le volte chieste, niente segnale', () => {
  const m = modello([voce('plio_est', 80, 120, 2), voce('forza', 3, 5, 2)])
  const piena = { plio_est: 90, 'forza:1': 3 }
  // una sola seduta piena: non basta
  assert.deepEqual(testi(m, {}, [piena, { plio_est: 40 }]), ['plio_est 0/80', 'forza 0/3'])
  // due: le voci non fatte qui non compaiono nemmeno
  assert.deepEqual(testi(m, {}, [piena, piena]), [])
  // muscolo per muscolo: il quadricipite e' a posto, il gluteo no
  assert.deepEqual(testi(m, { plio_est: 90, 'forza:1': 1, 'forza:2': 1 }, [piena, piena]), ['plio_est 90', 'forza 2 · −2'])
})

test('Potenza e pliometria intensiva alternative: ne basta una', () => {
  const m = modello([voce('potenza', 3, 5, 2), voce('plio_int', 30, 40, 2)], 1)
  assert.deepEqual(testi(m, {}), ['potenza 0/3', 'plio_int 0/30'])
  assert.deepEqual(testi(m, { potenza: 3 }), ['potenza 3'])
  assert.deepEqual(testi(m, { plio_int: 30, potenza: 1 }), ['potenza 1', 'plio_int 30'])
  // una volta l'una e una volta l'altra fanno le due della settimana
  assert.deepEqual(testi(m, {}, [{ potenza: 4 }, { plio_int: 36 }]), [])
  // non alternative: si segnalano tutte e due
  assert.deepEqual(testi({ ...m, alternativa: 0 }, { potenza: 3 }), ['potenza 3', 'plio_int 0/30'])
})

test("Com'e' divisa la seduta: sulle serie, somma 100, cio' che non conta resta fuori", () => {
  const q = quoteLavoro([
    { tipo: 'plio_int', obiettivo: 'pliometria', serie: '5' },
    { tipo: 'plio_est', obiettivo: 'pliometria', serie: '5' },
    { tipo: 'rinforzo', obiettivo: 'forza', serie: '6' },
    { tipo: 'rinforzo', obiettivo: 'ipertrofia', serie: '3' },
    { tipo: 'non_conta', obiettivo: 'forza', serie: '10' },
    { tipo: 'rinforzo', obiettivo: null, serie: '10' }
  ])
  assert.deepEqual(q.map((x) => [x.voce, x.percento]), [['plio_int', 26], ['plio_est', 26], ['forza', 32], ['ipertrofia', 16]])
  assert.deepEqual(quoteLavoro([]), [])
  assert.equal(intervalloTesto(3, null), 'almeno 3')
  assert.equal(intervalloTesto(null, 40), 'al massimo 40')
  assert.equal(intervalloTesto(80, 120), '80–120')
  assert.equal(intervalloTesto(60, 60), '60')
})

test('La settimana va dal lunedi\' alla domenica', () => {
  assert.deepEqual(settimanaDi('2026-11-04'), ['2026-11-02', '2026-11-08']) // mercoledi'
  assert.deepEqual(settimanaDi('2026-11-08'), ['2026-11-02', '2026-11-08']) // domenica
  assert.deepEqual(settimanaDi('2026-12-31'), ['2026-12-28', '2027-01-03'])
})

test('Il nome sulla scheda: "Squat monopodalico" solo se segnato', () => {
  assert.equal(nomeConMonopodalico('Squat', 1), 'Squat monopodalico')
  assert.equal(nomeConMonopodalico('Squat', 0), 'Squat')
})

const ins = (sql: string, ...a: unknown[]): number => Number(getDb().prepare(sql).run(...a).lastInsertRowid)

test('I modelli: i tre pronti, si cambiano, la fase ne sceglie uno', () => {
  assert.deepEqual(
    elencoModelli().map((m) => [m.nome, m.alternativa, m.voci.length]),
    [
      ['RTP 1', 0, 4],
      ['RTP 2', 0, 4],
      ['Preparazione atletica', 1, 4]
    ]
  )
  const pat = ins("INSERT INTO patologie (nome) VALUES ('LCA modelli')")
  const fase = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'Fase uno', 0)", pat)
  assert.equal(modelloDiFase(fase), null)
  const mio = creaModello('Mantenimento')
  salvaModello(mio, {
    nome: 'Mantenimento',
    alternativa: 0,
    voci: [voce('forza', 2, null, 1), voce('potenza', null, null, null)]
  })
  impostaModelloFase(fase, mio)
  assert.deepEqual(modelloDiFase(fase)?.voci.map((v) => [v.voce, v.minimo]), [['forza', 2]], 'una voce vuota non resta')
  assert.equal(fasiConModello().find((f) => f.id === fase)?.dose_modello_id, mio)
  assert.throws(() => salvaModello(mio, { nome: 'x', alternativa: 0, voci: [voce('forza', 5, 3, 1)] }), /più alto/)
  assert.throws(() => salvaModello(mio, { nome: 'x', alternativa: 0, voci: [voce('forza', 2.5, null, 1)] }), /intero/)
  assert.throws(() => salvaModello(mio, { nome: ' ', alternativa: 0, voci: [] }), /nome/)
  assert.equal(modelloDiFase(fase)?.nome, 'Mantenimento', 'un errore non cambia niente')
  // eliminato, la fase resta senza; dal cestino torna anche il collegamento
  eliminaModello(mio)
  assert.equal(modelloDiFase(fase), null)
  ripristina(elencoCestino().find((v) => v.etichetta === 'Mantenimento')!.id)
  assert.equal(modelloDiFase(fase)?.nome, 'Mantenimento')
})

test('Le sezioni della libreria: si spuntano nella fase, e eliminandole la fase non perde niente', () => {
  const pat = ins("INSERT INTO patologie (nome) VALUES ('LCA sezioni')")
  const fase = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'Fase sezioni', 0)", pat)
  const cat = ins("INSERT INTO categorie (nome) VALUES ('Quadricipite sezioni')")
  assert.ok(elencoSezioniLibreria().some((s) => s.nome === 'Forza' && s.obiettivo === 'forza'))
  const mia = creaSezioneLibreria('Rinforzo mio')
  assert.throws(() => creaSezioneLibreria('rinforzo MIO'), /già/)
  impostaCategorieLibreria(mia, [cat])
  usaSezioneDiLibreria(fase, mia, true)
  usaSezioneDiLibreria(fase, mia, true)
  const propria = creaSezione(fase, 'Solo qui')
  impostaObiettivoSezione(propria, 'ipertrofia')
  rinominaSezioneLibreria(mia, 'Rinforzo gamba')
  const letta = (): [string, number | null, string | null, number[]][] =>
    elencoSezioni(fase).map((s) => [s.nome, s.libreria_id, s.obiettivo, s.categoria_ids])
  assert.deepEqual(letta(), [
    ['Rinforzo gamba', mia, 'forza', [cat]],
    ['Solo qui', null, 'ipertrofia', []]
  ])
  assert.deepEqual(elencoSezioniLibreria().find((s) => s.id === mia)?.usata_in, ['LCA sezioni — Fase sezioni'])
  eliminaSezioneLibreria(mia)
  assert.deepEqual(letta()[0], ['Rinforzo gamba', null, 'forza', [cat]])
  ripristina(elencoCestino().find((v) => v.etichetta === 'Rinforzo gamba')!.id)
  assert.deepEqual(letta()[0], ['Rinforzo gamba', mia, 'forza', [cat]])
  usaSezioneDiLibreria(fase, mia, false)
  assert.deepEqual(letta().map((s) => s[0]), ['Solo qui'])
})

test('La seduta fotografa tipo, eccezione e obiettivo; la settimana conta le altre sedute', () => {
  const pat = ins("INSERT INTO patologie (nome) VALUES ('LCA seduta')")
  const fase = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'RTP', 0)", pat)
  const faseCampo = ins("INSERT INTO fasi (patologia_id, nome, ordine, campo) VALUES (?, 'Campo', 1, 1)", pat)
  const quad = ins("INSERT INTO categorie (nome) VALUES ('Quadricipite seduta')")
  const base = {
    serie_default: null,
    cluster_default: null,
    ripetizioni_default: null,
    rir_default: null,
    carico_default: null,
    unita_carico: null,
    recupero_cluster_default: null,
    recupero_default: null,
    nota_tecnica: null,
    link: null
  }
  const legExt = creaEsercizio({ ...base, nome: 'Leg extension seduta', categoria_id: quad })
  const hop = creaEsercizio({ ...base, nome: 'Hop seduta', categoria_id: quad, gambe: 'una', tipo: 'plio_est' })
  const tipoDi = (id: number): unknown => (elencoEsercizi(false) as { id: number; tipo: unknown }[]).find((e) => e.id === id)?.tipo
  assert.equal(tipoDi(legExt), null, 'un esercizio nuovo senza tipo e\' da sistemare')

  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Dose', 'Prova')")
  impostaSeduteSettimana(pz, 3)
  assert.throws(() => impostaSeduteSettimana(pz, 0), /da 1 a 14/)

  const es = (esercizio_id: number, serie: string, ripetizioni: string, altro: Partial<SedutaInput['esercizi'][number]> = {}) => ({
    esercizio_id,
    nome_libero: null,
    serie,
    cluster: null,
    ripetizioni,
    rir: null,
    carico: null,
    recupero_cluster: null,
    recupero: null,
    nota: null,
    sezioneIndex: 0,
    ...altro
  })
  const seduta = (data: string, faseId: number, esercizi: SedutaInput['esercizi']): number =>
    creaSeduta({
      paziente_id: pz,
      data,
      ora: null,
      fase_id: faseId,
      focus: null,
      dolore: null,
      sforzo: null,
      segni: [],
      riferito_andamento: null,
      riferito: null,
      tecnica_ids: [],
      trattamento: null,
      note: null,
      sezioni: [{ sezione_id: null, nome: 'Forza', obiettivo: 'forza' }],
      esercizi
    })
  const lun = seduta('2026-11-02', fase, [es(legExt, '3', '10'), es(hop, '3', '10'), es(legExt, '2', '8', { conta: 'ipertrofia' })])
  seduta('2026-11-04', faseCampo, [es(legExt, '4', '8')])
  seduta('2026-11-09', fase, [es(legExt, '4', '8')])

  // senza tipo il leg extension non conta; sistemandolo, conta anche prima
  assert.deepEqual(doseSettimana(pz, '2026-11-06', null), { altre: [{ plio_est: 60, [`ipertrofia:${quad}`]: 2 }] })
  impostaTipo(legExt, 'rinforzo')
  assert.deepEqual(doseSettimana(pz, '2026-11-06', null), {
    altre: [{ [`forza:${quad}`]: 3, plio_est: 60, [`ipertrofia:${quad}`]: 2 }]
  })
  assert.deepEqual(doseSettimana(pz, '2026-11-02', lun), { altre: [] })

  // il tipo scritto sulla riga resta anche se la libreria cambia
  impostaTipo(hop, 'non_conta')
  const letta = leggiSeduta(lun)
  assert.equal(letta.sezioni[0].obiettivo, 'forza')
  assert.deepEqual(letta.sezioni[0].esercizi.map((e) => [e.tipo, e.conta]), [
    ['rinforzo', null],
    ['plio_est', null],
    ['rinforzo', 'ipertrofia']
  ])
  assert.equal(
    elencoSedute(pz).find((s) => s.id === lun)?.carico,
    '60 contatti · 3 serie di forza · 2 serie di ipertrofia'
  )
  const [copia] = programmaSeduta(lun, ['2026-11-13'])
  const copiata = leggiSeduta(copia).sezioni[0]
  assert.equal(copiata.obiettivo, 'forza')
  assert.equal(copiata.esercizi[2].conta, 'ipertrofia')
  assert.equal(copiata.esercizi[1].tipo, 'plio_est')

  assert.throws(() => seduta('2026-11-20', fase, [es(legExt, '1', '1', { conta: 'corsa' as never })]), /non è valido/)

  // il monopodalico, l'ultima volta e la scheda: della dose sulla scheda niente
  const mono = seduta('2026-11-16', fase, [es(hop, '2', '15', { monopodalico: 1 })])
  assert.equal(leggiSeduta(mono).sezioni[0].esercizi[0].monopodalico, 1)
  assert.equal(ultimaVoltaPerPaziente(pz, null, '2026-11-17').find((u) => u.esercizio_id === hop)?.monopodalico, 1)
  const scheda = JSON.stringify(datiScheda(lun))
  assert.ok(!/"(tipo|conta|obiettivo)"/.test(scheda))
})

test('il colore della dose: verde raggiunta, arancione da metà, rosso sotto', () => {
  assert.deepEqual([80, 40, 39, 0].map((n) => livelloDose(n, 80)), ['raggiunta', 'vicina', 'lontana', 'lontana'])
  assert.equal(livelloDose(10, null), null)
})
