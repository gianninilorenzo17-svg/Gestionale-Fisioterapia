import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Eye, FileClock, Pencil } from 'lucide-react'
import type { PazienteDettaglio, SezioneCartella } from '../../../shared/types'
import { toastErrore } from './Toast'
import { errMsg } from '../lib'
import IconaObiettivi from './IconaObiettivi'
import AnamnesiProssima from './AnamnesiProssima'
import AnamnesiRemota from './AnamnesiRemota'
import ObiettiviTerapeutici from './ObiettiviTerapeutici'

function RigaRiassunto({
  nome,
  testo,
  onApri,
  onAnteprima
}: {
  nome: string
  testo: string
  onApri: () => void
  onAnteprima?: () => void
}): React.JSX.Element {
  return (
    <li>
      <div className="seduta-info">
        <span className="seduta-data">{nome}</span>
        <span className="seduta-meta riga-riassunto">{testo || 'Non compilata'}</span>
      </div>
      <span className="row-actions">
        {onAnteprima && testo && (
          <button
            title="Anteprima"
            aria-label={`Anteprima di ${nome}`}
            onClick={onAnteprima}
          >
            <Eye size={18} />
          </button>
        )}
        <button aria-label={`Apri ${nome}`} onClick={onApri}>
          <Pencil size={18} />
        </button>
      </span>
    </li>
  )
}

// Raccolta anamnestica. Ogni parte si compila per conto suo, in qualunque
// ordine: non c'e' una sequenza obbligata da seguire durante il colloquio.
export default function AnamnesiPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [prossima, setProssima] = useState(false)
  const [remota, setRemota] = useState(false)
  const [obiettivi, setObiettivi] = useState(false)
  const [riassunti, setRiassunti] = useState({ prossima: '', remota: '', obiettivi: '' })

  // Una riga di sintesi per ciascuna scheda: si legge senza aprirla.
  const caricaRiassunti = useCallback(async (): Promise<void> => {
    try {
      const [p, r, o] = await Promise.all([
        window.api.anamnesi.get(paziente.id),
        window.api.anamnesi.remota(paziente.id),
        window.api.obiettiviTerapeutici.list(paziente.id)
      ])
      const parti = (voci: [string, string | null | undefined][]): string =>
        voci
          .filter(([, v]) => v && v.trim())
          .map(([n, v]) => `${n}: ${v!.trim()}`)
          .join(' · ')
      setRiassunti({
        prossima: p?.motivo_consulto?.trim() ?? '',
        remota: parti([
          ['Patologie', r?.patologie],
          ['Traumi', r?.traumi],
          ['Interventi', r?.interventi],
          ['Riabilitazioni', r?.riabilitazioni]
        ]),
        obiettivi: o.map((x) => x.testo).join(' · ')
      })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [paziente.id])

  useEffect(() => {
    void caricaRiassunti()
  }, [caricaRiassunti])

  // L'anteprima di una scheda e' la sua sezione della cartella, da sola.
  const anteprima = async (sezione: SezioneCartella): Promise<void> => {
    try {
      await window.api.esporta.anteprimaCartella(paziente.id, [sezione])
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      {/* I pulsanti delle sotto-sezioni stanno sulla riga del titolo; sotto, le
          schede riassumono quello che c'e' dentro. */}
      <div className="card-header-row">
        <h3>Anamnesi</h3>
        <div className="sotto-sezioni">
        <button
          className="btn-sagoma"
          title="Anamnesi prossima"
          onClick={() => setProssima(true)}
        >
          <ClipboardList size={24} />
        </button>
        <button className="btn-sagoma" title="Anamnesi remota" onClick={() => setRemota(true)}>
          {/* Una cartella con l'orologio: sono i fatti clinici di prima, non
              una cronologia di modifiche come diceva la freccia all'indietro. */}
          <FileClock size={24} />
        </button>
        <button
          className="btn-sagoma"
          title="Obiettivi terapeutici"
          onClick={() => setObiettivi(true)}
        >
          <IconaObiettivi size={24} />
        </button>
        </div>
      </div>

      {/* Le schede vuote non compaiono: si aprono dai pulsanti in alto. */}
      {(riassunti.prossima || riassunti.remota || riassunti.obiettivi) && (
        <ul className="sedute-list">
          {riassunti.prossima && (
            <RigaRiassunto
              nome="Anamnesi prossima"
              testo={riassunti.prossima}
              onApri={() => setProssima(true)}
              onAnteprima={() => void anteprima('anamnesi')}
            />
          )}
          {riassunti.remota && (
            <RigaRiassunto
              nome="Anamnesi remota"
              testo={riassunti.remota}
              onApri={() => setRemota(true)}
              onAnteprima={() => void anteprima('remota')}
            />
          )}
          {riassunti.obiettivi && (
            <RigaRiassunto
              nome="Obiettivi terapeutici"
              testo={riassunti.obiettivi}
              onApri={() => setObiettivi(true)}
              onAnteprima={() => void anteprima('obiettivi')}
            />
          )}
        </ul>
      )}

      {prossima && (
        <AnamnesiProssima
          pazienteId={paziente.id}
          onChiudi={() => {
            setProssima(false)
            void caricaRiassunti()
          }}
        />
      )}

      {remota && (
        <AnamnesiRemota
          pazienteId={paziente.id}
          onChiudi={() => {
            setRemota(false)
            void caricaRiassunti()
          }}
        />
      )}

      {obiettivi && (
        <ObiettiviTerapeutici
          pazienteId={paziente.id}
          onChiudi={() => {
            setObiettivi(false)
            void caricaRiassunti()
          }}
        />
      )}

    </section>
  )
}
