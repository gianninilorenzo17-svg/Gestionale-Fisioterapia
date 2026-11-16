import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, StickyNote, X } from 'lucide-react'
import { normalizza, trovaFarmaci, type PazienteFarmaco } from '../../../../shared/farmaci'
import CampoSuggerimenti from '../CampoSuggerimenti'
import { toastErrore } from '../Toast'
import { errMsg } from '../../lib'
import { useFarmaci } from '../../farmaci'
import BollaFarmaco, { useBolla } from './BollaFarmaco'
import { apriCollegamentoFarmaco, apriSchedaFarmaco } from './SchedaFarmaco'

// I farmaci del paziente, dentro all'anamnesi remota. Discreto: se non prende
// niente resta un "+ Farmaci" e basta. Il testo e' quello che scrive chi compila
// ("Brufen"); la scheda si ritrova dal nome. Nessun campo e' obbligatorio e non ci
// sono campi per dose, durata o motivo: se il paziente riferisce una dose si scrive
// nella nota.
const ATTESA_NOTA = 600
const FINESTRA_CONTESTO = 28

interface Proposta {
  testo: string
  contesto: string
}

export default function FarmaciPaziente({ pazienteId }: { pazienteId: number }): React.JSX.Element {
  const dati = useFarmaci()
  const [elenco, setElenco] = useState<PazienteFarmaco[] | null>(null)
  const [aperto, setAperto] = useState(false)
  const [nuovo, setNuovo] = useState('')
  const [notaDi, setNotaDi] = useState<number | null>(null)
  const [proposte, setProposte] = useState<Proposta[] | null>(null)
  const [scelte, setScelte] = useState<Set<string>>(new Set())
  const { bolla, mostra, nascondi, sullaBolla } = useBolla()

  const carica = useCallback(
    (): Promise<void> =>
      window.api.farmaci
        .paziente(pazienteId)
        .then(setElenco)
        .catch((e) => toastErrore(errMsg(e))),
    [pazienteId]
  )
  useEffect(() => {
    void carica()
  }, [carica])

  // Le note si salvano poco dopo l'ultima lettera e, se si chiude prima, subito.
  const notaInSospeso = useRef<{ id: number; testo: string; nota: string } | null>(null)
  const timerNota = useRef<ReturnType<typeof setTimeout> | null>(null)
  const salvaNota = useCallback((): void => {
    const n = notaInSospeso.current
    if (timerNota.current) clearTimeout(timerNota.current)
    timerNota.current = null
    notaInSospeso.current = null
    if (n) {
      void window.api.farmaci
        .aggiornaDelPaziente(n.id, n.testo, n.nota.trim() ? n.nota : null)
        .catch((e) => toastErrore(errMsg(e)))
    }
  }, [])
  useEffect(() => salvaNota, [salvaNota])

  // Il riconoscimento di ogni voce: una voce puo' avere piu' schede (associazioni).
  const riconosciuti = useMemo(() => {
    const m = new Map<number, ReturnType<typeof trovaFarmaci>>()
    if (!dati || !elenco) return m
    for (const f of elenco) m.set(f.id, trovaFarmaci(f.testo, dati.ricerca))
    return m
  }, [dati, elenco])

  const aggiungi = async (testo: string): Promise<void> => {
    const t = testo.trim()
    if (!t) return
    try {
      await window.api.farmaci.aggiungiAlPaziente(pazienteId, t, null)
      setNuovo('')
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const togli = async (f: PazienteFarmaco): Promise<void> => {
    try {
      await window.api.farmaci.togliDalPaziente(f.id)
      if (notaDi === f.id) setNotaDi(null)
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const cambiaNota = (f: PazienteFarmaco, nota: string): void => {
    setElenco((l) => (l ?? []).map((x) => (x.id === f.id ? { ...x, nota } : x)))
    notaInSospeso.current = { id: f.id, testo: f.testo, nota }
    if (timerNota.current) clearTimeout(timerNota.current)
    timerNota.current = setTimeout(salvaNota, ATTESA_NOTA)
  }

  // I farmaci gia' riconosciuti nella storia precedente, da confermare uno per uno.
  const apriProposte = async (): Promise<void> => {
    if (!dati) return
    try {
      const a = await window.api.anamnesi.get(pazienteId)
      const testo = a.storia_precedente ?? ''
      const gia = new Set((elenco ?? []).map((f) => normalizza(f.testo)))
      const viste = new Set<string>()
      const lista: Proposta[] = []
      for (const t of trovaFarmaci(testo, dati.ricerca)) {
        const k = normalizza(t.testo)
        if (gia.has(k) || viste.has(k)) continue
        viste.add(k)
        const da = Math.max(0, t.inizio - FINESTRA_CONTESTO)
        const fino = Math.min(testo.length, t.fine + FINESTRA_CONTESTO)
        lista.push({
          testo: t.testo,
          contesto: `${da > 0 ? '…' : ''}${testo.slice(da, fino).replace(/\s+/g, ' ')}${fino < testo.length ? '…' : ''}`
        })
      }
      setScelte(new Set())
      setProposte(lista)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const confermaProposte = async (): Promise<void> => {
    try {
      for (const p of proposte ?? []) {
        if (scelte.has(p.testo)) await window.api.farmaci.aggiungiAlPaziente(pazienteId, p.testo, null)
      }
      setProposte(null)
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const apriVoce = (f: PazienteFarmaco): void => {
    const trovati = riconosciuti.get(f.id) ?? []
    if (trovati.length > 0) apriSchedaFarmaco(trovati.flatMap((t) => t.refs))
    else apriCollegamentoFarmaco(f.testo)
  }

  if (elenco == null) return <></>
  const visibile = aperto || elenco.length > 0

  if (!visibile) {
    return (
      <div className="farmaci-paziente farmaci-chiuso">
        <button type="button" className="link-btn" onClick={() => setAperto(true)}>
          <Plus size={13} /> Farmaci
        </button>
      </div>
    )
  }

  return (
    <div className="farmaci-paziente">
      <div className="farmaci-riga">
        <span className="farmaci-titolo">Farmaci</span>
        {elenco.map((f) => {
          const trovati = riconosciuti.get(f.id) ?? []
          return (
            <span
              key={f.id}
              className={`farmaco-chip${trovati.length === 0 ? ' sconosciuto' : ''}`}
              onMouseEnter={(e) => {
                if (trovati.length === 0) return
                const r = e.currentTarget.getBoundingClientRect()
                mostra({
                  refs: trovati.flatMap((t) => t.refs),
                  rect: { left: r.left, top: r.top, bottom: r.bottom, right: r.right }
                })
              }}
              onMouseLeave={nascondi}
            >
              <button
                type="button"
                className="farmaco-chip-nome"
                onClick={() => apriVoce(f)}
                title={trovati.length === 0 ? 'Non lo conosco: clic per collegarlo a un principio attivo' : undefined}
              >
                {f.testo}
              </button>
              {f.nota && notaDi !== f.id && <span className="farmaco-chip-nota-testo">{f.nota}</span>}
              <button
                type="button"
                className={`farmaco-chip-icona${f.nota ? ' piena' : ''}`}
                aria-label={`Nota su ${f.testo}`}
                title="Nota"
                onClick={() => {
                  salvaNota()
                  setNotaDi(notaDi === f.id ? null : f.id)
                }}
              >
                <StickyNote size={13} />
              </button>
              <button
                type="button"
                className="farmaco-chip-icona"
                aria-label={`Togli ${f.testo}`}
                title="Togli dalla lista"
                onClick={() => void togli(f)}
              >
                <X size={13} />
              </button>
            </span>
          )
        })}
        <span
          className="farmaci-aggiungi"
          onKeyDown={(e) => {
            // Invio aggiunge il farmaco: la finestra dell'anamnesi non si chiude
            if (e.key !== 'Enter' || e.defaultPrevented) return
            e.preventDefault()
            e.stopPropagation()
            void aggiungi(nuovo)
          }}
        >
          <CampoSuggerimenti
            value={nuovo}
            onChange={setNuovo}
            suggerimenti={dati?.suggerimenti ?? []}
            placeholder="Aggiungi un farmaco…"
          />
          {nuovo.trim() && (
            <button
              type="button"
              className="farmaco-chip-icona piena"
              aria-label="Aggiungi il farmaco"
              title="Aggiungi (Invio)"
              onClick={() => void aggiungi(nuovo)}
            >
              <Plus size={15} />
            </button>
          )}
        </span>
        {dati && proposte == null && (
          <button type="button" className="link-btn" onClick={() => void apriProposte()}>
            Aggiungi i farmaci riconosciuti in anamnesi prossima
          </button>
        )}
      </div>

      {notaDi != null && (
        <div className="farmaci-nota-riga">
          <label>
            Nota su {elenco.find((f) => f.id === notaDi)?.testo}
            <input
              autoFocus
              value={elenco.find((f) => f.id === notaDi)?.nota ?? ''}
              placeholder="Se il paziente riferisce una dose, scrivila qui (facoltativo)"
              onChange={(e) => {
                const f = elenco.find((x) => x.id === notaDi)
                if (f) cambiaNota(f, e.target.value)
              }}
              onBlur={salvaNota}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  salvaNota()
                  setNotaDi(null)
                }
              }}
            />
          </label>
        </div>
      )}

      {proposte != null && (
        <div className="farmaci-proposte">
          {proposte.length === 0 ? (
            <p className="hint">Nella storia precedente non ci sono farmaci nuovi da aggiungere.</p>
          ) : (
            <>
              <p className="hint">
                Riconosciuti nella storia precedente. Il riconoscimento non sa se li prende: scegli tu.
              </p>
              {proposte.map((p) => (
                <label key={p.testo} className="farmaci-proposta">
                  <input
                    type="checkbox"
                    checked={scelte.has(p.testo)}
                    onChange={(e) => {
                      const n = new Set(scelte)
                      if (e.target.checked) n.add(p.testo)
                      else n.delete(p.testo)
                      setScelte(n)
                    }}
                  />
                  <b>{p.testo}</b>
                  <span className="farmaci-contesto">{p.contesto}</span>
                </label>
              ))}
            </>
          )}
          <div className="farmaci-proposte-azioni">
            <button type="button" className="btn-piccolo" onClick={() => setProposte(null)}>
              {proposte.length === 0 ? 'Chiudi' : 'Annulla'}
            </button>
            {proposte.length > 0 && (
              <button
                type="button"
                className="primary btn-piccolo"
                disabled={scelte.size === 0}
                onClick={() => void confermaProposte()}
              >
                Aggiungi i selezionati
              </button>
            )}
          </div>
        </div>
      )}

      {bolla && dati && (
        <BollaFarmaco stato={bolla} dati={dati} gestori={sullaBolla} onApri={() => apriSchedaFarmaco(bolla.refs)} />
      )}
    </div>
  )
}
