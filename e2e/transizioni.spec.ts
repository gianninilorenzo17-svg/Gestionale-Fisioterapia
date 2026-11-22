// Passando da una sezione all'altra, o aprendo una finestra, la schermata deve
// comparire gia' piena: non prima la cornice e poi i contenuti che arrivano.
//
// Come si misura: un osservatore registra l'istante di ogni cambiamento della
// pagina (elementi aggiunti o tolti, testo cambiato). Dopo un clic, i
// cambiamenti del primo disegno arrivano tutti insieme; se ne arrivano altri
// piu' tardi, e' la pagina che si sta riempiendo sotto gli occhi.
import { test, expect, type Page } from '@playwright/test'
import { avvia, creaArchivio, nuovoPaziente, vaiA } from './app'

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const giorniFa = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return iso(d)
}

// Oltre questo ritardo dal primo disegno un cambiamento si vede (la pagina
// entra con una dissolvenza di 160 ms che parte da trasparente: quello che
// arriva nei primissimi istanti non si nota).
const SOGLIA_MS = 50

interface Misura {
  nome: string
  primo: number
  ritardo: number
  tardivi: string[]
}

async function installaOsservatore(pagina: Page): Promise<void> {
  await pagina.evaluate(() => {
    const w = window as unknown as { __cambi: { t: number; cosa: string }[] }
    if (w.__cambi) return
    w.__cambi = []
    const descrivi = (n: Node): string => {
      const el = n.nodeType === 1 ? (n as Element) : n.parentElement
      const testo = (n.textContent ?? '').trim().slice(0, 40)
      return `${el?.tagName.toLowerCase() ?? '#'}.${(el?.className && typeof el.className === 'string' ? el.className : '').split(' ')[0]} «${testo}»`
    }
    new MutationObserver((elenco) => {
      const t = performance.now()
      for (const r of elenco) {
        // gli avvisi in basso non sono la pagina
        const dove = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement
        if (dove?.closest('.toast-host, .toasts, [class*="toast"]')) continue
        // quello che succede in una parte nascosta non si vede
        if (dove?.closest('[hidden]')) continue
        // il nome nella barra in cima segue il titolo della finestra, da solo
        if (dove?.closest('.titolo-barra')) continue
        // la scritta «Caricamento…» che compare solo dopo mezzo secondo
        if (dove?.closest('.caricamento-ritardato')) continue
        if (r.type === 'characterData') w.__cambi.push({ t, cosa: descrivi(r.target) })
        else
          for (const n of [...Array.from(r.addedNodes), ...Array.from(r.removedNodes)])
            w.__cambi.push({ t, cosa: descrivi(n) })
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  })
}

async function misura(pagina: Page, nome: string, azione: () => Promise<void>): Promise<Misura> {
  const t0 = await pagina.evaluate(() => performance.now())
  await azione()
  await pagina.waitForTimeout(900)
  const cambi = await pagina.evaluate((t0) => {
    const w = window as unknown as { __cambi: { t: number; cosa: string }[] }
    const qui = w.__cambi.filter((c) => c.t >= t0)
    w.__cambi = []
    return qui
  }, t0)
  if (cambi.length === 0) return { nome, primo: -1, ritardo: 0, tardivi: [] }
  const primo = cambi[0].t
  const tardivi = cambi.filter((c) => c.t - primo > SOGLIA_MS)
  const ritardo = Math.round(cambi[cambi.length - 1].t - primo)
  return {
    nome,
    primo: Math.round(primo - t0),
    ritardo,
    tardivi: [...new Set(tardivi.map((c) => `+${Math.round(c.t - primo)}ms ${c.cosa}`))].slice(0, 6)
  }
}

test('transizioni: le schermate compaiono gia\' piene', async () => {
  test.setTimeout(240_000)
  const prova = await avvia()
  const misure: Misura[] = []
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await nuovoPaziente(pagina, { nome: 'Marco', cognome: 'Rossi', diagnosi: 'Lesione LCA' })
    await pagina.evaluate(
      async ({ date }) => {
        const api = window.api
        const pz = (await api.pazienti.list()).find((p) => p.cognome === 'Rossi')!.id
        const pat = await api.patologie.create('Ricostruzione LCA')
        const f1 = await api.fasi.create(pat, 'Iniziale')
        const f2 = await api.fasi.create(pat, 'Intermedia')
        await api.obiettivi.create(f2, 'ROM completo')
        await api.pazienti.setPatologiaFase(pz, pat, f2)
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
        for (const [i, d] of date.entries()) {
          await api.sedute.create({
            paziente_id: pz,
            data: d,
            ora: null,
            fase_id: i < 2 ? f1 : f2,
            focus: 'Forza',
            dolore: 5 - i,
            sforzo: 6,
            segni: [],
            riferito_andamento: null,
            riferito: 'Meglio',
            tecnica_ids: [],
            trattamento: 'Terapia manuale',
            note: 'Bene',
            sezioni: [{ sezione_id: null, nome: 'Esercizi' }],
            esercizi: [
              {
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
            ]
          })
        }
        for (let i = 0; i < 8; i++) {
          await api.pazienti.create({ nome: `Prova${i}`, cognome: `Paziente${i}` } as never).catch(() => undefined)
        }
      },
      { date: [giorniFa(20), giorniFa(13), giorniFa(6), giorniFa(1), iso(new Date())] }
    )
    await vaiA(pagina, 'La settimana')
    await pagina.waitForTimeout(500)
    await installaOsservatore(pagina)
    const m = async (nome: string, azione: () => Promise<void>): Promise<void> => {
      misure.push(await misura(pagina, nome, azione))
    }
    const linguetta = (nome: string | RegExp) => pagina.locator('.config-tabs:visible').getByRole('button', { name: nome })

    // ---- il menu a sinistra ----
    for (const voce of ['Pazienti', 'Follow-up', 'Return To Play', 'Configurazione', 'Impostazioni', 'La settimana', 'Pazienti']) {
      await m(`menu: ${voce}`, () => vaiA(pagina, voce))
    }
    // ---- la scheda del paziente ----
    await m('apri paziente', () => pagina.locator('main').getByText('Rossi Marco', { exact: true }).click())
    for (const t of [/^Diario/, /^Clinica/, /^Pedana/, /^Percorso/, /^Quadro/]) {
      await m(`linguetta ${t.source}`, () => linguetta(t).click())
    }
    await linguetta(/^Clinica/).click()
    for (const v of ['Body chart', 'Questionari', 'Valutazione obiettiva', 'Promemoria', 'Segni di riferimento', 'Anamnesi']) {
      await m(`clinica: ${v}`, () => pagina.locator('.voce-indice:visible').filter({ hasText: v }).click())
    }
    await m('finestra anamnesi prossima', () => pagina.getByTitle('Anamnesi prossima').click())
    await pagina.keyboard.press('Escape')
    await pagina.waitForTimeout(300)
    await linguetta(/^Percorso/).click()
    for (const v of ['Obiettivi della fase', 'Carico settimanale', 'Indicazioni per casa', 'Massimali', 'Patologia e fase']) {
      const voce = pagina.locator('.voce-indice:visible').filter({ hasText: v })
      if ((await voce.count()) > 0) await m(`percorso: ${v}`, () => voce.click())
    }
    await linguetta(/^Diario/).click()
    await m('apri seduta dal diario', () => pagina.locator('.d-riga').first().click())
    await m('esci dalla seduta (Esc)', () => pagina.keyboard.press('Escape'))
    await m('nuova seduta', () => pagina.getByRole('button', { name: 'Nuova seduta' }).click())
    await m('esci dalla nuova seduta', () => pagina.keyboard.press('Escape'))
    await m('torna all\'elenco (menu)', () => vaiA(pagina, 'Pazienti'))
    await m('finestra nuovo paziente', () => pagina.getByRole('button', { name: 'Nuovo paziente' }).first().click())
    await pagina.keyboard.press('Escape')
    await pagina.waitForTimeout(300)
    await m('ricerca Ctrl+K', () => pagina.keyboard.press('Control+k'))
    await pagina.keyboard.press('Escape')

    // ---- da un'altra sezione: la ricerca apre il paziente ----
    await pagina.keyboard.press('Control+k')
    await pagina.keyboard.type('Rossi')
    await pagina.waitForTimeout(400)
    await m('ricerca: apri paziente', () => pagina.keyboard.press('Enter'))

    // ---- le finestre a parte: compaiono gia' piene ----
    // Nel processo principale si guarda cosa c'e' nella pagina nell'istante in
    // cui la finestra si mostra.
    await prova.app.evaluate(({ app }) => {
      const g = globalThis as unknown as { __mostrate: string[] }
      g.__mostrate = []
      app.on('browser-window-created', (_e, w) => {
        w.once('show', () => {
          void w.webContents
            .executeJavaScript(
              "(document.querySelector('.scheda-paziente, .cartella, body')?.innerText || '').trim().length"
            )
            .then((n: number) => g.__mostrate.push(`${w.getTitle()}: ${n} caratteri`))
            .catch((e: Error) => g.__mostrate.push(`${w.getTitle()}: errore ${e.message}`))
        })
      })
    })
    const ids = await pagina.evaluate(async () => {
      const pz = (await window.api.pazienti.list()).find((p) => p.cognome === 'Rossi')!.id
      const s = await window.api.sedute.list(pz)
      return { pz, seduta: s[0].id }
    })
    await pagina.evaluate((id) => window.api.scheda.apri(id), ids.seduta)
    await pagina.evaluate((id) => window.api.esporta.anteprimaCartella(id, ['anagrafica']), ids.pz)
    await pagina.evaluate((id) => window.api.esporta.anteprimaRelazione(id, 'anamnesi'), ids.pz)
    const leggiMostrate = (): Promise<string[]> =>
      prova.app.evaluate(() => (globalThis as unknown as { __mostrate: string[] }).__mostrate)
    await expect.poll(async () => (await leggiMostrate()).length, { timeout: 15_000 }).toBe(3)
    const mostrate = await leggiMostrate()
    for (const r of mostrate) console.log(`finestra mostrata — ${r}`)
    expect(mostrate.length).toBe(3)
    for (const r of mostrate) expect(r).not.toMatch(/: 0 caratteri|errore/)

    // ---- la settimana: un clic su una seduta ----
    await vaiA(pagina, 'La settimana')
    await pagina.waitForTimeout(300)
    const sedutaSettimana = pagina.locator('main').getByText('Rossi', { exact: false }).first()
    if ((await sedutaSettimana.count()) > 0) {
      await m('settimana: apri seduta', () => sedutaSettimana.click())
      await m('settimana: esci dalla seduta', () => pagina.keyboard.press('Escape'))
    }

    // ---- configurazione ----
    await vaiA(pagina, 'Configurazione')
    await pagina.waitForTimeout(500)
    for (const t of ['Gruppi', 'Farmaci', 'Distretti', 'Libreria esercizi', 'Questionari', 'Test di valutazione', 'Screening', 'Patologie']) {
      const b = pagina.locator('.config-tabs-top button').filter({ hasText: t }).first()
      if ((await b.count()) > 0) await m(`config: ${t}`, () => b.click())
    }
    await m('config: apri patologia', () => pagina.locator('main').getByText('Ricostruzione LCA').first().click())

    // ---- impostazioni ----
    await vaiA(pagina, 'Impostazioni')
    await pagina.waitForTimeout(300)
    for (const t of ['Profilo', 'Accesso e aspetto', 'Dati e backup', 'Guida']) {
      await m(`impostazioni: ${t}`, () => pagina.getByRole('button', { name: t, exact: true }).click())
    }

    // Con un margine sulla soglia: una macchina lenta non deve far fallire la
    // prova, una pagina che si riempie (prima erano 120-210 ms) si'.
    // Sulle macchine condivise della CI i tempi non dicono niente (un'attesa del
    // sistema vale centinaia di millisecondi): li' si stampano e basta.
    const riempite = misure.filter((x) => x.ritardo > 100).map((x) => `${x.nome} (${x.ritardo} ms)`)
    if (!process.env.CI) expect(riempite, 'schermate che si riempiono dopo essere comparse').toEqual([])
    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    console.log('\n=== TRANSIZIONI ===')
    for (const x of misure) {
      const segno = x.tardivi.length > 0 ? 'XX' : 'ok'
      console.log(`${segno} ${x.nome.padEnd(36)} primo +${x.primo}ms  coda ${x.ritardo}ms`)
      for (const d of x.tardivi) console.log(`     ${d}`)
    }
    await prova.chiudi()
  }
})
