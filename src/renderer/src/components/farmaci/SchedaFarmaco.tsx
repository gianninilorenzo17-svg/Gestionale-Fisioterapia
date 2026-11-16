import { useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import {
  NOMI_LIVELLO,
  type FarmacoScheda,
  type FarmacoSchedaInput,
  type RefFarmaco
} from '../../../../shared/farmaci'
import Modale from '../Modale'
import CampoSuggerimenti from '../CampoSuggerimenti'
import { toast, toastErrore } from '../Toast'
import { errMsg, formatData } from '../../lib'
import { useEsc } from './useEsc'
import { invalidaFarmaci, useFarmaci, type DatiFarmaci } from '../../farmaci'
import { AvvisoBozza, PuntoLivello } from './BollaFarmaco'
import ModificaScheda, { comeInput, schedaVuota } from './ModificaScheda'

// La scheda completa di un farmaco, aperta da qualunque punto del programma
// (un farmaco sottolineato nell'anamnesi, uno della lista del paziente). E' una
// sola finestra montata una volta in App: chi vuole aprirla chiama
// apriSchedaFarmaco(). E' solo consultazione: per correggere c'e' «Modifica».
type Richiesta =
  | { tipo: 'schede'; refs: RefFarmaco[] }
  | { tipo: 'collega'; testo: string }

let apri: ((r: Richiesta) => void) | null = null

export function apriSchedaFarmaco(refs: RefFarmaco[]): void {
  apri?.({ tipo: 'schede', refs })
}

// Un nome che l'app non conosce: si collega a un principio attivo o si crea la scheda.
export function apriCollegamentoFarmaco(testo: string): void {
  apri?.({ tipo: 'collega', testo })
}

export default function SchedaFarmacoHost(): React.JSX.Element | null {
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null)
  const dati = useFarmaci()
  useEffect(() => {
    apri = setRichiesta
    return () => {
      apri = null
    }
  }, [])
  if (!richiesta || !dati) return null
  const chiudi = (): void => setRichiesta(null)
  return richiesta.tipo === 'schede' ? (
    <VistaSchede refs={richiesta.refs} dati={dati} onChiudi={chiudi} />
  ) : (
    <CollegaNome testo={richiesta.testo} dati={dati} onChiudi={chiudi} />
  )
}

function VistaSchede({
  refs,
  dati,
  onChiudi
}: {
  refs: RefFarmaco[]
  dati: DatiFarmaci
  onChiudi: () => void
}): React.JSX.Element {
  const [modifica, setModifica] = useState<FarmacoSchedaInput | null>(null)
  // con il modulo di modifica aperto, Esc lo chiude lui
  useEsc(onChiudi, modifica == null)

  if (modifica) {
    return (
      <ModificaScheda
        iniziale={modifica}
        etichette={dati.indice.etichette}
        onAnnulla={() => setModifica(null)}
        onFatto={() => {
          setModifica(null)
          onChiudi()
        }}
      />
    )
  }
  return (
    <Modale className="modal-lg modale-farmaco" onConferma={onChiudi}>
      {refs.map((r, i) => {
        const scheda = r.schedaId != null ? dati.schedaPerId.get(r.schedaId) : undefined
        return scheda ? (
          <Scheda key={scheda.id} s={scheda} dati={dati} onModifica={() => setModifica(comeInput(scheda))} />
        ) : (
          <div key={`${r.principio}-${i}`} className="farmaco-scheda">
            <h3>{r.principio}</h3>
            <p className="hint">Per questo principio attivo non c’è ancora una scheda.</p>
            <button className="btn-piccolo" onClick={() => setModifica(schedaVuota(r.principio))}>
              <Plus size={14} /> Crea la scheda
            </button>
          </div>
        )
      })}
      <div className="modal-actions">
        <button className="primary" onClick={onChiudi}>
          Chiudi
        </button>
      </div>
    </Modale>
  )
}

