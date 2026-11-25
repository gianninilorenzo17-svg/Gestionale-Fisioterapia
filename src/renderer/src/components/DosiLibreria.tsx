import { useCallback, useEffect, useState } from 'react'
import { VOCI, type DoseModello, type Voce, type VoceModello } from '../../../shared/dose'
import type { FaseConModello } from '../../../shared/types'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'
import Aiuto from './Aiuto'
import CrudList from './CrudList'
import Tendina from './Tendina'
import { PillVoce } from './dose/comune'

// Libreria → Dosi: i modelli (dose per seduta e volte a settimana, con le
// indicazioni) e quale modello usa ogni fase.
export default function DosiLibreria(): React.JSX.Element {
  const [modelli, setModelli] = useState<DoseModello[]>([])
  const [fasi, setFasi] = useState<FaseConModello[]>([])
  const [selId, setSelId] = useState<number | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      const [m, f] = await Promise.all([window.api.dose.modelli(), window.api.dose.fasi()])
      setModelli(m)
      setFasi(f)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const sel = modelli.find((m) => m.id === selId) ?? modelli[0] ?? null

  const esegui = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
    await load()
  }

  const patologie = [...new Map(fasi.map((f) => [f.patologia_id, f.patologia_nome])).entries()]

  return (
    <>
      <section className="card">
        <div className="modelli-elenco">
          <CrudList
            title="Modelli"
            aiuto="La dose è per seduta, con quante volte a settimana. Una voce senza numeri si conta ma non si giudica."
            items={modelli}
            selectedId={sel?.id ?? null}
            onSelect={setSelId}
            onAdd={async (nome) => {
              setSelId(await window.api.dose.creaModello(nome))
              await load()
            }}
            onRename={async (id, nome) => {
              const m = modelli.find((x) => x.id === id)!
              await window.api.dose.salvaModello(id, { nome, alternativa: m.alternativa, voci: m.voci })
              await load()
            }}
            onDelete={async (id) => {
              await window.api.dose.eliminaModello(id)
              setSelId(null)
              await load()
            }}
            etichettaAggiungi="Nuovo modello"
            addPlaceholder="es. Mantenimento"
            emptyHint="Nessun modello."
          />
          {sel && (
            <TabellaModello
              // una tabella per modello: salvando non si ricrea, e il cursore
              // resta nella casella in cui si e' passati
              key={sel.id}
              modello={sel}
              onSalva={(m) => esegui(() => window.api.dose.salvaModello(sel.id, m))}
            />
          )}
        </div>
      </section>

      <section className="crud-list fasi-modello">
        <h3>
          Il modello di ogni fase
          <Aiuto testo="Una fase senza modello conta quello che metti in seduta ma non segnala niente." />
        </h3>
        {fasi.length === 0 && <p className="hint">Nessuna fase: si creano in Patologie e fasi.</p>}
        {patologie.map(([id, nome]) => (
          <div key={id}>
            <div className="sotto-titolo">{nome}</div>
            {fasi
              .filter((f) => f.patologia_id === id && f.campo !== 1)
              .map((f) => (
                <div className="riga-fase-modello" key={f.id}>
                  <span>{f.nome}</span>
                  <Tendina
                    className="tendina-modello"
                    title={`Modello di ${nome}, ${f.nome}`}
                    value={f.dose_modello_id ?? ''}
                    onChange={(e) =>
                      void esegui(() =>
                        window.api.dose.impostaModelloFase(f.id, e.target.value === '' ? null : Number(e.target.value))
                      )
                    }
                  >
                    <option value="">Nessun modello</option>
                    {modelli.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </Tendina>
                </div>
              ))}
          </div>
        ))}
      </section>
    </>
  )
}

type Campo = 'minimo' | 'massimo' | 'volte_min' | 'volte_max' | 'indicazione'
type Valori = Record<Voce, Record<Campo, string>>

const comeTesto = (n: number | string | null | undefined): string => (n == null ? '' : String(n))
const comeNumero = (t: string): number | null => (t.trim() === '' ? null : Number(t))

