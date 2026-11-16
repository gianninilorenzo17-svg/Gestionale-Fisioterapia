import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Plus, Trash2, X } from 'lucide-react'
import {
  normalizza,
  type FarmacoSchedaInput,
  type NomeCollegato,
  type StatoFarmaci
} from '../../../shared/farmaci'
import { toast, toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import CampoSuggerimenti from '../components/CampoSuggerimenti'
import CrudList from '../components/CrudList'
import Aiuto from '../components/Aiuto'
import ModificaScheda, { comeInput, schedaVuota } from '../components/farmaci/ModificaScheda'
import { AvvisoBozza, PuntoLivello } from '../components/farmaci/BollaFarmaco'
import { errMsg, formatData } from '../lib'
import { invalidaFarmaci, useFarmaci } from '../farmaci'

// Configurazione → Farmaci. Il database dei farmaci e' solo di consultazione:
// schede di riferimento (una per principio attivo), le etichette, i nomi
// collegati a mano e le parole da non sottolineare. Dati dei pazienti: nessuno.
export default function FarmaciPage(): React.JSX.Element {
  const dati = useFarmaci()
  const [stato, setStato] = useState<StatoFarmaci | null>(null)
  const [collegati, setCollegati] = useState<NomeCollegato[]>([])
  const [cerca, setCerca] = useState('')
  const [soloBozze, setSoloBozze] = useState(false)
  const [inModifica, setInModifica] = useState<FarmacoSchedaInput | null>(null)
  const [importando, setImportando] = useState(false)

  const caricaAltro = useCallback(async (): Promise<void> => {
    try {
      const [s, c] = await Promise.all([window.api.farmaci.stato(), window.api.farmaci.collegamenti()])
      setStato(s)
      setCollegati(c)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [])
  useEffect(() => {
    void caricaAltro()
  }, [caricaAltro])

  const dopoModifica = useCallback(async (): Promise<void> => {
    invalidaFarmaci()
    await caricaAltro()
  }, [caricaAltro])

  const schede = useMemo(() => {
    const q = normalizza(cerca.trim())
    return (dati?.indice.schede ?? []).filter(
      (s) =>
        (!soloBozze || s.stato === 'bozza') &&
        (q === '' || normalizza(`${s.principio_attivo} ${s.classe ?? ''}`).includes(q))
    )
  }, [dati, cerca, soloBozze])

  const elimina = async (id: number, nome: string): Promise<void> => {
    if (
      !(await chiedi({
        testo: `Elimino la scheda di ${nome}? I nomi collegati a mano a questa scheda si tolgono. I farmaci scritti nei pazienti restano come sono.`
      }))
    ) {
      return
    }
    try {
      await window.api.farmaci.eliminaScheda(id)
      await dopoModifica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const importa = async (): Promise<void> => {
    setImportando(true)
    try {
      const esito = await window.api.farmaci.importaAifa()
      if (esito) {
        toast(
          esito.nomiAggiunti > 0
            ? `Elenco AIFA unito: ${esito.nomiAggiunti} nomi nuovi (${esito.principi} principi attivi)`
            : 'Elenco AIFA già aggiornato: nessun nome nuovo'
        )
        await dopoModifica()
      }
    } catch (e) {
      toastErrore(errMsg(e))
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="page step-flow">
      <header className="page-header">
        <h2>
          Farmaci
          <Aiuto testo="Schede di riferimento per riconoscere i farmaci nell'anamnesi e vedere cosa sono. Servono a consultare: non danno consigli e non dicono cosa fare." />
        </h2>
      </header>

      <div className="farmaci-stato">
        <span>
          {stato ? (
            <>
              {stato.schede} schede · {stato.nomiAifa} nomi dall’elenco AIFA
              {stato.aifaImportatoIl ? ` (importato il ${formatData(stato.aifaImportatoIl.slice(0, 10))})` : ' (non ancora importato)'}
            </>
          ) : (
            'Caricamento…'
          )}
        </span>
        <button className="btn-piccolo" onClick={() => void importa()} disabled={importando}>
          <Download size={14} /> Importa elenco
        </button>
      </div>
      <p className="hint farmaci-guida-aifa">
        Per riconoscere i nomi commerciali scarica il CSV dalla pagina «Liste di trasparenza» di AIFA (aifa.gov.it,
        «Lista farmaci equivalenti») e sceglilo qui. Non scarica niente da solo; un nuovo elenco si unisce al
        database senza toccare le tue schede e i tuoi collegamenti.
      </p>

      <div className="farmaci-barra">
        <input
          type="search"
          className="filtro-esercizi"
          placeholder="Cerca per principio attivo o classe"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
        />
        <label className="farmaci-solo-bozze">
          <input type="checkbox" checked={soloBozze} onChange={(e) => setSoloBozze(e.target.checked)} />
          Solo bozze da verificare
        </label>
        <button className="btn-aggiungi-lista" onClick={() => setInModifica(schedaVuota())}>
          <Plus size={15} /> Nuova scheda
        </button>
      </div>

      <ul className="farmaci-elenco">
        {schede.map((s) => (
          <li key={s.id}>
            <button className="farmaci-elenco-riga" onClick={() => setInModifica(comeInput(s))}>
              <PuntoLivello livello={s.livello} />
              <span className="farmaci-elenco-nome">{s.principio_attivo}</span>
              {s.classe && <span className="farmaci-elenco-classe">{s.classe}</span>}
              {s.stato === 'bozza' && <AvvisoBozza />}
            </button>
            <button
              className="btn-icona"
              aria-label={`Elimina la scheda di ${s.principio_attivo}`}
              title="Elimina"
              onClick={() => void elimina(s.id, s.principio_attivo)}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {dati && schede.length === 0 && (
          <li className="hint farmaci-vuoto">
            {dati.indice.schede.length === 0 ? 'Nessuna scheda: creane una con «Nuova scheda».' : 'Nessuna scheda trovata.'}
          </li>
        )}
      </ul>

      <details className="farmaci-sezione">
        <summary>Etichette</summary>
        <CrudList
          title=""
          items={(dati?.indice.etichette ?? []).map((e) => ({ id: e.id, nome: e.nome }))}
          etichettaAggiungi="Nuova etichetta"
          addPlaceholder="Nome dell'etichetta"
          emptyHint="Nessuna etichetta."
          onAdd={async (nome) => {
            await window.api.farmaci.salvaEtichetta(null, nome)
            await dopoModifica()
          }}
          onRename={async (id, nome) => {
            await window.api.farmaci.salvaEtichetta(id, nome)
            await dopoModifica()
          }}
          onDelete={async (id) => {
            if (!(await chiedi('Elimino l’etichetta? Si toglie da tutte le schede.'))) return
            await window.api.farmaci.eliminaEtichetta(id)
            await dopoModifica()
          }}
        />
      </details>

      <details className="farmaci-sezione">
        <summary>Nomi collegati a mano ({collegati.length})</summary>
        <p className="hint">
          Per un nome che l’app non conosce: «Enantyum = Dexketoprofene». Vale per tutti i pazienti. Un collegamento
          a mano ha la precedenza sull’elenco AIFA.
        </p>
        <NuovoCollegamento
          principi={(dati?.indice.schede ?? []).map((s) => s.principio_attivo)}
          onFatto={dopoModifica}
          schede={(dati?.indice.schede ?? []).map((s) => ({ id: s.id, nome: s.principio_attivo }))}
        />
        <ul className="farmaci-elenco semplice">
          {collegati.map((c) => (
            <li key={c.id}>
              <span className="farmaci-elenco-riga">
                <b>{c.nome}</b> = {c.principio_attivo}
              </span>
              <button
                className="btn-icona"
                aria-label={`Togli il collegamento di ${c.nome}`}
                title="Togli"
                onClick={() =>
                  void window.api.farmaci
                    .scollega(c.id)
                    .then(dopoModifica)
                    .catch((e) => toastErrore(errMsg(e)))
                }
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      </details>

      <details className="farmaci-sezione">
        <summary>Parole da ignorare ({dati?.indice.escluse.length ?? 0})</summary>
        <p className="hint">
          Nomi di farmaci che coincidono con parole comuni: non si sottolineano mai («ferro», «target»…).
        </p>
        <NuovaEsclusa onFatto={dopoModifica} />
        <div className="farmaci-escluse">
          {(dati?.indice.escluse ?? []).map((p) => (
            <span key={p} className="farmaco-chip">
              <span className="farmaco-chip-nome">{p}</span>
              <button
                className="farmaco-chip-icona"
                aria-label={`Togli ${p} dalle parole da ignorare`}
                onClick={() =>
                  void window.api.farmaci
                    .togliEsclusa(p)
                    .then(dopoModifica)
                    .catch((e) => toastErrore(errMsg(e)))
                }
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      </details>

      {inModifica && dati && (
        <ModificaScheda
          iniziale={inModifica}
          etichette={dati.indice.etichette}
          onAnnulla={() => setInModifica(null)}
          onFatto={() => {
            setInModifica(null)
            void caricaAltro()
          }}
        />
      )}
    </div>
  )
}

function NuovoCollegamento({
  principi,
  schede,
  onFatto
}: {
  principi: string[]
  schede: { id: number; nome: string }[]
  onFatto: () => Promise<void>
}): React.JSX.Element {
  const [nome, setNome] = useState('')
  const [principio, setPrincipio] = useState('')
  const scheda = schede.find((s) => s.nome.toLowerCase() === principio.trim().toLowerCase())
  const collega = async (): Promise<void> => {
    if (!scheda) {
      toastErrore('Scegli un principio attivo che ha già la scheda.')
      return
    }
    try {
      await window.api.farmaci.collega(nome, scheda.id)
      setNome('')
      setPrincipio('')
      await onFatto()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }
  return (
    <div className="farmaci-collega">
      <input placeholder="Nome (es. Enantyum)" value={nome} onChange={(e) => setNome(e.target.value)} />
      <span>=</span>
      <CampoSuggerimenti value={principio} onChange={setPrincipio} suggerimenti={principi} placeholder="Principio attivo" />
      <button className="btn-piccolo" disabled={!nome.trim() || !scheda} onClick={() => void collega()}>
        Collega
      </button>
    </div>
  )
}

function NuovaEsclusa({ onFatto }: { onFatto: () => Promise<void> }): React.JSX.Element {
  const [parola, setParola] = useState('')
  const aggiungi = async (): Promise<void> => {
    try {
      await window.api.farmaci.aggiungiEsclusa(parola)
      setParola('')
      await onFatto()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }
  return (
    <div className="farmaci-collega">
      <input
        placeholder="Parola da ignorare"
        value={parola}
        onChange={(e) => setParola(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void aggiungi()
        }}
      />
      <button className="btn-piccolo" disabled={!parola.trim()} onClick={() => void aggiungi()}>
        Aggiungi
      </button>
    </div>
  )
}
