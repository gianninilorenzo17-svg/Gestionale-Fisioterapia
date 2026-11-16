import { useEffect } from 'react'
import { scorciatoieBloccate } from '../../scorciatoie'

// Esc chiude la finestra del farmaco che sta in cima. Non passa da useScorciatoie
// perché quello salta Esc quando c'è una scheda di farmaco aperta (apposta: la
// finestra sotto non deve chiudersi): qui è la scheda stessa che si chiude.
export function useEsc(azione: () => void, attiva = true): void {
  useEffect(() => {
    if (!attiva) return
    const gestisci = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || scorciatoieBloccate()) return
      // un elenco di suggerimenti aperto usa Esc per chiudersi
      if (document.querySelector('.menu-scelta-popup, .elenco-scelta')) return
      e.preventDefault()
      azione()
    }
    window.addEventListener('keydown', gestisci)
    return () => window.removeEventListener('keydown', gestisci)
  })
}
