import { useEffect, useState } from 'react'
import { intervalloTesto, VOCI, type DoseModello } from '../../../shared/dose'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'
import Aiuto from './Aiuto'
import Tendina from './Tendina'
import { PillVoce } from './dose/comune'

// La dose di una fase: si sceglie un modello, i numeri non si riscrivono. Il
// modello si cambia in Libreria → Dosi, dove si vedono anche tutte le fasi
// insieme.
export default function DoseFaseTab({ faseId }: { faseId: number }): React.JSX.Element {
  const [modelli, setModelli] = useState<DoseModello[]>([])
  const [scelto, setScelto] = useState<number | null>(null)

  useEffect(() => {
    void Promise.all([window.api.dose.modelli(), window.api.dose.modelloFase(faseId)]).then(
      ([elenco, suo]) => {
        setModelli(elenco)
        setScelto(suo?.id ?? null)
      },
      (e) => toastErrore(errMsg(e))
    )
  }, [faseId])

  const scegli = async (id: number | null): Promise<void> => {
    try {
      await window.api.dose.impostaModelloFase(faseId, id)
      setScelto(id)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const modello = modelli.find((m) => m.id === scelto) ?? null

  return (
    <div>
      <h3>
        Dose della fase
        <Aiuto testo="Scegli un modello: in seduta una riga sopra agli esercizi conta quello che metti e segnala solo ciò che manca al minimo. Senza modello si conta e basta. I numeri dei modelli si cambiano in Libreria esercizi → Dosi." />
      </h3>
      <label className="compila-data">
        Modello di dose
        <Tendina className="tendina-modello" value={scelto ?? ''} onChange={(e) => void scegli(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Nessun modello</option>
          {modelli.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Tendina>
      </label>
      {modello && <RiassuntoModello modello={modello} />}
    </div>
  )
}

// Cosa chiede il modello, in sola lettura.
export function RiassuntoModello({ modello }: { modello: DoseModello }): React.JSX.Element {
  const voci = VOCI.map((info) => ({ info, v: modello.voci.find((x) => x.voce === info.voce) })).filter(
    (x) => x.v != null
  )
  if (voci.length === 0) return <p className="hint">Il modello è vuoto: compilalo in Libreria esercizi → Dosi.</p>
  return (
    <>
      <table className="tabella-dose">
        <thead>
          <tr>
            <th>Voce</th>
            <th>Per seduta</th>
            <th>A settimana</th>
            <th>Indicazione</th>
          </tr>
        </thead>
        <tbody>
          {voci.map(({ info, v }) => {
            const dose = intervalloTesto(v!.minimo, v!.massimo)
            return (
              <tr key={info.voce}>
                <td>
                  <PillVoce voce={info.voce} />
                </td>
                <td>
                  {dose ? (
                    `${dose} ${info.unita}${info.perMuscolo ? '/muscolo' : ''}`
                  ) : (
                    <span className="hint">si conta soltanto</span>
                  )}
                </td>
                <td>{intervalloTesto(v!.volte_min, v!.volte_max)}</td>
                <td className="hint">{v!.indicazione}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {modello.alternativa === 1 && (
        <p className="hint">Potenza e pliometria intensiva sono alternative: ne basta una.</p>
      )}
    </>
  )
}
