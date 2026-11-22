import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, History, Plus, X } from 'lucide-react'
import type { AndamentoRiferito, SedutaPrecedente, Tecnica } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg, formatData, maiuscola } from '../lib'

// Il diario della seduta, in cima alla seduta: prima come sta il paziente
// tornando, poi cosa gli si fa. Gli esercizi vengono dopo.

const ANDAMENTI: { valore: AndamentoRiferito; nome: string }[] = [
  { valore: 'meglio', nome: 'Meglio' },
  { valore: 'uguale', nome: 'Uguale' },
  { valore: 'peggio', nome: 'Peggio' }
]

export const NOME_ANDAMENTO: Record<AndamentoRiferito, string> = {
  meglio: 'meglio',
  uguale: 'uguale',
  peggio: 'peggio'
}

// La volta prima, in poche righe: si legge prima di chiedere "come va?".
export function UltimaVoltaSeduta({
  precedente,
  apertaSeCiSonoNote = false,
  comeSezione = false
}: {
  precedente: SedutaPrecedente
  // Nel quadro del paziente e' la prima cosa che si legge: se c'e' scritto
  // qualcosa parte gia' aperta. Dentro la seduta resta la riga sola.
  apertaSeCiSonoNote?: boolean
  // Nel quadro e' una sezione come le altre: titolo con la riga sotto e sempre aperta.
  comeSezione?: boolean
}): React.JSX.Element {
  const p = precedente
  const trattamento = [p.tecniche.join(', '), p.trattamento].filter(Boolean).join(' — ')
  const numeri = [
    p.dolore != null ? `dolore ${p.dolore}/10` : null,
    p.sforzo != null ? `sforzo ${p.sforzo}/10` : null,
    // "5/10" per le scale da 0 a 10, altrimenti il numero con la sua unita'
    ...p.segni.map((g) => {
      const v = String(g.valore).replace('.', ',')
      return `${g.nome} ${g.unita === '0-10' ? `${v}/10` : `${v}${g.unita ? ` ${g.unita}` : ''}`}`
    })
  ].filter(Boolean)
  const vuota = !p.riferito_andamento && !p.riferito && !trattamento && numeri.length === 0 && !p.note
  // Chiusa e' una riga sola, con l'essenziale; aperta mostra tutto.
  const [aperta, setAperta] = useState(apertaSeCiSonoNote && !vuota)
  const inBreve = [
    p.riferito_andamento ? NOME_ANDAMENTO[p.riferito_andamento] : null,
    p.tecniche.join(', ') || null,
    p.dolore != null ? `dolore ${p.dolore}/10` : null,
    // la nota e' quella scritta apposta per ritrovarla: si legge anche a riga chiusa
    p.note?.trim() ? `nota: ${p.note.trim().replace(/\s+/g, ' ')}` : null
  ]
    .filter(Boolean)
    .join(' · ')
  const corpo = (
    <dl className="righe-ultima">
        {(p.riferito_andamento || p.riferito) && (
          <div>
            {/* L'andamento sta accanto all'etichetta, non dentro al testo:
                il testo scritto resta a destra e parte dal suo margine. */}
            <dt className="dt-riferiva">
              Riferiva
              {p.riferito_andamento && (
                <span className={`badge-andamento ${p.riferito_andamento}`}>
                  {NOME_ANDAMENTO[p.riferito_andamento]}
                </span>
              )}
            </dt>
            <dd>{p.riferito}</dd>
          </div>
        )}
        {trattamento && (
          <div>
            <dt>Trattamento</dt>
            <dd>{trattamento}</dd>
          </div>
        )}
        {numeri.length > 0 && (
          <div>
            <dt>Misure</dt>
            <dd>{maiuscola(numeri.join(' · '))}</dd>
          </div>
        )}
        {p.note && (
          <div>
            <dt>Note</dt>
            <dd>{p.note}</dd>
          </div>
        )}
      </dl>
  )
  if (comeSezione) {
    return (
      <section className="card">
        <div className="card-header-row">
          <h3>
            <History size={18} className="icona-titolo" aria-hidden="true" />
            L&apos;ultima volta — {formatData(p.data)}
          </h3>
        </div>
        {vuota ? (
          <p className="hint">In quella seduta non erano scritti né come stava né il trattamento.</p>
        ) : (
          corpo
        )}
      </section>
    )
  }
  return (
    <section className={aperta ? 'card ultima-seduta aperta' : 'card ultima-seduta'}>
      <button
        type="button"
        className="titolo-ultima"
        title={aperta ? 'Chiudi' : 'Vedi tutto'}
        onClick={() => setAperta(!aperta)}
      >
        <History size={16} />
        <span className="data-ultima">L&apos;ultima volta — {formatData(p.data)}</span>
        {!aperta && <span className="in-breve">{vuota ? 'Niente di scritto' : maiuscola(inBreve)}</span>}
        <ChevronDown size={16} className="freccia-ultima" />
      </button>
      {!aperta ? null : vuota ? (
        <p className="hint">In quella seduta non erano scritti né come stava né il trattamento.</p>
      ) : (
        corpo
      )}
    </section>
  )
}

