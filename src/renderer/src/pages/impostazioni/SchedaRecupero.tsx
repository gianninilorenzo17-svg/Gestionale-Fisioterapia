import { useEffect, useState } from 'react'
import { RigaImp } from './Riga'
import { toast, toastErrore } from '../../components/Toast'
import { errMsg } from '../../lib'
import { daPrecarico, ricorda } from '../../precarico'

// Come si rientra se si dimentica la password. La chiave di recupero c'e'
// sempre, dal primo avvio. In piu' si puo' impostare una domanda: e' piu' comoda
// da ricordare, ma meno sicura della chiave, quindi si aggiunge a lei e non la
// sostituisce. Per impostarla o toglierla serve la password di adesso.
export function RigheRecupero(): React.JSX.Element {
  const [domanda, setDomanda] = useState<string | null>(() => daPrecarico<string | null>('domanda', null))
  const [modo, setModo] = useState<'vedi' | 'imposta' | 'togli'>('vedi')
  const [testo, setTesto] = useState('')
  const [risposta, setRisposta] = useState('')
  const [ripeti, setRipeti] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')

  const carica = (): void => {
    window.api.auth
      .domanda()
      .then(ricorda<string | null>('domanda'))
      .then(setDomanda)
      .catch((e) => toastErrore(errMsg(e)))
  }
  useEffect(carica, [])

  const chiudi = (): void => {
    setModo('vedi')
    setTesto('')
    setRisposta('')
    setRipeti('')
    setPassword('')
    setErrore('')
  }

  const salva = async (): Promise<void> => {
    setErrore('')
    if (risposta.trim().toLowerCase() !== ripeti.trim().toLowerCase()) {
      setErrore('Le due risposte non coincidono.')
      return
    }
    try {
      await window.api.auth.impostaDomanda(password, testo, risposta)
      toast('Domanda di recupero salvata.')
      chiudi()
      carica()
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  const togli = async (): Promise<void> => {
    setErrore('')
    try {
      await window.api.auth.togliDomanda(password)
      toast('Domanda di recupero tolta. Resta la chiave di recupero.')
      chiudi()
      carica()
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  const modulo =
    modo === 'vedi' ? undefined : (
      <div className="imp-modulo">
        {modo === 'imposta' && (
          <>
            <label>
              Domanda
              <input
                autoFocus
                placeholder="es. Come si chiamava la mia maestra delle elementari?"
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
              />
            </label>
            <label>
              Risposta (almeno 8 caratteri: meglio una frase che una parola)
              <input
                type="password"
                value={risposta}
                onChange={(e) => setRisposta(e.target.value)}
              />
            </label>
            <label>
              Ripeti la risposta
              <input type="password" value={ripeti} onChange={(e) => setRipeti(e.target.value)} />
            </label>
          </>
        )}
        <label>
          Password attuale
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {errore && <p className="auth-error">{errore}</p>}
        <div className="modal-actions">
          <button onClick={chiudi}>Annulla</button>
          {modo === 'imposta' ? (
            <button className="primary" onClick={() => void salva()}>
              Salva la domanda
            </button>
          ) : (
            <button className="primary" onClick={() => void togli()}>
              Togli la domanda
            </button>
          )}
        </div>
      </div>
    )

  return (
    <>
      <RigaImp
        nome="Chiave di recupero"
        descrizione="La chiave che hai salvato al primo avvio: vale sempre ed è il modo più sicuro di rientrare se dimentichi la password."
      >
        <span className="badge-stato">Attiva</span>
      </RigaImp>
      <RigaImp
        nome="Domanda di recupero"
        descrizione={
          domanda ? (
            <>
              «{domanda}»<br />
              Più comoda della chiave ma meno sicura: la risposta si indovina più facilmente.
            </>
          ) : (
            'Un secondo modo di rientrare, a una domanda che scegli tu. Più comoda della chiave ma meno sicura: scegli una risposta che non si trova online. Maiuscole e spazi non contano.'
          )
        }
        sotto={modulo}
      >
        {modo === 'vedi' && (
          <span className="imp-azioni">
            {domanda ? (
              <span className="badge-stato">Attiva</span>
            ) : (
              <span className="badge-stato follow">Non impostata</span>
            )}
            {domanda && <button onClick={() => setModo('togli')}>Togli</button>}
            <button onClick={() => setModo('imposta')}>{domanda ? 'Cambia…' : 'Imposta…'}</button>
          </span>
        )}
      </RigaImp>
    </>
  )
}
