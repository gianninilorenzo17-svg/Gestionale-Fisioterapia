// Il Quadro del paziente (panoramica) e gli elenchi a sinistra di Clinica e
// Percorso: cosa compare, cosa no, e dove porta un clic. Le fotografie restano
// in e2e-risultati/schermate per guardarle.
import { test, expect } from '@playwright/test'
import { join, resolve } from 'node:path'
import { avvia, creaArchivio, FOTO, nuovoPaziente, vaiA } from './app'

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const giorniFa = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return iso(d)
}

// La finestra scorre dentro se stessa, quindi una fotografia normale taglia la
// parte bassa: se ne fanno due, in cima e in fondo.
async function fotoIntera(pagina: import('@playwright/test').Page, nome: string): Promise<void> {
  await pagina.screenshot({ path: join(FOTO, nome) })
  const scorre = await pagina.evaluate(() => {
    const el = document.querySelector('main') as HTMLElement | null
    if (!el || el.scrollHeight <= el.clientHeight) return false
    el.scrollTo(0, el.scrollHeight)
    return true
  })
  if (!scorre) return
  await pagina.waitForTimeout(200)
  await pagina.screenshot({ path: join(FOTO, nome.replace('.png', '-fondo.png')) })
  await pagina.evaluate(() => (document.querySelector('main') as HTMLElement).scrollTo(0, 0))
}

