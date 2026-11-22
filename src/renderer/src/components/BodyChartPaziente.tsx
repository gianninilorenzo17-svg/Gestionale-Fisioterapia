import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import type { BodyChartRiepilogo, PazienteDettaglio } from '../../../shared/types'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg, formatData, oggiIso } from '../lib'
import BodyChartEditor from './BodyChartEditor'

// Le body chart del paziente: dove fa male, disegnato sul corpo. Stavano dentro
// l'Anamnesi, dietro a un'icona; nella Clinica hanno una parte loro, perche' si
// cercano spesso e si vede subito quante ce ne sono.
export default function BodyChartPaziente({
  paziente,
  onCambiato
}: {
  paziente: PazienteDettaglio
  // avvisa la scheda quando se ne crea o se ne toglie una (per la nota nell'elenco)
  onCambiato?: () => void
}): React.JSX.Element {
  const [charts, setCharts] = useState<BodyChartRiepilogo[]>([])
  const [aperta, setAperta] = useState<{ id: number; soloLettura: boolean } | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      setCharts(await window.api.bodyChart.list(paziente.id))
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [paziente.id])

  useEffect(() => {
    void load()
  }, [load])

  // La riga nasce subito perche' l'editor lavora su una body chart esistente,
  // ma se si chiude senza salvare niente viene tolta: un clic per sbaglio non
  // deve lasciare schede vuote da ripulire.
  const appenaCreata = useRef<number | null>(null)

  const nuova = async (): Promise<void> => {
    try {
      const id = await window.api.bodyChart.create(paziente.id, oggiIso(), 'corpo')
      appenaCreata.current = id
      await load()
      setAperta({ id, soloLettura: false })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (c: BodyChartRiepilogo): Promise<void> => {
    if (!(await chiedi(`Eliminare la body chart del ${formatData(c.data)}?`))) return
    try {
      await window.api.bodyChart.remove(c.id)
      await load()
      onCambiato?.()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>Body chart</h3>
        <button className="primary" title="Nuova body chart" onClick={() => void nuova()}>
          <Plus size={17} /> Nuova
        </button>
      </div>

      {charts.length === 0 ? (
        <p className="hint">
          Nessuna body chart: premi «Nuova» per segnare sul corpo dove fa male.
        </p>
      ) : (
        <ul className="sedute-list">
          {charts.map((c) => (
            <li key={c.id}>
              <div className="seduta-info">
                <span className="seduta-data">
                  {c.tipo === 'piede' ? 'Body chart piede' : 'Body chart'} · {formatData(c.data)}
                </span>
                {c.note && <span className="seduta-obiettivi">{c.note}</span>}
              </div>
              <span className="row-actions">
                <button
                  title="Anteprima"
                  onClick={() => setAperta({ id: c.id, soloLettura: true })}
                >
                  <Eye size={18} />
                </button>
                <button
                  title="Modifica"
                  onClick={() => setAperta({ id: c.id, soloLettura: false })}
                >
                  <Pencil size={18} />
                </button>
                <button className="danger" title="Elimina" onClick={() => void elimina(c)}>
                  <Trash2 size={18} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {aperta && (
        <BodyChartEditor
          key={aperta.id}
          chartId={aperta.id}
          soloLettura={aperta.soloLettura}
          onChiudi={(salvata) => {
            const daTogliere = !salvata ? appenaCreata.current : null
            appenaCreata.current = null
            setAperta(null)
            if (daTogliere != null) {
              void window.api.bodyChart.remove(daTogliere).then(load)
            } else if (salvata) {
              void load().then(() => onCambiato?.())
            }
          }}
        />
      )}
    </section>
  )
}
