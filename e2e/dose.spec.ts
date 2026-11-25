// La dose gesto per gesto: il tipo dell'esercizio ("Da sistemare"), le sezioni
// della libreria spuntate nella fase, il modello di dose, e in seduta una riga
// sola con i numeri: verde, arancione o rosso secondo quanto manca. La barretta sulla riga per
// le eccezioni. Il bottoncino Bipodalico/Monopodalico c'e' solo sugli esercizi
// a scelta.
import { test, expect, type Page } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

async function prepara(pagina: Page): Promise<void> {
  await pagina.evaluate(async () => {
    const api = window.api
    const rinforzo = await api.categorie.create('Rinforzo')
    const quad = await api.categorie.create('Quadricipite')
    await api.categorie.setPadre(quad, rinforzo)
    const glut = await api.categorie.create('Gluteo')
    await api.categorie.setPadre(glut, rinforzo)
    const plio = await api.categorie.create('Pliometria')
    const esercizio = (
      nome: string,
      categoria_id: number,
      serie: string,
      rip: string,
      gambe: 'due' | 'scelta' | 'una',
      tipo: 'rinforzo' | 'plio_est' | null
    ) =>
      api.esercizi.create({
        nome,
        categoria_id,
        serie_default: serie,
        cluster_default: null,
        ripetizioni_default: rip,
        rir_default: null,
        carico_default: null,
        unita_carico: null,
        recupero_cluster_default: null,
        recupero_default: null,
        nota_tecnica: null,
        link: null,
        gambe,
        tipo
      })
    await esercizio('Leg extension', quad, '3', '8', 'due', 'rinforzo')
    await esercizio('Hip thrust', glut, '2', '8', 'due', 'rinforzo')
    await esercizio('Single leg hop', plio, '3', '10', 'una', 'plio_est')
    await esercizio('Broad jump', plio, '2', '15', 'scelta', null)

    // le sezioni della libreria con le loro categorie
    const libreria = await api.sezioniLibreria.list()
    const idDi = (nome: string): number => libreria.find((l) => l.nome === nome)!.id
    await api.sezioniLibreria.setCategorie(idDi('Pliometria estensiva'), [plio])
    await api.sezioniLibreria.setCategorie(idDi('Forza'), [rinforzo])

    const pat = await api.patologie.create('LCA')
    const fase = await api.fasi.create(pat, 'Ritorno al campo')
    await api.pazienti.create({
      nome: 'Luca',
      cognome: 'Dose',
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
      gruppo_id: null,
      patologia_id: pat,
      fase_corrente_id: fase
    })
  })
}

async function apriPaziente(pagina: Page): Promise<void> {
  await vaiA(pagina, 'Pazienti')
  await expect(pagina.getByPlaceholder('Cerca paziente…')).toBeVisible()
  await pagina.locator('main').getByText('Dose Luca', { exact: true }).click()
  await expect(pagina.getByRole('heading', { name: 'Dose Luca' })).toBeVisible()
}

const riga = (pagina: Page, nome: string) => pagina.locator('.righe-seduta li', { hasText: nome })