test('quadro: panoramica del percorso, numeri solo se ci sono, un clic porta alla parte giusta', async () => {
  const prova = await avvia()
  try {
    const { pagina, app } = prova
    await creaArchivio(pagina)

    // Un paziente con tutto: percorso a fasi, sedute, un questionario fatto due
    // volte, un promemoria scaduto e i test con la pedana.
    await nuovoPaziente(pagina, { nome: 'Marco', cognome: 'Rossi', diagnosi: 'Lesione LCA ginocchio destro' })
    await pagina.evaluate(
      async ({ date }) => {
        const api = window.api
        const pazienti = await api.pazienti.list()
        const pz = pazienti.find((p) => p.cognome === 'Rossi')!.id
        const pat = await api.patologie.create('Ricostruzione LCA')
        const f1 = await api.fasi.create(pat, 'Iniziale')
        const f2 = await api.fasi.create(pat, 'Intermedia')
        await api.fasi.create(pat, 'Avanzata')
        const ob1 = await api.obiettivi.create(f2, 'ROM completo')
        await api.obiettivi.create(f2, 'Squat monopodalico controllato')
        await api.pazienti.setPatologiaFase(pz, pat, f2)
        await api.pazienti.setObiettivoRaggiunto(pz, ob1, true)
        await api.pazienti.setSeduteSettimana(pz, 3)

        const cat = await api.categorie.create('Rinforzo')
        const ese = await api.esercizi.create({
          nome: 'Leg extension',
          categoria_id: cat,
          serie_default: null,
          cluster_default: null,
          ripetizioni_default: null,
          rir_default: null,
          carico_default: null,
          unita_carico: null,
          recupero_cluster_default: null,
          recupero_default: null,
          nota_tecnica: null,
          link: null,
          gambe: 'due'
        })
        const riga = {
          esercizio_id: ese,
          nome_libero: null,
          serie: '3',
          cluster: null,
          ripetizioni: '10',
          rir: null,
          carico: null,
          recupero_cluster: null,
          recupero: null,
          nota: null,
          monopodalico: 0 as const,
          sezioneIndex: 0
        }
        for (const [i, d] of date.entries()) {
          await api.sedute.create({
            paziente_id: pz,
            data: d,
            ora: null,
            fase_id: i < 2 ? f1 : f2,
            focus: i % 2 ? 'Forza' : 'Pliometria',
            dolore: [6, 5, 4, 3, 2][i] ?? 2,
            sforzo: 6,
            segni: [],
            riferito_andamento: null,
            riferito: 'Meglio, un po rigido al mattino',
            tecnica_ids: [],
            trattamento: 'Terapia manuale',
            note: 'Bene il lavoro eccentrico, leggero fastidio dopo i salti.',
            sezioni: [{ sezione_id: null, nome: 'Esercizi' }],
            esercizi: [riga]
          })
        }

        const cq = await api.questionariCategorie.create('Prova ginocchio')
        const qid = await api.questionari.create('KOOS', cq)
        const q = await api.questionari.get(qid)
        await api.questionari.salva({
          ...q,
          domande: [1, 2].map((n) => ({
            id: -n,
            testo: `Domanda ${n}`,
            tipo: 'scala' as const,
            scala_min: 0,
            scala_max: 100,
            etichetta_min: null,
            etichetta_max: null,
            opzioni: []
          })),
          punteggi: [{ id: -101, nome: 'Totale', tipo: 'somma', domanda_ids: [-1, -2] }]
        })
        const qq = await api.questionari.get(qid)
        const dom = qq.domande.map((d) => d.id as number)
        for (const [dataC, v] of [
          [date[0], 40],
          [date[4], 60]
        ] as const) {
          await api.compilazioni.create({
            paziente_id: pz,
            questionario_id: qid,
            data: dataC,
            note: null,
            risposte: dom.map((id) => ({ domanda_id: id, valore: v }))
          })
        }
        await api.promemoria.create({
          paziente_id: pz,
          tipo: 'questionario',
          riferimento_id: qid,
          scadenza: date[2],
          nota: null
        })
      },
      { date: [giorniFa(28), giorniFa(21), giorniFa(14), giorniFa(7), giorniFa(2)] }
    )

    // la pedana: si importa il file di esempio come fa la prova della pedana
    const file = resolve(__dirname, '..', 'docs', 'esempio.pedana.json')
    await app.evaluate(({ dialog }, percorso) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [percorso] })
    }, file)
    await vaiA(pagina, 'Pazienti')
    await pagina.locator('main').getByText('Rossi Marco', { exact: true }).click()
    await pagina.getByRole('button', { name: /^Pedana/ }).click()
    await pagina.getByRole('button', { name: 'Importa', exact: true }).click()
    await pagina.getByRole('button', { name: /^Importa \(/ }).click()
    await expect(pagina.locator('.elenco-pedana .riga-pedana').first()).toBeVisible()

    // ---- il Quadro ----
    await pagina.getByRole('button', { name: /^Quadro/ }).click()
    const quadro = pagina.locator('.quadro')
    await expect(quadro.locator('.q-fase')).toHaveCount(3)
    await expect(quadro.locator('.q-fase.ora')).toContainText('Intermedia')
    await expect(quadro.locator('.q-fase.fatta')).toContainText('Iniziale')
    await expect(quadro.locator('.q-obiettivi')).toContainText('1/2')
    await expect(quadro).toContainText('Ultima seduta')
    await expect(quadro).toContainText('Bene il lavoro eccentrico')
    await expect(quadro).toContainText('Leg extension')
    await expect(quadro).toContainText('Questa settimana')
    // dolore: l'ultimo e' 2, partiva da 6
    const numeri = quadro.locator('.q-numeri')
    await expect(numeri.locator('.q-vai').filter({ hasText: 'Dolore' })).toContainText('2/10')
    await expect(numeri.locator('.q-vai').filter({ hasText: 'Dolore' })).toContainText('da 6 all\'inizio')
    // il questionario: 120 ultimo (somma), +40 dalla prima compilazione
    const koos = numeri.locator('.q-vai').filter({ has: pagina.locator('.q-titoletto', { hasText: /^KOOS$/ }) })
    await expect(koos).toContainText('+40 dal')
    await expect(numeri.locator('.q-vai').filter({ hasText: 'LSI più basso' })).toBeVisible()
    await expect(numeri.locator('.q-vai').filter({ hasText: 'Promemoria' })).toContainText('scaduto')
    await fotoIntera(pagina, '70-quadro.png')

    // un clic sul riquadro del questionario porta ai Questionari, nella Clinica
    await koos.click()
    await expect(pagina.locator('.config-tabs button.active')).toContainText('Clinica')
    await expect(pagina.locator('.voce-indice.attiva:visible')).toContainText('Questionari')
    await fotoIntera(pagina, '71-clinica-indice.png')
    // l'elenco racconta cosa c'e' dentro; le voci vuote stanno in fondo
    const indice = pagina.locator('.indice-sezioni:visible')
    await expect(indice.locator('.voce-indice').filter({ hasText: 'Questionari' })).toContainText('2')
    await expect(indice.locator('.voce-indice').filter({ hasText: 'Promemoria' })).toContainText('scaduto')
    await expect(indice.locator('.voce-indice.vuota').filter({ hasText: 'Body chart' })).toBeVisible()
    // cambiando parte si cambia il contenuto
    await indice.locator('.voce-indice').filter({ hasText: 'Body chart' }).click()
    await expect(pagina.getByRole('heading', { name: 'Body chart' })).toBeVisible()

    // ---- il Diario: una riga per seduta, divise per mese, con il cambio di fase ----
    await pagina.keyboard.press('2')
    await expect(pagina.locator('.config-tabs button.active')).toContainText('Diario')
    const righe = pagina.locator('.d-riga')
    await expect(righe).toHaveCount(5)
    await expect(pagina.locator('.d-cambio')).toContainText('Passaggio a Intermedia')
    await expect(righe.first()).toContainText('Intermedia')
    await expect(righe.first()).toContainText('Bene il lavoro eccentrico')
    await expect(righe.first().locator('.d-dolore')).toContainText('2/10')
    // i pulsanti ci sono ma si vedono solo passandoci sopra
    const azioni = righe.first().locator('.row-actions')
    await pagina.mouse.move(0, 0)
    await expect(azioni).toHaveCSS('opacity', '0')
    await righe.first().hover()
    await expect(azioni).toHaveCSS('opacity', '1')
    await fotoIntera(pagina, '74-diario.png')

    // ---- la Pedana: in cima il riassunto con l'LSI ----
    await pagina.keyboard.press('4')
    await expect(pagina.locator('.riepilogo-pedana')).toContainText('LSI più basso')
    await fotoIntera(pagina, '75-pedana.png')

    // i tasti 1-5 cambiano linguetta; 1 riporta al Quadro
    await pagina.keyboard.press('5')
    await expect(pagina.locator('.config-tabs button.active')).toContainText('Percorso')
    await fotoIntera(pagina, '72-percorso-indice.png')
    await expect(pagina.locator('.voce-indice:visible').filter({ hasText: 'Obiettivi della fase' })).toContainText('1 di 2')
    await pagina.keyboard.press('1')
    await expect(pagina.locator('.config-tabs button.active')).toContainText('Quadro')

    // i tasti non rubano le lettere a chi scrive: dentro una casella il 3 e' un 3
    await pagina.getByRole('button', { name: /^Percorso/ }).click()
    const sedute = pagina.getByLabel('Sedute a settimana')
    await sedute.click()
    await pagina.keyboard.press('3')
    await expect(pagina.locator('.config-tabs button.active')).toContainText('Percorso')
    await expect(sedute).toHaveValue('33')
    await sedute.fill('3')
    await sedute.blur()

    // ---- un paziente nuovo: niente numeri, niente riquadri vuoti ----
    await nuovoPaziente(pagina, { nome: 'Giulia', cognome: 'Bianchi' })
    await pagina.getByRole('button', { name: /^Quadro/ }).click()
    await expect(pagina.locator('.quadro')).toContainText('Nessun percorso impostato')
    await expect(pagina.locator('.quadro')).toContainText('Ancora nessuna seduta')
    await expect(pagina.locator('.q-numeri')).toHaveCount(0)
    await fotoIntera(pagina, '73-quadro-vuoto.png')

    expect(prova.errori, 'errori nella console').toEqual([])
  } catch (e) {
    await prova.pagina.screenshot({ path: join(FOTO, 'errore-quadro.png') }).catch(() => {})
    await prova.app.close().catch(() => {})
    throw e
  }
  await prova.chiudi()
})
