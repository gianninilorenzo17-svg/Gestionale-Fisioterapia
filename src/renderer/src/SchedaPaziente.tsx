import { useCallback, useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { SchedaPaziente as Dati } from '../../shared/types'
import { errMsg, formatData } from './lib'
import { intensitaTesto, recuperoTesto, volumeTesto } from '../../shared/dosaggio'
import { nomeConMonopodalico } from '../../shared/varianti'
import { coloreSezione } from '../../shared/colore-sezione'
import BarraFinestra from './components/BarraFinestra'

// Quello che vede il paziente mentre si allena: solo il suo programma. Ne
// stanno aperte piu' d'una insieme, una per paziente.
//
// Una carta per esercizio dentro a una sezione colorata: si legge in piedi,
// spesso da un metro di distanza, quindi il nome a sinistra e la dose in grande
// a destra, sempre nello stesso posto; carico e recupero, piccoli, sotto la dose.
export default function SchedaPaziente({ sedutaId }: { sedutaId: number }): React.JSX.Element {
  const [dati, setDati] = useState<Dati | null>(null)
  const [errore, setErrore] = useState('')

  // Se durante la seduta cambi il programma, il paziente lo rivede premendo
  // "Aggiorna": la finestra non si accorge da sola delle modifiche.
  const carica = useCallback((): void => {
    window.api.scheda
      .dati(sedutaId)
      .then(setDati)
      .catch((e) => setErrore(errMsg(e)))
  }, [sedutaId])

  useEffect(carica, [carica])

  // La finestra e' nata nascosta: si mostra quando il programma e' disegnato
  // (il fotogramma dopo), cosi' compare gia' piena.
  const disegnata = dati != null || errore !== ''
  useEffect(() => {
    if (!disegnata) return
    const f = requestAnimationFrame(() => void window.api.finestra.pronta().catch(() => undefined))
    return () => cancelAnimationFrame(f)
  }, [disegnata])

  // La barra in cima alla finestra: il titolo, e la presa per spostarla.
  const barra = <BarraFinestra titolo={dati ? `Scheda — ${dati.paziente}` : 'Scheda'} />

  if (errore)
    return (
      <div className="finestra-scheda">
        {barra}
        <p className="auth-error">{errore}</p>
      </div>
    )
  if (!dati)
    return (
      <div className="finestra-scheda">
        {barra}
        <p className="hint caricamento-ritardato">Caricamento…</p>
      </div>
    )

  return (
    <div className="finestra-scheda">
    {barra}
    <div className="scheda-paziente">
      <header>
        <div>
          <h1>{dati.paziente}</h1>
          {/* La fase si legge nella scheda del paziente, non qui: qui e' il
              programma da fare, e la fase non gli serve. */}
          <p>{formatData(dati.data)}</p>
        </div>
        <button className="aggiorna-scheda" title="Aggiorna: ricarica il programma" aria-label="Aggiorna" onClick={carica}>
          <RotateCw size={18} />
        </button>
      </header>

      {dati.sezioni.length === 0 ? (
        <p className="hint">Questa seduta non ha ancora esercizi.</p>
      ) : (
        dati.sezioni.map((sez, i) => (
          <section key={i} className={`sezione-scheda colore-${coloreSezione(sez.nome, i)}`}>
            <h2>{sez.nome}</h2>
            {/* Una carta per esercizio: il nome a sinistra, a destra la dose in
                grande e sotto, piccoli, carico e recupero. Dove un dato manca
                non si scrive niente (niente piu' trattini). */}
            {sez.esercizi.map((e, j) => {
              const volume = volumeTesto(e)
              const carico = intensitaTesto(e)
              const recupero = recuperoTesto(e)
              return (
                <div className="esercizio-scheda" key={j}>
                  <div className="col-esercizio">
                    <span className="nome">{nomeConMonopodalico(e.nome, e.monopodalico)}</span>
                    {e.variante && <span className="variante">{e.variante}</span>}
                    {e.nota && <span className="nota-es">{e.nota}</span>}
                  </div>
                  {(volume || carico || recupero) && (
                    <div className="dose-scheda">
                      {volume && <strong>{volume}</strong>}
                      {carico && (
                        <span>
                          <em>Carico</em> {carico}
                        </span>
                      )}
                      {recupero && (
                        <span>
                          <em>Recupero</em> {recupero}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))
      )}

      {dati.note && (
        <section>
          <h2>Note</h2>
          <p className="nota-seduta">{dati.note}</p>
        </section>
      )}
    </div>
    </div>
  )
}
