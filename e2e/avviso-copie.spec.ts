// L'avviso sulla copia fuori dal computer ha il pulsante che porta dritti a
// Impostazioni › Dati e backup, e si dice una volta al giorno.
import { test, expect } from '@playwright/test'
import { avvia, creaArchivio } from './app'

test('avviso copie: «Vai ai backup» apre Dati e backup, e non si ripete lo stesso giorno', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    const avviso = pagina.locator('.toast', { hasText: 'copia fuori dal computer' })
    await expect(avviso).toBeVisible()
    await avviso.getByRole('button', { name: 'Vai ai backup' }).click()
    await expect(pagina.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()
    await expect(pagina.getByText('Fuori dal computer', { exact: true })).toBeVisible()
    await expect(pagina.getByText('Copie di sicurezza', { exact: false }).first()).toBeVisible()
    // lo stesso giorno non si ripete: il giorno e' ricordato
    expect(await pagina.evaluate(() => localStorage.getItem('avvisoCopiaFuori'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(prova.errori).toEqual([])
  } finally {
    await prova.chiudi()
  }
})