export default function DiarioSeduta({
  andamento,
  riferito,
  tecnicaIds,
  trattamento,
  precedente,
  nuova: sedutaNuova,
  onCambia
}: {
  andamento: AndamentoRiferito | null
  riferito: string
  tecnicaIds: number[]
  trattamento: string
  // la seduta di prima: da li' viene cosa riferiva e il trattamento proposto
  precedente: SedutaPrecedente | null
  // seduta appena iniziata: le tecniche della volta scorsa partono spuntate
  nuova: boolean
  onCambia: (patch: {
    andamento?: AndamentoRiferito | null
    riferito?: string
    tecnicaIds?: number[]
    trattamento?: string
  }) => void
}): React.JSX.Element {
  const [tecniche, setTecniche] = useState<Tecnica[]>([])
  const [nuovaTecnica, setNuovaTecnica] = useState('')
  const [pannello, setPannello] = useState(false)
  const [modificaElenco, setModificaElenco] = useState(false)
  const precompilato = useRef(false)

  const carica = (): void => {
    window.api.tecniche
      .list(true)
      .then(setTecniche)
      .catch((e) => toastErrore(errMsg(e)))
  }
  useEffect(carica, [])

  // Le tecniche della volta scorsa, riconosciute per nome.
  const nomiPrima = (precedente?.tecniche ?? []).map((n) => n.trim().toLowerCase())
  const idsPrima = tecniche.filter((t) => nomiPrima.includes(t.nome.trim().toLowerCase())).map((t) => t.id)

  // Una sola volta, a seduta nuova: quelle della volta scorsa sono gia' spuntate.
  useEffect(() => {
    if (precompilato.current || !sedutaNuova || !precedente || tecniche.length === 0) return
    precompilato.current = true
    if (tecnicaIds.length === 0 && idsPrima.length > 0) onCambia({ tecnicaIds: idsPrima })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedutaNuova, precedente, tecniche])

  const inRiga = tecniche.filter((t) => tecnicaIds.includes(t.id) || idsPrima.includes(t.id))
  const altre = tecniche.filter((t) => t.archiviata === 0 && !inRiga.some((x) => x.id === t.id))

  const attiva = (id: number): void =>
    onCambia({ tecnicaIds: tecnicaIds.includes(id) ? tecnicaIds.filter((x) => x !== id) : [...tecnicaIds, id] })

  const aggiungi = async (): Promise<void> => {
    const nome = nuovaTecnica.trim()
    if (!nome) return
    try {
      const id = await window.api.tecniche.crea(nome)
      setNuovaTecnica('')
      carica()
      if (!tecnicaIds.includes(id)) onCambia({ tecnicaIds: [...tecnicaIds, id] })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const archivia = async (t: Tecnica): Promise<void> => {
    try {
      await window.api.tecniche.setArchiviata(t.id, true)
      carica()
      toast(`"${t.nome}" tolta dall'elenco. Per rimetterla, aggiungila di nuovo.`)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // "20/11: «Bene l'eccentrico…»": cosa aveva scritto la volta scorsa
  const prima = precedente
    ? precedente.riferito?.trim() ||
      (precedente.riferito_andamento ? NOME_ANDAMENTO[precedente.riferito_andamento] : '')
    : ''
  const dataPrima = precedente ? `${precedente.data.slice(8, 10)}/${precedente.data.slice(5, 7)}` : ''

  return (
    <section className="card striscia-card come-va">
      <div className="striscia-titolo">
        <span>Come va oggi</span>
        {prima && (
          <span className="come-va-prima" title={prima}>
            · {dataPrima}: «{prima}»
          </span>
        )}
      </div>
      <div className="come-va-riga">
        <span className="scelta-coppia segmentata">
          {ANDAMENTI.map((a) => (
            <button
              key={a.valore}
              type="button"
              className={andamento === a.valore ? `scelta-attiva ${a.valore}` : ''}
              onClick={() => onCambia({ andamento: andamento === a.valore ? null : a.valore })}
            >
              {a.nome}
            </button>
          ))}
        </span>
        <textarea
          rows={1}
          className="cresce"
          placeholder="Note: cosa riferisce oggi"
          value={riferito}
          onChange={(e) => onCambia({ riferito: e.target.value })}
        />
      </div>
      <div className="come-va-riga come-va-tecniche">
        {inRiga.map((t) => {
          const dentro = tecnicaIds.includes(t.id)
          return (
            <span key={t.id} className={modificaElenco ? 'tecnica in-modifica' : 'tecnica'}>
              <button
                type="button"
                className={dentro ? 'scelta-attiva' : ''}
                title={dentro ? 'Oggi lo fai: clic per toglierlo' : 'Oggi non lo fai: clic per rimetterlo'}
                onClick={() => !modificaElenco && attiva(t.id)}
              >
                {dentro && <Check size={14} />}
                {t.nome}
              </button>
              {modificaElenco && t.archiviata === 0 && (
                <button
                  type="button"
                  className="togli-tecnica"
                  title={`Togli "${t.nome}" dall'elenco`}
                  onClick={() => void archivia(t)}
                >
                  <X size={14} />
                </button>
              )}
            </span>
          )
        })}
        <button type="button" className="btn-piccolo" aria-expanded={pannello} onClick={() => setPannello(!pannello)}>
          <Plus size={14} /> Trattamento eseguito
        </button>
      </div>
      {pannello && (
        <div className="come-va-pannello">
          <div className="scelte-multiple tecniche">
            {altre.map((t) => (
              <span key={t.id} className={modificaElenco ? 'tecnica in-modifica' : 'tecnica'}>
                <button type="button" onClick={() => !modificaElenco && attiva(t.id)}>
                  {t.nome}
                </button>
                {modificaElenco && (
                  <button
                    type="button"
                    className="togli-tecnica"
                    title={`Togli "${t.nome}" dall'elenco`}
                    onClick={() => void archivia(t)}
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            ))}
            <span className="nuova-tecnica">
              <input
                placeholder="Nuova tecnica, es. onde d'urto"
                value={nuovaTecnica}
                onChange={(e) => setNuovaTecnica(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void aggiungi()}
              />
              <button type="button" className="primary btn-piccolo" onClick={() => void aggiungi()}>
                Aggiungi
              </button>
            </span>
            <button
              type="button"
              className="link-discreto modifica-elenco"
              onClick={() => setModificaElenco(!modificaElenco)}
            >
              {modificaElenco ? 'Fatto' : 'Modifica elenco'}
            </button>
          </div>
          <textarea
            rows={1}
            className="cresce"
            placeholder="Dettagli (facoltativo): zona, parametri, come ha risposto"
            value={trattamento}
            onChange={(e) => onCambia({ trattamento: e.target.value })}
          />
        </div>
      )}
    </section>
  )
}