function Scheda({
  s,
  dati,
  onModifica
}: {
  s: FarmacoScheda
  dati: DatiFarmaci
  onModifica: () => void
}): React.JSX.Element {
  const etichette = s.etichette
    .map((id) => dati.indice.etichette.find((e) => e.id === id)?.nome)
    .filter((n): n is string => !!n)
  return (
    <div className="farmaco-scheda">
      <div className="card-header-row">
        <h3>
          <PuntoLivello livello={s.livello} /> {s.principio_attivo}
        </h3>
        <button className="btn-piccolo" onClick={onModifica}>
          <Pencil size={14} /> Modifica
        </button>
      </div>
      {s.stato === 'bozza' && (
        <div>
          <AvvisoBozza />
        </div>
      )}
      <div className="farmaco-meta">
        {s.classe && <span>{s.classe}</span>}
        <span className={`bolla-farmaco-livello livello-${s.livello}`}>{NOMI_LIVELLO[s.livello]}</span>
      </div>
      {etichette.length > 0 && (
        <div className="farmaco-etichette-scelta">
          {etichette.map((n) => (
            <span key={n} className="farmaco-etichetta attiva sola-lettura">
              {n}
            </span>
          ))}
        </div>
      )}
      {s.usi && <Blocco titolo="A cosa serve" testo={s.usi} />}
      {s.info_fisio && <Blocco titolo="Informazioni per la fisioterapia" testo={s.info_fisio} />}
      {s.avvertenze && <Blocco titolo="Avvertenze" testo={s.avvertenze} />}
      <p className="hint farmaco-fonte">
        {s.fonte ? `Fonte: ${s.fonte}. ` : 'Fonte non indicata. '}
        Ultima revisione: {formatData(s.data_revisione)} ·{' '}
        {s.stato === 'validata' ? 'validata da te' : 'bozza da verificare'}
      </p>
    </div>
  )
}

function Blocco({ titolo, testo }: { titolo: string; testo: string }): React.JSX.Element {
  return (
    <div className="farmaco-blocco">
      <div className="sotto-titolo">{titolo}</div>
      <p>{testo}</p>
    </div>
  )
}

// «X = principio attivo Y»: l'app non conosce il nome, lo si insegna. Il testo
// del paziente non cambia: si collega solo il nome.
function CollegaNome({
  testo,
  dati,
  onChiudi
}: {
  testo: string
  dati: DatiFarmaci
  onChiudi: () => void
}): React.JSX.Element {
  const [scelto, setScelto] = useState('')
  const [nuova, setNuova] = useState<FarmacoSchedaInput | null>(null)
  useEsc(onChiudi, nuova == null)
  const principi = dati.indice.schede.map((s) => s.principio_attivo)
  const scheda = dati.indice.schede.find((s) => s.principio_attivo.toLowerCase() === scelto.trim().toLowerCase())

  const collega = async (): Promise<void> => {
    if (!scheda) {
      toastErrore('Scegli un principio attivo che ha già la scheda, oppure crea una scheda nuova.')
      return
    }
    try {
      await window.api.farmaci.collega(testo, scheda.id)
      invalidaFarmaci()
      toast(`${testo} = ${scheda.principio_attivo}`)
      onChiudi()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  if (nuova) {
    return (
      <ModificaScheda
        iniziale={nuova}
        etichette={dati.indice.etichette}
        onAnnulla={() => setNuova(null)}
        onFatto={async (id) => {
          // se la scheda ha un nome diverso da quello scritto, il nome si collega
          try {
            await window.api.farmaci.collega(testo, id)
          } catch {
            // il collegamento e' un di piu': la scheda e' gia' salvata
          }
          invalidaFarmaci()
          onChiudi()
        }}
      />
    )
  }
  return (
    <Modale className="modale-farmaco" onConferma={() => void collega()}>
      <h3>«{testo}» non è nell’elenco</h3>
      <p className="hint">
        Resta scritto com’è. Se vuoi che l’app lo riconosca, collegalo al suo principio attivo o crea la scheda.
      </p>
      <label>
        È il principio attivo
        <CampoSuggerimenti value={scelto} onChange={setScelto} suggerimenti={principi} placeholder="es. Ibuprofene" />
      </label>
      <div className="modal-actions">
        <button onClick={() => setNuova(schedaVuota(testo.charAt(0).toUpperCase() + testo.slice(1)))}>
          <Plus size={14} /> Crea una scheda nuova
        </button>
        <button onClick={onChiudi}>Annulla</button>
        <button className="primary" onClick={() => void collega()} disabled={!scheda}>
          Collega
        </button>
      </div>
    </Modale>
  )
}
