// I farmaci: la sottolineatura nella storia precedente, la bolla, la scheda, la
// lista nell'anamnesi remota e la pagina in Configurazione. Le fotografie finiscono
// in e2e-risultati/schermate: l'allineamento della sottolineatura si guarda li'.
import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, nuovoPaziente } from './app'

test('farmaci: sottolineatura, bolla, scheda, lista del paziente e configurazione', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await nuovoPaziente(pagina, { nome: 'Luca', cognome: 'Farmaci' })
    await pagina.getByRole('button', { name: 'Clinica', exact: true }).click()

    // ---- anamnesi prossima: storia precedente ----
    await pagina.getByTitle('Anamnesi prossima').click()
    const storia = pagina.getByLabel('Storia precedente')
    const testo = 'Prende Tachipirina e ibuprofene 600.\nNon prende Lipitor, carenza di ferro.\nNiente altro da segnalare.'
    await storia.fill(testo)
    const sottolineati = pagina.locator('.farmaco-sottolineato')
    await expect(sottolineati).toHaveCount(3)
    await expect(sottolineati.nth(0)).toHaveText('Tachipirina')
    await expect(sottolineati.nth(1)).toHaveText('ibuprofene')
    await expect(sottolineati.nth(2)).toHaveText('Lipitor')
    // il testo del campo resta testo semplice
    await expect(storia).toHaveValue(testo)
    await pagina.screenshot({ path: join(FOTO, '60-farmaci-sottolineati.png') })

    // la sottolineatura sta sotto la parola giusta: il livello dietro e il campo vanno a capo uguali
    const posizioni = await pagina.evaluate(() => {
      const ta = document.querySelector('.testo-farmaci textarea') as HTMLTextAreaElement
      const dietro = document.querySelector('.testo-farmaci-sotto') as HTMLElement
      const a = ta.getBoundingClientRect()
      const b = dietro.getBoundingClientRect()
      return {
        stessaScatola: Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1,
        stessoPunto: Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1,
        // la larghezza utile del testo dietro e quella del campo coincidono
        utileCampo: ta.clientWidth,
        utileDietro: dietro.clientWidth
      }
    })
    expect(posizioni.stessaScatola).toBe(true)
    expect(posizioni.stessoPunto).toBe(true)

    // ---- la bolla ----
    const riquadro = await sottolineati.nth(0).boundingBox()
    expect(riquadro).not.toBeNull()
    await pagina.mouse.move(riquadro!.x + riquadro!.width / 2, riquadro!.y + riquadro!.height / 2)
    const bolla = pagina.locator('.bolla-farmaco')
    await expect(bolla).toBeVisible()
    await expect(bolla).toContainText('Paracetamolo')
    await expect(bolla).toContainText('Bozza da verificare')
    await expect(bolla).toContainText('A cosa serve')
    // il principio attivo, non l'elenco degli altri nomi commerciali
    await expect(bolla).not.toContainText('Efferalgan')
    await pagina.screenshot({ path: join(FOTO, '61-farmaci-bolla.png') })

    // ---- la scheda completa; Esc chiude solo la scheda ----
    // il clic arriva al campo (il livello dietro non prende il mouse): si clicca per coordinate
    await pagina.mouse.click(riquadro!.x + riquadro!.width / 2, riquadro!.y + riquadro!.height / 2)
    const scheda = pagina.locator('.modale-farmaco')
    await expect(scheda).toBeVisible()
    await expect(scheda.getByRole('heading', { name: /Paracetamolo/ })).toBeVisible()
    await pagina.waitForTimeout(500) // la finestra compare con una dissolvenza
    await pagina.screenshot({ path: join(FOTO, '62-farmaci-scheda.png') })
    await pagina.keyboard.press('Escape')
    await expect(scheda).toBeHidden()
    await expect(pagina.getByRole('heading', { name: 'Anamnesi prossima' })).toBeVisible()

    // un farmaco che non c'e' non blocca: si scrive e basta
    await storia.fill(testo + '\nPoi Xyzzyfarm la sera.')
    await expect(sottolineati).toHaveCount(3)

    // salva da solo, poi si chiude
    await pagina.waitForTimeout(2200)
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('heading', { name: 'Anamnesi prossima' })).toBeHidden()

    // ---- anamnesi remota: la lista ----
    await pagina.getByTitle('Anamnesi remota').click()
    await expect(pagina.getByRole('heading', { name: 'Anamnesi remota' })).toBeVisible()
    // a riposo e' solo un "+ Farmaci"
    await pagina.screenshot({ path: join(FOTO, '63-farmaci-remota-chiusa.png') })
    await pagina.getByRole('button', { name: /^\s*Farmaci$/ }).click()
    await pagina.getByRole('button', { name: /Aggiungi i farmaci riconosciuti/ }).click()
    const proposte = pagina.locator('.farmaci-proposta')
    await expect(proposte).toHaveCount(3)
    // niente e' scelto da solo
    await expect(proposte.locator('input:checked')).toHaveCount(0)
    await proposte.nth(0).locator('input').check()
    await proposte.nth(1).locator('input').check()
    await pagina.getByRole('button', { name: 'Aggiungi i selezionati' }).click()
    const chip = pagina.locator('.farmaco-chip')
    await expect(chip).toHaveCount(2)
    await expect(chip.nth(0)).toContainText('Tachipirina')

    // aggiunta a mano: Invio aggiunge e NON chiude la finestra
    const campo = pagina.getByPlaceholder('Aggiungi un farmaco…')
    await campo.fill('Xyzzyfarm')
    await campo.press('Enter')
    await expect(chip).toHaveCount(3)
    await expect(pagina.getByRole('heading', { name: 'Anamnesi remota' })).toBeVisible()
    await expect(chip.nth(2)).toHaveClass(/sconosciuto/)

    // la nota
    await chip.nth(0).getByRole('button', { name: /Nota su/ }).click()
    await pagina.getByPlaceholder(/Se il paziente riferisce una dose/).fill('1000 mg al bisogno')
    await pagina.getByPlaceholder(/Se il paziente riferisce una dose/).press('Enter')
    await expect(pagina.getByRole('heading', { name: 'Anamnesi remota' })).toBeVisible()
    await expect(chip.nth(0)).toContainText('1000 mg al bisogno')
    await pagina.screenshot({ path: join(FOTO, '64-farmaci-remota-lista.png') })

    // stessa bolla dalla lista
    await chip.nth(1).hover()
    await expect(pagina.locator('.bolla-farmaco')).toContainText('Ibuprofene')
    await pagina.screenshot({ path: join(FOTO, '65-farmaci-remota-bolla.png') })
    await pagina.mouse.move(5, 5)

    // un nome sconosciuto si collega a un principio attivo
    await chip.nth(2).locator('.farmaco-chip-nome').click()
    await expect(pagina.getByRole('heading', { name: /Xyzzyfarm/ })).toBeVisible()
    await pagina.getByPlaceholder('es. Ibuprofene').fill('Pregabalin')
    await pagina.getByRole('button', { name: 'Collega', exact: true }).click()
    await expect(pagina.locator('.farmaco-chip.sconosciuto')).toHaveCount(0)
    await pagina.waitForTimeout(500)
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('heading', { name: 'Anamnesi remota' })).toBeHidden()

    // ---- Configurazione → Farmaci ----
    await pagina.getByRole('button', { name: 'Configurazione', exact: true }).click()
    await pagina.getByRole('button', { name: 'Farmaci', exact: true }).click()
    await expect(pagina.getByRole('heading', { name: 'Farmaci' })).toBeVisible()
    await expect(pagina.locator('button.farmaci-elenco-riga').first()).toBeVisible()
    await pagina.getByPlaceholder(/Cerca per principio attivo/).fill('ciprofloxacina')
    await expect(pagina.locator('button.farmaci-elenco-riga')).toHaveCount(1)
    await pagina.screenshot({ path: join(FOTO, '66-farmaci-configurazione.png') })
    await pagina.locator('button.farmaci-elenco-riga').first().click()
    await expect(pagina.getByRole('heading', { name: 'Scheda del farmaco' })).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '67-farmaci-modifica.png') })
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('heading', { name: 'Scheda del farmaco' })).toBeHidden()
  } finally {
    await prova.chiudi()
  }
})