test('dose: da sistemare, sezioni e modello della fase, la riga in seduta', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await prepara(pagina)

    // ---- l'esercizio senza tipo si sistema, e il pulsante sparisce
    await vaiA(pagina, 'Configurazione')
    await pagina.locator('.config-tabs-top').getByRole('button', { name: 'Libreria esercizi' }).click()
    await pagina.getByRole('button', { name: /Da sistemare/ }).click()
    await pagina.locator('.modal').screenshot({ path: join(FOTO, '40-dose-da-sistemare.png') })
    await pagina.locator('.modal').getByTitle('Tipo di Broad jump').click()
    await pagina.locator('.menu-scelta-popup').getByRole('button', { name: 'Pliometria estensiva' }).click()
    await pagina.locator('.modal').getByRole('button', { name: 'Chiudi' }).click()
    await expect(pagina.getByRole('button', { name: /Da sistemare/ })).toHaveCount(0)

    // ---- la fase spunta le sezioni della libreria
    await pagina.locator('.config-tabs-top').getByRole('button', { name: 'Patologie e fasi' }).click()
    await pagina.getByText('LCA', { exact: true }).first().click()
    await pagina.getByText('Ritorno al campo', { exact: true }).first().click()
    await pagina.locator('.sezioni-da-libreria').getByText('Pliometria estensiva', { exact: true }).click()
    await expect(pagina.getByTitle('Togli dalla fase')).toHaveCount(1)
    await pagina.locator('.sezioni-da-libreria').getByText('Forza', { exact: true }).click()
    await expect(pagina.getByTitle('Togli dalla fase')).toHaveCount(2)
    await pagina.screenshot({ path: join(FOTO, '41-dose-sezioni-fase.png'), fullPage: true })

    // ---- e il modello si assegna da Libreria → Dosi
    await pagina.locator('.config-tabs-top').getByRole('button', { name: 'Libreria esercizi' }).click()
    await pagina.getByRole('button', { name: 'Dosi', exact: true }).click()
    await expect(pagina.getByLabel('Pliometria estensiva, per seduta da')).toHaveValue('80')
    await pagina.getByTitle('Modello di LCA, Ritorno al campo').click()
    await pagina.locator('.menu-scelta-popup').getByRole('button', { name: 'RTP 2' }).click()
    await expect(pagina.getByTitle('Modello di LCA, Ritorno al campo')).toContainText('RTP 2')
    await pagina.screenshot({ path: join(FOTO, '42-dose-modelli.png'), fullPage: true })

    // ---- in seduta: una riga sola, colorata secondo quanto manca
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
    const dose = pagina.locator('.riga-dose')
    const voce = (v: string) => dose.locator(`.riga-dose-voce[data-voce="${v}"] b`)
    await expect(voce('plio_est')).toHaveText('0/80')
    await expect(voce('plio_est')).toHaveClass(/dose-lontana/)
    await expect(voce('forza')).toHaveText('0/3')

    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').nth(0).click()
    await pagina.getByTitle('Aggiungi Single leg hop').click()
    await pagina.getByTitle('Aggiungi Broad jump').click()
    await expect(riga(pagina, 'Single leg hop').locator('.btn-monopodalico')).toHaveCount(0)
    // single leg hop 3 × 10 a una gamba = 60, broad jump 2 × 15 = 30
    await expect(voce('plio_est')).toHaveText('90')
    await expect(voce('plio_est')).toHaveClass(/dose-raggiunta/)
    await riga(pagina, 'Broad jump').getByRole('button', { name: 'Bipodalico' }).click()
    await expect(voce('plio_est')).toHaveText('120')

    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').nth(1).click()
    await pagina.getByTitle('Aggiungi Leg extension').click()
    await pagina.getByTitle('Aggiungi Hip thrust').click()
    // quadricipite 3 va bene, gluteo 2: ne manca una
    await expect(voce('forza')).toHaveText('5 · −1')

    // ---- la ciambella: sulla forza, la percentuale dei muscoli
    const ciambella = pagina.locator('.ciambella-dose')
    await ciambella.locator('li', { hasText: 'Forza' }).hover()
    await expect(ciambella.getByRole('tooltip')).toContainText('Quadricipite')
    await expect(ciambella.getByRole('tooltip')).toContainText('%')
    await pagina.screenshot({ path: join(FOTO, '47-dose-ciambella.png') })
    await pagina.mouse.move(0, 0)

    // ---- l'eccezione sulla barretta
    await riga(pagina, 'Hip thrust').locator('.barra-dose').click()
    await pagina.locator('.menu-dose').getByRole('button', { name: 'Ipertrofia', exact: true }).click()
    await expect(riga(pagina, 'Hip thrust').locator('.eccezione-dose')).toContainText('Qui conta come ipertrofia')
    await expect(voce('forza')).toHaveText('3')
    await expect(voce('ipertrofia')).toHaveText('2')
    await pagina.screenshot({ path: join(FOTO, '43-dose-seduta.png'), fullPage: true })
    await riga(pagina, 'Hip thrust').getByRole('button', { name: 'Ripristina' }).click()
    await expect(voce('forza')).toHaveText('5 · −1')

    // ---- il dettaglio si apre sopra la scheda
    await expect(voce('forza')).toHaveClass(/dose-vicina/)
    await dose.locator('.riga-dose-titolo').click()
    await expect(dose.locator('.riga-dose-dettaglio')).toContainText('Forza · Gluteo')
    await expect(dose.locator('.riga-dose-dettaglio')).toContainText('1 serie')
    await pagina.screenshot({ path: join(FOTO, '44-dose-dettaglio.png') })
    await dose.getByRole('button', { name: 'Settimana' }).click()
    await expect(dose.locator('.riga-dose-dettaglio')).toContainText('su 2–3')
    await pagina.screenshot({ path: join(FOTO, '45-dose-settimana.png') })
    await dose.locator('.riga-dose-titolo').click({ force: true })

    await pagina.getByRole('button', { name: /Salva seduta/ }).click()

    // riaperta, il segno c'e' e il conto pure
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Diario sedute' }).click()
    await pagina.getByTitle('Modifica la seduta').first().click()
    await expect(riga(pagina, 'Broad jump').getByRole('button', { name: 'Monopodalico' })).toBeVisible()
    await expect(voce('plio_est')).toHaveText('120')
    await pagina.locator('.nome-nel-titolo').click()
    await apriPaziente(pagina)
    await pagina.screenshot({ path: join(FOTO, '46-dose-quadro.png'), fullPage: true })

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
