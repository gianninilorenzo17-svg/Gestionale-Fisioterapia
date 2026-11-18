// Il promemoria "scrivere al paziente": non rimanda a nessun questionario,
// screening o test, e compare fra i promemoria come tutti gli altri.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { creaPaziente } from '../src/main/pazienti'
import type { PazienteCreateInput } from '../src/shared/types'
import {
  contaInScadenza,
  creaPromemoria,
  elencoPromemoria,
  segnaFatto
} from '../src/main/promemoria'

archivioDiProva()

function paziente(nome: string, cognome: string): number {
  return creaPaziente({
    nome,
    cognome,
    data_nascita: null,
    codice_fiscale: null,
    telefono: null,
    email: null,
    lavoro: null,
    inviato_da: null,
    sport: null,
    diagnosi: null,
    tipo_intervento: null,
    data_intervento: null,
    precauzioni: null,
    arto_operato: null,
    patologia_id: null,
    fase_corrente_id: null,
    gruppo_id: null
  } as PazienteCreateInput)
}

test('Il promemoria di contatto si crea senza riferimenti e si conta alla scadenza', () => {
  const p = paziente('Anna', 'Rossi')
  const id = creaPromemoria({
    paziente_id: p,
    tipo: 'contatto',
    riferimento_id: 0,
    scadenza: '2000-01-01',
    nota: ' come va il ginocchio '
  })
  const m = elencoPromemoria(p).find((x) => x.id === id)
  assert.ok(m)
  assert.equal(m.tipo, 'contatto')
  assert.equal(m.nota, 'come va il ginocchio')
  assert.equal(m.questionario_id, null)
  assert.equal(contaInScadenza(), 1)
  assert.equal(elencoPromemoria(null).length, 1)
  segnaFatto(id, true)
  assert.equal(contaInScadenza(), 0)
})

test('La data del promemoria di contatto e\' obbligatoria', () => {
  const p = paziente('Luca', 'Bianchi')
  assert.throws(() =>
    creaPromemoria({ paziente_id: p, tipo: 'contatto', riferimento_id: 0, scadenza: '', nota: null })
  )
})
