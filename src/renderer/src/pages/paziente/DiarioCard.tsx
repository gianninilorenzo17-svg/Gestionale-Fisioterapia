import { useEffect, useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import type { PazienteDettaglio, SedutaRiepilogo } from '../../../../shared/types'
import { toast, toastErrore } from '../../components/Toast'
import { chiedi } from '../../components/Conferma'
import Modale from '../../components/Modale'
import { errMsg, formatData, giornoSettimanaBreve, maiuscola, oggiIso } from '../../lib'
import StatoVuoto from '../../components/StatoVuoto'
import { SchedaIllustrata } from './SchedaIllustrata'
import SedutaAzioni from '../../components/SedutaAzioni'

// Il colore del pallino accanto al dolore: lo si legge senza leggere il numero
const coloreDolore = (d: number): string =>
  d <= 2 ? 'var(--success)' : d <= 4 ? 'var(--attenzione)' : 'var(--danger)'

// "Novembre 2026"
const nomeMese = (iso: string): string => {
  const [a, m] = iso.split('-').map(Number)
  return maiuscola(new Date(a, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }))
}

export function DiarioCard({
  paziente,
  onNuova,
  onApri,
  onDuplica
}: {
  paziente: PazienteDettaglio
  onNuova: () => void
  onApri: (id: number) => void
  onDuplica: (id: number) => void
}): React.JSX.Element {
  const [sedute, setSedute] = useState<SedutaRiepilogo[]>([])
  const [periodo, setPeriodo] = useState<{ dal: string; al: string } | null>(null)
  const [anteprima, setAnteprima] = useState<number | null>(null)

  // Prima che le sedute arrivino l'elenco e' vuoto per forza: senza questo
  // si vedrebbe per un attimo "Nessuna seduta ancora" e poi tutto si sposta.
  const [caricate, setCaricate] = useState(false)

  const load = async (): Promise<void> => {
    setSedute(await window.api.sedute.list(paziente.id))
    setCaricate(true)
  }

  // Una seduta e' "programmata" se la sua data deve ancora arrivare: nessuno
  // stato da mettere a mano, la data basta. Le programmate si leggono dalla piu'
  // vicina, le svolte dalla piu' recente.
  const oggi = oggiIso()
  // Il lavoro al campo va in parallelo a quello in palestra: sta in un elenco
  // suo, che compare solo per chi ce l'ha. Dentro a ognuno dei due, le
  // programmate stanno sopra alle svolte.
  const inPalestra = sedute.filter((s) => s.fase_campo !== 1)
  const alCampo = sedute.filter((s) => s.fase_campo === 1)
  const programmate = inPalestra
    .filter((s) => s.data > oggi)
    .sort((a, b) => a.data.localeCompare(b.data))
  const fatte = inPalestra.filter((s) => s.data <= oggi)
  const campoProgrammate = alCampo
    .filter((s) => s.data > oggi)
    .sort((a, b) => a.data.localeCompare(b.data))
  const campoFatte = alCampo.filter((s) => s.data <= oggi)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paziente.id])

  const elimina = async (s: SedutaRiepilogo): Promise<void> => {
    if (!(await chiedi(`Eliminare la seduta del ${formatData(s.data)}?`))) return
    try {
      await window.api.sedute.remove(s.id)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const esportaSingola = async (
    id: number,
    formato: 'pdf' | 'docx',
    illustrata = false
  ): Promise<void> => {
    try {
      const path = await window.api.esporta.seduta(id, formato, illustrata)
      if (path) toast(`Seduta esportata${formato === 'pdf' ? ' in PDF' : ' in Word'}.`)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const esportaPeriodo = async (formato: 'pdf' | 'docx'): Promise<void> => {
    if (!periodo) return
    if (periodo.dal > periodo.al) {
      toastErrore('Intervallo non valido: la data "dal" è successiva ad "al".')
      return
    }
    try {
      const path = await window.api.esporta.storico(paziente.id, periodo.dal, periodo.al, formato)
      if (path) {
        setPeriodo(null)
        toast('Storico esportato.')
      }
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // La riga di una seduta si disegna una volta sola: la usano l'elenco delle
  // svolte e quello delle programmate. Una riga sola: data, fase e argomento,
  // la nota (o il trattamento), il dolore. I pulsanti compaiono passandoci sopra
  // (o con la tastiera): sempre in vista appesantivano l'elenco.
  const riga = (s: SedutaRiepilogo, programmata: boolean): React.JSX.Element => {
    const trattamento = [s.tecniche_nomi, s.trattamento].filter(Boolean).join(' — ')
    const nota = s.note?.trim().replace(/\s+/g, ' ') ?? ''
    return (
      <li
        key={s.id}
        className={`d-riga${programmata ? ' programmata' : ''}`}
        title="Modifica la seduta"
        tabIndex={0}
        onClick={() => onApri(s.id)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && e.key === 'Enter') onApri(s.id)
        }}
      >
        <div className="d-data">
          <b>{giornoSettimanaBreve(s.data)}</b>
          <span>{formatData(s.data)}</span>
        </div>
        <div className="d-testo">
          <span className="d-pastiglie">
            <span className="d-pill fase">{s.fase_nome ?? 'Senza fase'}</span>
            {s.focus && <span className="d-pill focus">{s.focus}</span>}
          </span>
          {nota && <span className="d-nota">{nota}</span>}
          {trattamento && (
            <span className="d-trattamento">
              {nota ? '· ' : ''}
              {trattamento}
            </span>
          )}
        </div>
        <div className="d-dolore" title={s.dolore != null ? 'Dolore a fine seduta' : undefined}>
          {s.dolore != null && (
            <>
              <i style={{ background: coloreDolore(s.dolore) }} aria-hidden="true" />
              {s.dolore}/10
            </>
          )}
        </div>
        <SedutaAzioni
          sedutaId={s.id}
          titoloCopia="Nuova seduta partendo da questa"
          onCopia={() => onDuplica(s.id)}
          onElimina={() => void elimina(s)}
          onIllustrata={() => setAnteprima(s.id)}
          onScarica={(formato) => void esportaSingola(s.id, formato)}
        />
      </li>
    )
  }

  // Le svolte, dalla piu' recente: divise per mese, e una riga dice quando la
  // fase e' cambiata (sta fra l'ultima seduta della fase di prima e la prima
  // di quella nuova). Senza fase non si dice niente: sarebbe solo rumore.
  const elencoSvolte = (righe: SedutaRiepilogo[]): React.JSX.Element => {
    const voci: React.JSX.Element[] = []
    let mese = ''
    righe.forEach((s, i) => {
      const m = s.data.slice(0, 7)
      if (m !== mese) {
        mese = m
        voci.push(
          <li key={`m${m}`} className="d-mese" role="presentation">
            {nomeMese(s.data)}
          </li>
        )
      }
      voci.push(riga(s, false))
      const piuVecchia = righe[i + 1]
      if (piuVecchia && s.fase_nome && piuVecchia.fase_nome && s.fase_nome !== piuVecchia.fase_nome) {
        voci.push(
          <li key={`c${s.id}`} className="d-cambio" role="presentation">
            Passaggio a {s.fase_nome} · {formatData(s.data)}
          </li>
        )
      }
    })
    return <ul className="diario-righe">{voci}</ul>
  }

  return (
    <section className="card">
      <div className="card-header-row">
        {/* Il titolo e il pulsante "Nuova seduta" stanno gia' nella barra qui
            sopra: ripeterli dentro al riquadro era solo rumore. */}
        <h3>Sedute</h3>
        <span className="row-actions">
          {sedute.length > 0 && (
            <button
              onClick={() =>
                setPeriodo({ dal: sedute[sedute.length - 1].data, al: sedute[0].data })
              }
            >
              Esporta sedute
            </button>
          )}
        </span>
      </div>
      {/* Le sedute con la data di domani in poi sono quelle che hai preparato:
          stanno sopra, in ordine di quando toccano, cosi' si vede a colpo
          d'occhio cosa aspetta il paziente. */}
      {programmate.length > 0 && (
        <div className="blocco-programmate">
          <div className="sotto-titolo">Programmate</div>
          <ul className="diario-righe">{programmate.map((s) => riga(s, true))}</ul>
        </div>
      )}
      {!caricate ? null : fatte.length === 0 ? (
        programmate.length > 0 ? (
          <p className="hint">Nessuna seduta svolta finora.</p>
        ) : (
          <StatoVuoto
            icona={ClipboardList}
            titolo="Nessuna seduta ancora"
            testo="La prima si apre già sulla fase corrente del paziente."
            azione={{ etichetta: 'Nuova seduta', icona: Plus, onClick: onNuova }}
          />
        )
      ) : (
        elencoSvolte(fatte)
      )}

      {/* Il campo: un riquadro a parte, che c'e' solo per chi ha quel percorso
          (in pratica i crociati). Per tutti gli altri la scheda resta identica. */}
      {alCampo.length > 0 && (
        <div className="blocco-campo">
          <div className="sotto-titolo">Al campo</div>
          {campoProgrammate.length > 0 && (
            <ul className="diario-righe">{campoProgrammate.map((s) => riga(s, true))}</ul>
          )}
          {campoFatte.length > 0 && elencoSvolte(campoFatte)}
        </div>
      )}

      {periodo && (
        // Invio e clic fuori valgono come il pulsante "primary" (Esporta
        // PDF): non c'e' nulla da perdere, e' solo l'esportazione di un file.
        <Modale className="modal-sm" onConferma={() => void esportaPeriodo('pdf')}>
            <h3>Esporta storico sedute</h3>
            <div className="form-row-2">
              <label>
                Dal
                <input
                  type="date"
                  value={periodo.dal}
                  onChange={(e) => setPeriodo({ ...periodo, dal: e.target.value })}
                />
              </label>
              <label>
                Al
                <input
                  type="date"
                  value={periodo.al}
                  onChange={(e) => setPeriodo({ ...periodo, al: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setPeriodo(null)}>Annulla</button>
              <button onClick={() => void esportaPeriodo('docx')}>Esporta Word</button>
              <button className="primary" onClick={() => void esportaPeriodo('pdf')}>
                Esporta PDF
              </button>
            </div>
        </Modale>
      )}

      {anteprima != null && (
        <SchedaIllustrata
          sedutaId={anteprima}
          onClose={() => setAnteprima(null)}
          onScarica={() => void esportaSingola(anteprima, 'pdf', true)}
        />
      )}
    </section>
  )
}
