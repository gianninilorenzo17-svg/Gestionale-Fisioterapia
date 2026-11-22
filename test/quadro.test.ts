// I conti del Quadro del paziente (shared/quadro.ts): LSI piu' basso, da quando
// e' in fase, la settimana, il dolore, l'ultimo questionario, i promemoria.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  classeLsi,
  inFaseDal,
  lsiPiuBasso,
  lunediDi,
  promemoriaInVista,
  settimanaCorrente,
  sintesiDolore,
  ultimoQuestionario
} from '../src/shared/quadro'
import type { GruppoPedana } from '../src/shared/pedana'
import type { CompilazioneRiepilogo, Promemoria } from '../src/shared/types'

const gruppo = (nome: string, perLato: boolean, lsi: (number | null)[]): GruppoPedana =>
  ({
    chiave: nome,
    codice: nome,
    nome,
    famiglia: 'forza',
    misura: { codice: 'm', nome: 'm', unita: null, meglio: 'alto' },
    perLato,
    latoInteressato: 'dx',
    giorni: lsi.map((v, i) => ({
      data: `2026-11-${String(12 - i).padStart(2, '0')}`,
      dataFine: null,
      dx: null,
      sx: null,
      unico: null,
      lsi: v,
      asimmetria: null,
      avvertenze: [],
      test: []
    })),
    frase: null,
    variazione: null
  }) as GruppoPedana

test('classi dell\'LSI: 90 e 80 sono i confini', () => {
  assert.equal(classeLsi(90), 'ok')
  assert.equal(classeLsi(89), 'att')
  assert.equal(classeLsi(80), 'att')
  assert.equal(classeLsi(79), 'no')
})

test('LSI piu\' basso: guarda l\'ultimo valore di ogni test e salta chi non confronta i lati', () => {
  const r = lsiPiuBasso([
    gruppo('Salto', true, [78.4, 60]), // l'ultimo e' il primo della lista: 78
    gruppo('Forza', true, [85, 70]),
    gruppo('Stabilita', false, [10]), // niente confronto fra i lati
    gruppo('Hop', true, [null, 92]) // la riga piu' recente senza LSI si salta: vale 92
  ])
  assert.equal(r?.valore, 78)
  assert.equal(r?.test, 'Salto')
  assert.equal(r?.altri, 2)
  assert.equal(r?.minimoAltri, 85)
  assert.equal(r?.massimoAltri, 92)
  assert.equal(lsiPiuBasso([gruppo('Stabilita', false, [10])]), null)
  assert.equal(lsiPiuBasso([]), null)
})

test('il lunedi\' della settimana', () => {
  assert.equal(lunediDi('2026-11-22'), '2026-11-16') // domenica
  assert.equal(lunediDi('2026-11-16'), '2026-11-16') // lunedi'
  assert.equal(lunediDi('2026-11-18'), '2026-11-16')
})

test('in fase dal: l\'ultimo tratto di sedute nella fase di adesso', () => {
  const sedute = [
    { data: '2026-10-20', fase_nome: 'Iniziale' },
    { data: '2026-10-27', fase_nome: 'Iniziale' },
    { data: '2026-11-03', fase_nome: 'Intermedia' },
    { data: '2026-11-10', fase_nome: 'Intermedia' },
    { data: '2026-11-30', fase_nome: 'Intermedia' } // ancora da fare
  ]
  assert.equal(inFaseDal(sedute, 'Intermedia', '2026-11-22'), '2026-11-03')
  // tornata indietro e poi di nuovo avanti: conta solo l'ultimo tratto
  assert.equal(
    inFaseDal(
      [{ data: '2026-10-01', fase_nome: 'B' }, { data: '2026-10-10', fase_nome: 'A' }, { data: '2026-10-20', fase_nome: 'B' }],
      'B',
      '2026-11-22'
    ),
    '2026-10-20'
  )
  assert.equal(inFaseDal(sedute, 'Avanzata', '2026-11-22'), null)
  assert.equal(inFaseDal(sedute, null, '2026-11-22'), null)
})

test('la settimana: da lunedi\' a oggi, e quante ne fa', () => {
  const sedute = [
    { data: '2026-11-13', fase_nome: null },
    { data: '2026-11-17', fase_nome: null },
    { data: '2026-11-20', fase_nome: null },
    { data: '2026-11-25', fase_nome: null } // programmata
  ]
  assert.deepEqual(settimanaCorrente(sedute, '2026-11-22', 3), { fatte: 2, previste: 3 })
  assert.deepEqual(settimanaCorrente(sedute, '2026-11-22', null), { fatte: 2, previste: null })
})

