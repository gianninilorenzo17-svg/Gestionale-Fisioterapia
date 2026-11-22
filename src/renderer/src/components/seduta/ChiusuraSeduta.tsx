import type { Segno, StatoProgressione } from '../../../../shared/types'
import type { StatoSalvataggio } from '../../salvataggio'
import type { CampiSeduta } from './modello'
import EsitiProgressioni from './EsitiProgressioni'

// Da 0 a 10: la scala che si usa a voce con il paziente.
const VOTI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface Props {
  campi: CampiSeduta
  onCambia: (p: Partial<CampiSeduta>) => void
  segni: Segno[]
  // le progressioni che hanno un esercizio in questa seduta (gia' filtrate: se
  // la seduta e' nel futuro non ce ne sono)
  progressioni: StatoProgressione[]
  // la seduta e' nel futuro e ha esercizi di progressione: l'esito si segna dopo
  esitoRimandato: boolean
  totaleEsercizi: number
  salvataggio: { stato: StatoSalvataggio; errore: string | null }
  onSalva: () => void
}

// In fondo alla seduta: come e' andata (dolore, sforzo, i segni di
// riferimento), le note, e di nuovo i pulsanti per salvare.
export default function ChiusuraSeduta({
  campi,
  onCambia,
  segni,
  progressioni,
  esitoRimandato,
  salvataggio,
  onSalva
}: Props): React.JSX.Element {
  const voti = (valore: string, campo: 'dolore' | 'sforzo'): React.JSX.Element => (
    <div className="voti" role="group">
      {VOTI.map((n) => (
        <button
          key={n}
          type="button"
          className={valore === String(n) ? 'voto attivo' : 'voto'}
          aria-pressed={valore === String(n)}
          // un secondo clic sul voto scelto lo toglie: restano vuoti se non li si chiede
          onClick={() => onCambia({ [campo]: valore === String(n) ? '' : String(n) })}
        >
          {n}
        </button>
      ))}
    </div>
  )
  return (
    <section className="card fine-seduta">
      <div className="striscia-titolo">
        <span>Fine seduta</span>
      </div>
      <div className="fine-colonne">
        <div className="fine-sx fine-bianca">
          <div className="fine-voto">
            <span className="nome-percepito">
              Dolore
            </span>
            {voti(campi.dolore, 'dolore')}
          </div>
          <div className="fine-voto">
            <span className="nome-percepito">
              Sforzo percepito
            </span>
            {voti(campi.sforzo, 'sforzo')}
          </div>
          {/* I segni di riferimento di questo paziente: compaiono solo se ne hai
              scelti, dalla scheda Clinica. */}
          {segni.length > 0 && (
            <div className="riga-percepito">
              {segni.map((g) => (
                <label key={g.id} className="field campo-percepito">
                  <span className="nome-percepito">
                    {g.nome}
                    {g.unita && <span className="unita-segno">{g.unita}</span>}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={campi.misure[g.id] ?? ''}
                    onChange={(e) => onCambia({ misure: { ...campi.misure, [g.id]: e.target.value } })}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="fine-dx fine-bianca">
          <EsitiProgressioni
            stati={progressioni}
            rimandato={esitoRimandato}
            esiti={campi.esiti}
            onCambia={(esiti) => onCambia({ esiti })}
          />
        </div>
      </div>
      <label className="field note-seduta fine-note">
        Note
        <textarea
          rows={2}
          className="cresce"
          value={campi.note}
          placeholder="Osservazioni generali, cose da riprendere la prossima volta…"
          onChange={(e) => onCambia({ note: e.target.value })}
        />
      </label>
      <div className="modal-actions">
        <button className="primary" disabled={salvataggio.stato === 'salvo'} onClick={onSalva}>
          Salva seduta
        </button>
      </div>
    </section>
  )
}