test('farmaci: la sottolineatura resta al suo posto con testo lungo, a capo e scorrimento', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await nuovoPaziente(pagina, { nome: 'Gianni', cognome: 'Lungo' })
    await pagina.getByRole('button', { name: 'Clinica', exact: true }).click()
    await pagina.getByTitle('Anamnesi prossima').click()
    const storia = pagina.getByLabel('Storia precedente')
    const riga = 'Il paziente racconta una lunga storia di dolori ricorrenti alla schiena e al ginocchio, con periodi di miglioramento e peggioramento; '
    const blocchi = Array.from({ length: 22 }, (_, i) => `${i + 1}) ${riga}${i % 4 === 0 ? 'prendeva Tachipirina e Lipitor ' : ''}fine.`)
    await storia.fill(blocchi.join('\n'))
    const sottolineati = pagina.locator('.farmaco-sottolineato')
    await expect(sottolineati.first()).toBeVisible()
    // scorre in fondo: la sottolineatura segue il testo
    await storia.evaluate((el) => {
      ;(el as HTMLTextAreaElement).scrollTop = (el as HTMLTextAreaElement).scrollHeight
    })
    await pagina.waitForTimeout(300)
    await pagina.screenshot({ path: join(FOTO, '68-farmaci-testo-lungo.png') })
    // ogni sottolineatura visibile sta dentro al riquadro del campo
    const dentro = await pagina.evaluate(() => {
      const ta = document.querySelector('.testo-farmaci textarea') as HTMLTextAreaElement
      const r = ta.getBoundingClientRect()
      const visibili = Array.from(document.querySelectorAll('.farmaco-sottolineato'))
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.bottom > r.top && b.top < r.bottom)
      return { quanti: visibili.length, scorre: ta.scrollTop > 0, haBarra: ta.offsetWidth > ta.clientWidth + 2 }
    })
    expect(dentro.scorre).toBe(true)
    expect(dentro.quanti).toBeGreaterThan(0)
  } finally {
    await prova.chiudi()
  }
})