test('dolore: primo, ultimo, differenza, con i punti in disordine', () => {
  const s = sintesiDolore([
    { data: '2026-11-19', dolore: 2, origine: 'seduta' },
    { data: '2026-09-02', dolore: 7, origine: 'anamnesi' },
    { data: '2026-10-15', dolore: 5, origine: 'seduta' }
  ])
  assert.equal(s?.primo, 7)
  assert.equal(s?.ultimo, 2)
  assert.equal(s?.differenza, -5)
  assert.deepEqual(s?.serie.map((p) => p.dolore), [7, 5, 2])
  assert.equal(sintesiDolore([]), null)
})

const compilazione = (over: Partial<CompilazioneRiepilogo>): CompilazioneRiepilogo => ({
  id: 1,
  data: '2026-11-16',
  questionario_id: 1,
  questionario_nome: 'KOOS',
  fascia: null,
  note: null,
  punteggi: [{ nome: 'Totale', valore: 68 }],
  variazione: null,
  daRicalcolare: false,
  ...over
})

test("ultimo questionario: il più recente, con la differenza dalla prima compilazione", () => {
  const r = ultimoQuestionario([
    compilazione({ id: 1, data: '2026-10-12', punteggi: [{ nome: 'Totale', valore: 56 }] }),
    compilazione({
      id: 2,
      punteggi: [
        { nome: 'Dolore', valore: 70 },
        { nome: 'Totale', valore: 68 }
      ],
      variazione: { punteggio_nome: 'Totale', punti: 12, percentuale: 21, significativa: true, dal: '2026-10-12' }
    })
  ])
  assert.equal(r?.data, '2026-11-16')
  assert.equal(r?.valore, 68)
  assert.deepEqual(r?.cambio, { differenza: 12, dal: '2026-10-12', migliora: true })
  assert.equal(ultimoQuestionario([]), null)
})

test("ultimo questionario: se meglio vuol dire meno, il numero scende ma migliora è vero", () => {
  // un questionario di disabilita': 68 -> 56 e' un miglioramento (la variazione e' gia' girata)
  const r = ultimoQuestionario([
    compilazione({ id: 1, data: '2026-10-12', punteggi: [{ nome: 'Totale', valore: 68 }] }),
    compilazione({
      id: 2,
      punteggi: [{ nome: 'Totale', valore: 56 }],
      variazione: { punteggio_nome: 'Totale', punti: 12, percentuale: 17, significativa: true, dal: '2026-10-12' }
    })
  ])
  assert.deepEqual(r?.cambio, { differenza: -12, dal: '2026-10-12', migliora: true })
})

test("ultimo questionario: senza il cambiamento minimo configurato la differenza c'è ma non si giudica", () => {
  const r = ultimoQuestionario([
    compilazione({ id: 1, data: '2026-10-12', punteggi: [{ nome: 'Totale', valore: 56 }] }),
    compilazione({ id: 2, data: '2026-10-30', punteggi: [{ nome: 'Totale', valore: 60 }] }),
    compilazione({ id: 3, punteggi: [{ nome: 'Totale', valore: 68 }] })
  ])
  // dalla PRIMA compilazione, non dalla precedente
  assert.deepEqual(r?.cambio, { differenza: 12, dal: '2026-10-12', migliora: null })
})

test('ultimo questionario: una compilazione sola, o questionari diversi, non hanno un cambio', () => {
  assert.equal(ultimoQuestionario([compilazione({})])?.cambio, null)
  const r = ultimoQuestionario([
    compilazione({ id: 1, data: '2026-10-12', questionario_id: 9, punteggi: [{ nome: 'Totale', valore: 10 }] }),
    compilazione({ id: 2 })
  ])
  assert.equal(r?.cambio, null)
})

const promemoria = (id: number, scadenza: string, fatto: string | null = null): Promemoria => ({
  id,
  paziente_id: 1,
  paziente_nome: 'M',
  paziente_cognome: 'R',
  tipo: 'questionario',
  questionario_id: 1,
  protocollo_id: null,
  pedana_chiave: null,
  riferimento_nome: 'IKDC',
  scadenza,
  nota: null,
  fatto_il: fatto
})

test('promemoria: i fatti non contano, il piu\' vecchio scaduto viene prima', () => {
  const r = promemoriaInVista(
    [promemoria(1, '2026-11-20'), promemoria(2, '2026-11-18'), promemoria(3, '2026-12-01'), promemoria(4, '2026-11-01', '2026-11-02')],
    '2026-11-22'
  )
  assert.equal(r.aperti, 3)
  assert.equal(r.scaduti, 2)
  assert.equal(r.primo?.id, 2)
  assert.equal(r.giorniScaduto, 4)
  const nessuno = promemoriaInVista([promemoria(1, '2026-12-01')], '2026-11-22')
  assert.equal(nessuno.scaduti, 0)
  assert.equal(nessuno.giorniScaduto, null)
})
