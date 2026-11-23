import { useEffect, useState } from 'react'
import Aiuto from '../../components/Aiuto'
import { toastErrore } from '../../components/Toast'
import { errMsg } from '../../lib'
import { STILI_SCHEDA, type QualeScheda, type StileScheda } from '../../../../shared/stile-scheda'
import type { Tema } from '../../../../shared/temi'
import { TEMI } from '../../../../shared/temi'

export type ModoScuro = 'chiaro' | 'scuro' | 'orari'

// Come si scrive la dose nella scheda che si mostra al paziente. Due scelte
// indipendenti: la scheda senza immagini (finestra e PDF) e quella con le immagini.
function StileSchedaPaziente(): React.JSX.Element | null {
  const [stili, setStili] = useState<Record<QualeScheda, StileScheda> | null>(null)
  useEffect(() => {
    window.api.impostazioni
      .stiliScheda()
      .then(setStili)
      .catch((e) => toastErrore(errMsg(e)))
  }, [])
  if (!stili) return null
  const scegli = (quale: QualeScheda, stile: StileScheda): void => {
    const prima = stili
    setStili({ ...stili, [quale]: stile })
    window.api.impostazioni.setStileScheda(quale, stile).catch((e) => {
      setStili(prima)
      toastErrore(errMsg(e))
    })
  }
  const riga = (quale: QualeScheda, nome: string, aiuto: string): React.JSX.Element => (
    <div className="riga-interruttore riga-luce">
      <span className="nome-interruttore">
        {nome}
        <Aiuto testo={aiuto} />
      </span>
      <span className="scelta-coppia segmentata">
        {STILI_SCHEDA.map((st) => (
          <button
            key={st.valore}
            type="button"
            className={stili[quale] === st.valore ? 'scelta-attiva' : ''}
            onClick={() => scegli(quale, st.valore)}
          >
            {st.etichetta}
          </button>
        ))}
      </span>
    </div>
  )
  return (
    <>
      <div className="sotto-titolo riga-staccata">
        Scheda del paziente
        <Aiuto testo="Come si legge la dose di ogni esercizio. Bolle colorate: «3 serie da 5 rip.» con carico e recupero in due bolle. Caselle bianche: quattro caselle fisse (Serie, Rip., Carico, Recupero). Si sceglie per la scheda senza immagini e, a parte, per quella con le immagini. Vale per la finestra che mostri al paziente e per i PDF." />
      </div>
      {riga(
        'senza',
        'Senza immagini',
        'La finestra che mostri al paziente durante la seduta e il PDF senza immagini.'
      )}
      {riga('con', 'Con immagini', 'La scheda illustrata (foto e spiegazioni) e il suo PDF.')}
    </>
  )
}

export function SchedaAspetto({
  tema,
  onTema,
  scuro,
  modoScuro,
  orariScuro,
  onScuro,
  barraScura,
  onBarraScura
}: {
  tema: Tema
  onTema: (t: Tema) => void
  scuro: boolean
  modoScuro: ModoScuro
  orariScuro: { dalle: string; alle: string }
  onScuro: (modo: ModoScuro, orari?: { dalle: string; alle: string }) => void
  barraScura: boolean
  onBarraScura: (valore: boolean) => void
}): React.JSX.Element {
  return (
    <section className="card single-col">
      <div className="sotto-titolo">
        Colore dell&apos;app
        <Aiuto testo="Il colore cambia subito, e vale anche per i documenti che stampi: intestazioni delle sezioni e righe dei titoli nelle tabelle." />
      </div>
      <div className="scelta-tema">
        {TEMI.map((t) => (
          <button
            key={t.valore}
            className={tema === t.valore ? 'scelta-attiva' : ''}
            onClick={() => onTema(t.valore)}
          >
            <span className="pallino-tema" style={{ background: t.colore }} />
            {t.etichetta}
          </button>
        ))}
      </div>

      {/* Prima la barra scura era una caratteristica del blu: gli altri due
          colori non potevano averla, e il blu non poteva farne a meno. Adesso
          e' una scelta a se', valida con qualunque colore. */}
      <label className="riga-interruttore riga-staccata">
        <span className="nome-interruttore">
          Colonna laterale scura
          <Aiuto testo="La striscia con i pulsanti delle sezioni, a sinistra: scura stacca di più dal contenuto, chiara è più leggera. Il colore che hai scelto resta quello. Con la modalità scura la colonna è sempre scura, e questo interruttore resta acceso." />
        </span>
        {/* Con la modalita' scura la colonna e' scura comunque: l'interruttore
            lo dice restando acceso, invece di sembrare spento e non fare
            niente. */}
        <input
          type="checkbox"
          className="interruttore"
          checked={barraScura || scuro}
          disabled={scuro}
          onChange={(e) => onBarraScura(e.target.checked)}
        />
      </label>

      {/* La modalita' scura non e' una tavolozza a parte: si accende sopra a
          quella scelta, e sta nello stesso riquadro perche' e' la stessa
          domanda — che aspetto ha l'app. */}
      <div className="riga-interruttore riga-luce">
        <span className="nome-interruttore">
          Modalità scura
          <Aiuto testo="Fondi scuri e scritte chiare, con il colore che hai scelto. Con A orari diventa scura da sola all'ora che scegli e torna chiara la mattina, anche con il programma aperto. I documenti che stampi restano chiari: vanno sulla carta." />
        </span>
        <span className="scelta-coppia segmentata">
          {(
            [
              ['chiaro', 'Chiara'],
              ['scuro', 'Scura'],
              ['orari', 'A orari']
            ] as const
          ).map(([modo, nome]) => (
            <button
              key={modo}
              type="button"
              className={modoScuro === modo ? 'scelta-attiva' : ''}
              onClick={() => onScuro(modo)}
            >
              {nome}
            </button>
          ))}
        </span>
      </div>
      {modoScuro === 'orari' && (
        <div className="orari-scuro">
          <span>Scura dalle</span>
          <input
            type="time"
            value={orariScuro.dalle}
            onChange={(e) => e.target.value && onScuro('orari', { ...orariScuro, dalle: e.target.value })}
          />
          <span>alle</span>
          <input
            type="time"
            value={orariScuro.alle}
            onChange={(e) => e.target.value && onScuro('orari', { ...orariScuro, alle: e.target.value })}
          />
        </div>
      )}
      <StileSchedaPaziente />
    </section>
  )
}
