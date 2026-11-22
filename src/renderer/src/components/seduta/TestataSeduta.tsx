import Tendina from '../Tendina'
import CampoSuggerimenti from '../CampoSuggerimenti'
import type { Fase, PazienteDettaglio } from '../../../../shared/types'
import type { StatoSalvataggio } from '../../salvataggio'
import type { CampiSeduta } from './modello'

interface Props {
  paziente: PazienteDettaglio
  nuova: boolean
  copiata: boolean
  campi: CampiSeduta
  onCambia: (p: Partial<CampiSeduta>) => void
  // le fasi del percorso al campo, se la patologia ce l'ha
  fasiCampo: Fase[]
  alCampo: boolean
  onCambiaFase: (fase: number | null) => void
  focusUsati: string[]
  salvataggio: { stato: StatoSalvataggio; errore: string | null }
  onAnnulla: () => void
  onSalva: () => void
}

// In cima alla seduta: di chi e', che fase, il giorno e l'ora, il focus, e i
// pulsanti per salvare o uscire.
export default function TestataSeduta({
  paziente,
  nuova,
  copiata,
  campi,
  onCambia,
  fasiCampo,
  alCampo,
  onCambiaFase,
  focusUsati,
  salvataggio,
  onAnnulla,
  onSalva
}: Props): React.JSX.Element {
  const st = salvataggio.stato
  const pallino = st === 'errore' ? 'errore' : st === 'modificato' || st === 'salvo' ? 'giallo' : 'verde'
  const testoPallino =
    st === 'errore'
      ? `Non salvato${salvataggio.errore ? `: ${salvataggio.errore}` : ''}`
      : st === 'modificato'
        ? 'Modifiche non salvate'
        : st === 'salvo'
          ? 'Salvataggio…'
          : 'Tutto salvato'
  return (
    <header className="page-header builder-header testata-fissa">
      <div className="testata-chi">
        {/* Il nome del paziente riporta alla sua scheda: da qui ci si torna di
            continuo, e prima l'unica strada era "Annulla", che sembra buttare
            via il lavoro. Se c'e' qualcosa di non salvato chiede, come
            "Annulla". */}
        <h2>
          <button className="briciola nome-nel-titolo" title="Torna alla scheda del paziente" onClick={onAnnulla}>
            {paziente.nome} {paziente.cognome}
          </button>
          <span className="testata-sep">–</span>
        </h2>
        <p className="testata-fase">
          {[paziente.patologia_nome, campi.faseNome ? `(${/^fase/i.test(campi.faseNome) ? campi.faseNome : `fase ${campi.faseNome}`})` : '(nessuna fase impostata)']
            .filter(Boolean)
            .join(' ')}
          {copiata && ' · contenuti copiati da una seduta precedente'}
        </p>
        {/* Il pallino in alto a destra: giallo = c'e' qualcosa da salvare,
            verde = tutto salvato, rosso = il salvataggio non e' riuscito. */}
        <span
          className={`pallino-salvataggio ${pallino}`}
          role="status"
          aria-live="polite"
          title={testoPallino}
        />
      </div>
      <div className="builder-header-actions">
        <label className="field data-field">
          Data
          <input type="date" value={campi.data} onChange={(e) => onCambia({ data: e.target.value })} />
        </label>
        {/* Facoltativo: serve a sapere a che ora viene, e a ordinare la
            settimana per appuntamento invece che per cognome. */}
        <label className="field ora-field">
          Ora
          <input type="time" value={campi.ora} onChange={(e) => onCambia({ ora: e.target.value })} />
        </label>
        {fasiCampo.length > 0 && (
          <div className="scelta-binario">
            <button className={alCampo ? '' : 'scelta-attiva'} onClick={() => onCambiaFase(paziente.fase_corrente_id)}>
              In palestra
            </button>
            <button className={alCampo ? 'scelta-attiva' : ''} onClick={() => onCambiaFase(fasiCampo[0].id)}>
              Al campo
            </button>
            {alCampo && fasiCampo.length > 1 && (
              <Tendina
                value={campi.faseId ?? 0}
                title="Quale programma da campo"
                onChange={(e) => onCambiaFase(Number(e.target.value))}
              >
                {fasiCampo.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Tendina>
            )}
          </div>
        )}
        {/* Il focus della giornata: due sedute della stessa fase possono essere
            due cose diverse, e nell'elenco si distinguono da qui. Si scrive a
            mano, ma quelli gia' usati si ripropongono. */}
        <label className="field focus-field">
          Focus
          <CampoSuggerimenti
            placeholder="es. corsa"
            value={campi.focus}
            onChange={(v) => onCambia({ focus: v })}
            suggerimenti={focusUsati}
          />
        </label>
        <button className="primary" disabled={salvataggio.stato === 'salvo'} onClick={onSalva}>
          Salva
        </button>
      </div>
    </header>
  )
}