// Un modello: una riga per voce. Si salva uscendo da una casella.
function TabellaModello({
  modello,
  onSalva
}: {
  modello: DoseModello
  onSalva: (m: { nome: string; alternativa: 0 | 1; voci: VoceModello[] }) => Promise<void>
}): React.JSX.Element {
  const [valori, setValori] = useState<Valori>(
    () =>
      Object.fromEntries(
        VOCI.map(({ voce }) => {
          const v = modello.voci.find((x) => x.voce === voce)
          return [
            voce,
            {
              minimo: comeTesto(v?.minimo),
              massimo: comeTesto(v?.massimo),
              volte_min: comeTesto(v?.volte_min),
              volte_max: comeTesto(v?.volte_max),
              indicazione: comeTesto(v?.indicazione)
            }
          ]
        })
      ) as Valori
  )

  const voci = (): VoceModello[] =>
    VOCI.map(({ voce }) => ({
      voce,
      minimo: comeNumero(valori[voce].minimo),
      massimo: comeNumero(valori[voce].massimo),
      volte_min: comeNumero(valori[voce].volte_min),
      volte_max: comeNumero(valori[voce].volte_max),
      indicazione: valori[voce].indicazione.trim() || null
    }))

  // solo se e' cambiato qualcosa: passare di casella in casella non salva niente
  const salva = (alternativa: 0 | 1 = modello.alternativa): void => {
    const nuove = voci()
    const cambiate = nuove.some((n) => {
      const v = modello.voci.find((x) => x.voce === n.voce)
      return (['minimo', 'massimo', 'volte_min', 'volte_max', 'indicazione'] as const).some(
        (c) => (v?.[c] ?? null) !== n[c]
      )
    })
    if (cambiate || alternativa !== modello.alternativa) {
      void onSalva({ nome: modello.nome, alternativa, voci: nuove })
    }
  }

  const campoDi = (voce: Voce, campo: Campo, etichetta: string) => ({
    'aria-label': `${VOCI.find((v) => v.voce === voce)!.nome}, ${etichetta}`,
    value: valori[voce][campo],
    onChange: (e: { target: { value: string } }): void =>
      setValori((v) => ({ ...v, [voce]: { ...v[voce], [campo]: e.target.value } })),
    onBlur: () => salva()
  })
  const casella = (voce: Voce, campo: Campo, etichetta: string): React.JSX.Element => (
    <input type="number" min={0} {...campoDi(voce, campo, etichetta)} />
  )

  return (
    <section className="crud-list">
      <h3>{modello.nome}</h3>
      <table className="tabella-dose">
        <thead>
          <tr>
            <th>Voce</th>
            <th>Per seduta (da – a)</th>
            <th>A settimana</th>
            <th>Indicazione</th>
          </tr>
        </thead>
        <tbody>
          {VOCI.map((info) => (
            <tr key={info.voce}>
              <td>
                <PillVoce voce={info.voce} />
                <div className="hint">
                  {info.unita}
                  {info.perMuscolo ? ' per muscolo' : ' in tutto'}
                </div>
              </td>
              <td>
                <span className="intervallo-dose">
                  {casella(info.voce, 'minimo', 'per seduta da')}–{casella(info.voce, 'massimo', 'per seduta a')}
                </span>
              </td>
              <td>
                <span className="intervallo-dose">
                  {casella(info.voce, 'volte_min', 'volte da')}–{casella(info.voce, 'volte_max', 'volte a')}
                </span>
              </td>
              {/* si legge tutta: va a capo invece di tagliarsi */}
              <td className="cella-indicazione">
                <textarea className="indicazione" rows={1}{...campoDi(info.voce, 'indicazione', 'indicazione')} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="checkbox-inline alternativa-modello">
        <input type="checkbox" checked={modello.alternativa === 1} onChange={(e) => salva(e.target.checked ? 1 : 0)} />
        Potenza e pliometria intensiva sono alternative: ne basta una
      </label>
    </section>
  )
}
