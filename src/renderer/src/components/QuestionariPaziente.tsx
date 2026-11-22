import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Eye, ListChecks, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type {
  CategoriaQuestionario,
  CompilazioneRiepilogo,
  PazienteDettaglio,
  Questionario
} from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { chiedi } from './Conferma'
import Modale from './Modale'
import { errMsg, formatData } from '../lib'
import CompilaQuestionario from './CompilaQuestionario'
import RifarloFra from './RifarloFra'
import { ultimoQuestionario } from '../../../shared/quadro'

// Storico dei questionari compilati per il paziente, più la nuova compilazione.
export default function QuestionariPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [storico, setStorico] = useState<CompilazioneRiepilogo[]>([])
  const [disponibili, setDisponibili] = useState<Questionario[]>([])
  const [categorie, setCategorie] = useState<CategoriaQuestionario[]>([])
  // Cosa c'e' aperto: un questionario nuovo da compilare, oppure uno gia'
  // compilato aperto in lettura o in modifica.
  const [aperto, setAperto] = useState<
    | { modo: 'nuovo'; questionarioId: number }
    | { modo: 'vedi' | 'modifica'; compilazione: CompilazioneRiepilogo }
    | null
  >(null)
  // null = finestra chiusa; altrimenti la categoria scelta, o null dentro la
  // finestra finche' non se ne sceglie una
  const [scelta, setScelta] = useState(false)
  const [catScelta, setCatScelta] = useState<number | null>(null)
  // dopo una compilazione nuova: rifarlo fra quanto?
  const [rifare, setRifare] = useState<{ id: number; nome: string } | null>(null)

  // Gli storici aperti: uno per questionario.
  const [aperti, setAperti] = useState<number[]>([])
  const alterna = (id: number): void =>
    setAperti((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  // Una voce per questionario, col suo storico dal piu' recente; il questionario
  // compilato da ultimo sta in cima.
  const gruppi = useMemo(() => {
    const mappa = new Map<number, { id: number; nome: string; compilazioni: CompilazioneRiepilogo[] }>()
    const ordinate = [...storico].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    for (const c of ordinate) {
      const g = mappa.get(c.questionario_id) ?? { id: c.questionario_id, nome: c.questionario_nome, compilazioni: [] }
      g.compilazioni.push(c)
      mappa.set(c.questionario_id, g)
    }
    return [...mappa.values()]
  }, [storico])

  const load = useCallback(async (): Promise<void> => {
    try {
      setStorico(await window.api.compilazioni.list(paziente.id))
      setDisponibili(await window.api.questionari.list(false))
      setCategorie(await window.api.questionariCategorie.list())
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [paziente.id])

  useEffect(() => {
    void load()
  }, [load])

  const elimina = async (c: CompilazioneRiepilogo): Promise<void> => {
    if (!(await chiedi(`Eliminare la compilazione del ${formatData(c.data)}?`))) return
    try {
      await window.api.compilazioni.remove(c.id)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Punteggi e fascia sono quelli del giorno della compilazione: se nel
  // frattempo le regole del questionario sono cambiate, si ricalcolano solo
  // quando lo si chiede.
  const ricalcola = async (c: CompilazioneRiepilogo): Promise<void> => {
    if (
      !(await chiedi({
        titolo: 'Ricalcolare questa compilazione?',
        testo:
          `Punteggi e fascia si ricalcolano con le regole di adesso di «${c.questionario_nome}». ` +
          'Le risposte non cambiano. I valori di prima non si potranno ritrovare.',
        conferma: 'Ricalcola'
      }))
    ) {
      return
    }
    try {
      await window.api.compilazioni.ricalcola(c.id)
      toast('Compilazione ricalcolata.')
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>
          <ListChecks size={18} className="icona-titolo" aria-hidden="true" />
          Questionari
        </h3>
        <span className="row-actions">
          <button
            className="primary"
            title="Compila un questionario"
            disabled={disponibili.length === 0}
            onClick={() => setScelta(true)}
          >
            <Plus size={18} /> Compila
          </button>
        </span>
      </div>

      {disponibili.length === 0 ? (
        <p className="hint">
          Nessun questionario configurato: creane uno in Configurazione,
          &ldquo;Questionari&rdquo;.
        </p>
      ) : storico.length === 0 ? null : (
        // Una riga per questionario: l'ultimo punteggio in grande e di quanto e'
        // cambiato dalla prima volta. Un clic apre lo storico di quel
        // questionario, compilazione per compilazione.
        <div className="elenco-righe">
          {gruppi.map((g) => {
            const u = ultimoQuestionario(g.compilazioni)
            const ultima = g.compilazioni[0]
            const apertoGruppo = aperti.includes(g.id)
            const serie = g.compilazioni
              .slice(0, 8)
              .reverse()
              .map((c) => c.punteggi.find((p) => p.nome === u?.punteggioNome)?.valore)
              .filter((v): v is number => v != null)
            const massimo = Math.max(...serie, 1)
            const minimo = Math.min(...serie, 0)
            return (
              <div key={g.id}>
                <div
                  className="riga-lista riga-questionario"
                  role="button"
                  tabIndex={0}
                  aria-expanded={apertoGruppo}
                  onClick={() => alterna(g.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      alterna(g.id)
                    }
                  }}
                >
                  <span className="chi-testo">
                    <span className="nome-con-avviso">
                      {apertoGruppo ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <b>{g.nome}</b>
                      {ultima.fascia && <span className="pillola att">{ultima.fascia}</span>}
                    </span>
                    <span className="dettaglio-riga">
                      {g.compilazioni.length === 1 ? '1 volta' : `${g.compilazioni.length} volte`} · ultima{' '}
                      {formatData(ultima.data)}
                    </span>
                  </span>
                  <span className="serie-mini" aria-hidden="true">
                    {serie.map((v, i) => (
                      <i
                        key={i}
                        className={i === serie.length - 1 ? 'ultima' : ''}
                        style={{ height: `${25 + (75 * (v - minimo)) / Math.max(massimo - minimo, 1)}%` }}
                      />
                    ))}
                  </span>
                  <span className="punti-questionario">
                    {ultima.punteggi.length <= 1 ? (
                      <b>{ultima.punteggi[0]?.valore ?? '—'}</b>
                    ) : (
                      <span className="punti-vari">
                        {ultima.punteggi.map((p) => (
                          <span key={p.nome}>
                            <small>{p.nome}</small> <b>{p.valore}</b>
                          </span>
                        ))}
                      </span>
                    )}
                    {u?.cambio && (
                      <span
                        className={`pillola ${u.cambio.migliora === true ? 'ok' : u.cambio.migliora === false ? 'no' : 'neutra'}`}
                        title={`Rispetto alla prima compilazione, il ${formatData(u.cambio.dal)}`}
                      >
                        {u.cambio.differenza > 0 ? '+' : u.cambio.differenza < 0 ? '−' : ''}
                        {Math.abs(u.cambio.differenza).toString().replace('.', ',')} dalla prima
                      </span>
                    )}
                  </span>
                  <span className="azioni-riga" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-piccolo" title={`Compila di nuovo «${g.nome}»`} onClick={() => setAperto({ modo: 'nuovo', questionarioId: g.id })}>
                      <Plus size={14} /> Rifai
                    </button>
                  </span>
                </div>

                {apertoGruppo &&
                  g.compilazioni.map((c) => (
                    <div key={c.id} className="riga-lista riga-compilazione">
                      <span className="chi-testo">
                        <b>{formatData(c.data)}</b>
                        {c.note && <span className="dettaglio-riga">{c.note}</span>}
                        {c.daRicalcolare && (
                          <span className="dettaglio-riga esito-attenzione">
                            Calcolata con regole del questionario diverse da quelle di adesso.{' '}
                            <button className="link-btn" onClick={() => void ricalcola(c)}>
                              <RefreshCw size={13} /> Ricalcola
                            </button>
                          </span>
                        )}
                      </span>
                      <span className="punteggi-compilazione">
                        {c.punteggi.map((p) => (
                          <span key={p.nome} className="punteggio">
                            <span className="etichetta">{p.nome}</span>
                            <span className="valore">{p.valore}</span>
                          </span>
                        ))}
                      </span>
                      <span className="variazione-questionario">
                        {c.variazione && (
                          <>
                            <span className={c.variazione.punti >= 0 ? 'meglio' : 'peggio'}>
                              {c.variazione.punti >= 0 ? '+' : '−'}
                              {Math.abs(c.variazione.punti).toString().replace('.', ',')} punti (
                              {Math.abs(c.variazione.percentuale).toString().replace('.', ',')}%)
                            </span>
                            {c.variazione.significativa && (
                              <span className="pillola ok">cambiamento che conta</span>
                            )}
                          </>
                        )}
                      </span>
                      <span className="azioni-riga">
                        <button
                          className="btn-icona"
                          title="Vedi le risposte"
                          onClick={() => setAperto({ modo: 'vedi', compilazione: c })}
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          className="btn-icona"
                          title="Modifica le risposte"
                          onClick={() => setAperto({ modo: 'modifica', compilazione: c })}
                        >
                          <Pencil size={18} />
                        </button>
                        <button className="btn-icona danger" title="Elimina" onClick={() => void elimina(c)}>
                          <Trash2 size={18} />
                        </button>
                      </span>
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {scelta && (
        // Niente pulsante "primary" da confermare: si sceglie cliccando la
        // categoria o il questionario. Invio e clic fuori chiudono e basta.
        <Modale
          className="modal-sm"
          onConferma={() => {
            setScelta(false)
            setCatScelta(null)
          }}
        >
            {catScelta == null ? (
              <>
                <h3>Quale categoria?</h3>
                <ul className="scelte-questionari">
                  {categorie
                    .filter((c) => disponibili.some((q) => q.categoria_id === c.id))
                    .map((c) => (
                      <li key={c.id}>
                        <button onClick={() => setCatScelta(c.id)}>{c.nome}</button>
                      </li>
                    ))}
                </ul>
                {!categorie.some((c) => disponibili.some((q) => q.categoria_id === c.id)) && (
                  <p className="hint">Nessuna categoria contiene questionari.</p>
                )}
              </>
            ) : (
              <>
                <h3>Quale questionario?</h3>
                <ul className="scelte-questionari">
                  {disponibili
                    .filter((q) => q.categoria_id === catScelta)
                    .map((q) => (
                      <li key={q.id}>
                        <button
                          onClick={() => {
                            setScelta(false)
                            setCatScelta(null)
                            setAperto({ modo: 'nuovo', questionarioId: q.id })
                          }}
                        >
                          {q.nome}
                        </button>
                      </li>
                    ))}
                </ul>
              </>
            )}
            <div className="modal-actions">
              {catScelta != null && <button onClick={() => setCatScelta(null)}>Indietro</button>}
              <button
                onClick={() => {
                  setScelta(false)
                  setCatScelta(null)
                }}
              >
                Annulla
              </button>
            </div>
        </Modale>
      )}

      {aperto && (
        <CompilaQuestionario
          key={aperto.modo === 'nuovo' ? `n${aperto.questionarioId}` : `c${aperto.compilazione.id}`}
          pazienteId={paziente.id}
          questionarioId={
            aperto.modo === 'nuovo'
              ? aperto.questionarioId
              : aperto.compilazione.questionario_id
          }
          compilazione={aperto.modo === 'nuovo' ? null : aperto.compilazione}
          soloLettura={aperto.modo === 'vedi'}
          onChiudi={(compilazioneId) => {
            const nuovo = aperto.modo === 'nuovo' ? aperto.questionarioId : null
            setAperto(null)
            if (compilazioneId != null) void load()
            // solo per una compilazione nuova: correggerne una vecchia non apre un altro giro
            if (compilazioneId != null && nuovo != null) {
              setRifare({ id: nuovo, nome: disponibili.find((q) => q.id === nuovo)?.nome ?? 'questionario' })
            }
          }}
        />
      )}

      {rifare && (
        <RifarloFra
          pazienteId={paziente.id}
          tipo="questionario"
          riferimentoId={rifare.id}
          nome={rifare.nome}
          onChiudi={() => setRifare(null)}
        />
      )}
    </section>
  )
}
