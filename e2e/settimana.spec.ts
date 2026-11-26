// La settimana: da lunedi' a domenica, con la pagina scorsa su oggi anche
// tornandoci dal menu (prima si ripartiva dall'alto).
import { test, expect, type Page } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

async function oggiAlCentro(pagina: Page): Promise<void> {
  const giorni = pagina.locator('.giorno-settimana')
  await expect(giorni).toHaveCount(7)
  await expect(giorni.first()).toContainText(/luned/i)
  // lo scarto fra il centro del giorno di oggi e quello della finestra; di
  // lunedi' o di domenica la pagina puo' essere gia' in cima o in fondo
  await expect
    .poll(() =>
      pagina.locator('.giorno-settimana.oggi').evaluate((el) => {
        const r = el.getBoundingClientRect()
        const main = el.closest('main')!
        const m = main.getBoundingClientRect()
        const scarto = r.top + r.height / 2 - (m.top + m.height / 2)
        if (scarto < 0 && main.scrollTop < 1) return 0
        if (scarto > 0 && main.scrollTop + main.clientHeight > main.scrollHeight - 1) return 0
        return Math.abs(scarto)
      })
    )
    .toBeLessThan(40)
}

test('la settimana si apre scorsa su oggi, anche tornandoci', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    // una finestra bassa, cosi' i sette giorni non ci stanno e si deve scorrere
    await prova.app.evaluate(({ BrowserWindow }) => {
      const f = BrowserWindow.getAllWindows()[0]
      f.unmaximize()
      f.setSize(1100, 600)
    })
    await vaiA(pagina, 'Pazienti')
    await vaiA(pagina, 'La settimana')
    await oggiAlCentro(pagina)
    await pagina.screenshot({ path: join(FOTO, '02b-settimana-oggi.png') })

    await pagina.getByTitle('Settimana successiva').click()
    await expect(pagina.locator('.giorno-settimana.oggi')).toHaveCount(0)
    await pagina.getByRole('button', { name: 'Questa settimana' }).click()
    await oggiAlCentro(pagina)

    // ripremendo la voce del menu si torna su oggi
    await pagina.locator('main').evaluate((m) => m.scrollTo({ top: 0 }))
    await vaiA(pagina, 'La settimana')
    await oggiAlCentro(pagina)
    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
