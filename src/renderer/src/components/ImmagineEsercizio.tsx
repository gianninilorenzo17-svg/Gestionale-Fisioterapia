import { useEffect, useState } from 'react'
import Modale from './Modale'
import { errMsg } from '../lib'

// Mostra a schermo intero l'immagine di un esercizio. L'immagine non arriva
// con l'elenco (sarebbe pesante): si chiede al database solo quando serve.
export default function ImmagineEsercizio({
  esercizioId,
  nome,
  variante,
  onClose
}: {
  esercizioId: number
  nome: string
  // La variante scelta in seduta: se ha una foto sua si vede quella.
  variante?: string | null
  onClose: () => void
}): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    let annullato = false
    window.api.esercizi
      .immagine(esercizioId, variante)
      .then((d) => {
        if (annullato) return
        if (d == null) setErrore("Questo esercizio non ha un'immagine.")
        else setSrc(d)
      })
      .catch((e) => {
        if (!annullato) setErrore(errMsg(e))
      })
    return () => {
      annullato = true
    }
  }, [esercizioId, variante])

  return (
    <Modale onConferma={onClose}>
        <h3>{nome}</h3>
        {errore ? (
          <p className="auth-error">{errore}</p>
        ) : src ? (
          <img className="immagine-grande" src={src} alt={nome} />
        ) : (
          <p className="hint caricamento-ritardato">Caricamento…</p>
        )}
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Chiudi
          </button>
        </div>
    </Modale>
  )
}
