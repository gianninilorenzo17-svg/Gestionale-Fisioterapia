import { useState } from 'react'
import ConsiglioPassword from '../../components/ConsiglioPassword'
import { controllaPassword } from '../../../../shared/password'
import { toast } from '../../components/Toast'
import { errMsg } from '../../lib'
import { RigaImp } from './Riga'

export function RigaPassword(): React.JSX.Element {
  const [vecchia, setVecchia] = useState('')
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState('')
  // il modulo si apre solo premendo il pulsante: quasi sempre non serve
  const [aperto, setAperto] = useState(false)

  const chiudi = (): void => {
    setAperto(false)
    setVecchia('')
    setNuova('')
    setConferma('')
    setErrore('')
  }

  const salva = async (): Promise<void> => {
    setErrore('')
    const debole = controllaPassword(nuova)
    if (debole) {
      setErrore(debole)
      return
    }
    if (nuova !== conferma) {
      setErrore('Le nuove password non coincidono.')
      return
    }
    try {
      await window.api.auth.cambiaPassword(vecchia, nuova)
      toast('Password aggiornata. La chiave di recupero e la domanda restano valide.')
      chiudi()
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  return (
    <RigaImp
      nome="Password"
      descrizione="Serve per aprire il programma. Cambiandola, la chiave di recupero e la domanda restano valide."
      sotto={
        aperto ? (
          <div className="imp-modulo">
            <label>
              Password attuale
              <input type="password" value={vecchia} onChange={(e) => setVecchia(e.target.value)} />
            </label>
            <label>
              Nuova password (almeno 10 caratteri: meglio una frase di qualche parola)
              <input type="password" value={nuova} onChange={(e) => setNuova(e.target.value)} />
              <ConsiglioPassword password={nuova} />
            </label>
            <label>
              Conferma nuova password
              <input
                type="password"
                value={conferma}
                onChange={(e) => setConferma(e.target.value)}
              />
            </label>
            {errore && <p className="auth-error">{errore}</p>}
            <div className="modal-actions">
              <button onClick={chiudi}>Annulla</button>
              <button className="primary" onClick={() => void salva()}>
                Salva
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      {!aperto && <button onClick={() => setAperto(true)}>Cambia password…</button>}
    </RigaImp>
  )
}
