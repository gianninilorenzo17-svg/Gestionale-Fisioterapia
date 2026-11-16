import { useState } from 'react'
import {
  NOMI_LIVELLO,
  type FarmacoEtichetta,
  type FarmacoScheda,
  type FarmacoSchedaInput,
  type LivelloAttenzione
} from '../../../../shared/farmaci'
import Modale from '../Modale'
import { toast, toastErrore } from '../Toast'
import { errMsg } from '../../lib'
import { invalidaFarmaci } from '../../farmaci'
import { useEsc } from './useEsc'

const oggi = (): string => {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function schedaVuota(principio = ''): FarmacoSchedaInput {
  return {
    principio_attivo: principio,
    classe: null,
    usi: null,
    info_fisio: null,
    avvertenze: null,
    livello: 0,
    fonte: null,
    data_revisione: oggi(),
    stato: 'bozza',
    etichette: []
  }
}

export const comeInput = (s: FarmacoScheda): FarmacoSchedaInput => ({ ...s })

// La finestra per scrivere o correggere una scheda. Si usa dalla configurazione
// e dalla scheda aperta da un farmaco sottolineato. Nessun campo e' obbligatorio
// tranne il nome del principio attivo.
export default function ModificaScheda({
  iniziale,
  etichette,
  onFatto,
  onAnnulla
}: {
  iniziale: FarmacoSchedaInput
  etichette: FarmacoEtichetta[]
  onFatto: (id: number) => void
  onAnnulla: () => void
}): React.JSX.Element {
  const [s, setS] = useState<FarmacoSchedaInput>(iniziale)
  const [inCorso, setInCorso] = useState(false)
  useEsc(onAnnulla)
  const imposta = (patch: Partial<FarmacoSchedaInput>): void => setS((x) => ({ ...x, ...patch }))
  const testo =
    (k: 'classe' | 'usi' | 'info_fisio' | 'avvertenze' | 'fonte' | 'data_revisione') =>
    (e: { target: { value: string } }): void =>
      imposta({ [k]: e.target.value || null } as Partial<FarmacoSchedaInput>)

  const salva = async (): Promise<void> => {
    if (inCorso) return
    setInCorso(true)
    try {
      // "validata da me" con la data vuota: vale da oggi
      const daSalvare = s.stato === 'validata' && !s.data_revisione ? { ...s, data_revisione: oggi() } : s
      const id = await window.api.farmaci.salvaScheda(daSalvare)
      invalidaFarmaci()
      toast('Scheda salvata')
      onFatto(id)
    } catch (e) {
      toastErrore(errMsg(e))
      setInCorso(false)
    }
  }

  const scambia = (id: number): void =>
    imposta({ etichette: s.etichette.includes(id) ? s.etichette.filter((x) => x !== id) : [...s.etichette, id] })

  return (
    <Modale className="modal-lg modale-farmaco" onConferma={salva}>
      <h3>{iniziale.id != null ? 'Scheda del farmaco' : 'Nuova scheda'}</h3>
      <p className="hint">Informazioni di riferimento, non indicazioni. Scrivi solo ciò di cui sei sicuro.</p>

      <div className="form-row-2">
        <label>
          Principio attivo
          <input
            autoFocus
            value={s.principio_attivo}
            onChange={(e) => imposta({ principio_attivo: e.target.value })}
            placeholder="es. Ibuprofene"
          />
        </label>
        <label>
          Classe
          <input value={s.classe ?? ''} onChange={testo('classe')} placeholder="es. FANS, fluorochinolone" />
        </label>
      </div>

      <label>
        A cosa serve
        <textarea rows={2} value={s.usi ?? ''} onChange={testo('usi')} />
      </label>
      <label>
        Informazioni per la fisioterapia
        <textarea rows={3} value={s.info_fisio ?? ''} onChange={testo('info_fisio')} />
      </label>
      <label>
        Avvertenze
        <textarea rows={3} value={s.avvertenze ?? ''} onChange={testo('avvertenze')} />
      </label>

      <div className="farmaco-campo">
        <span className="nome-domanda">Livello di attenzione</span>
        <div className="farmaco-livelli" role="radiogroup">
          {([0, 1, 2] as LivelloAttenzione[]).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={s.livello === l}
              className={`farmaco-livello-scelta livello-${l}${s.livello === l ? ' attivo' : ''}`}
              onClick={() => imposta({ livello: l })}
            >
              <span className={`farmaco-livello livello-${l}`} /> {NOMI_LIVELLO[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="farmaco-campo">
        <span className="nome-domanda">Etichette</span>
        <div className="farmaco-etichette-scelta">
          {etichette.length === 0 && <span className="hint">Nessuna etichetta: si scrivono in Configurazione → Farmaci.</span>}
          {etichette.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={s.etichette.includes(e.id)}
              className={`farmaco-etichetta${s.etichette.includes(e.id) ? ' attiva' : ''}`}
              onClick={() => scambia(e.id)}
            >
              {e.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row-2">
        <label>
          Fonte
          <input value={s.fonte ?? ''} onChange={testo('fonte')} placeholder="es. RCP AIFA, linee guida…" />
        </label>
        <label>
          Ultima revisione
          <input type="date" value={s.data_revisione ?? ''} onChange={testo('data_revisione')} />
        </label>
      </div>

      <div className="farmaco-campo">
        <span className="nome-domanda">Stato</span>
        <div className="farmaco-stato">
          <button
            type="button"
            className={s.stato === 'bozza' ? 'attivo' : ''}
            aria-pressed={s.stato === 'bozza'}
            onClick={() => imposta({ stato: 'bozza' })}
          >
            Bozza da verificare
          </button>
          <button
            type="button"
            className={s.stato === 'validata' ? 'attivo' : ''}
            aria-pressed={s.stato === 'validata'}
            onClick={() => imposta({ stato: 'validata' })}
          >
            Validata da me
          </button>
        </div>
      </div>

      <div className="modal-actions">
        <button onClick={onAnnulla}>Annulla</button>
        <button className="primary" onClick={() => void salva()} disabled={inCorso || !s.principio_attivo.trim()}>
          Salva
        </button>
      </div>
    </Modale>
  )
}
