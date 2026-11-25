import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Categoria } from '../../../../shared/types'
import {
  chiaveDose,
  infoVoce,
  intervalloTesto,
  livelloDose,
  livelloVoce,
  muscoliVoce,
  quoteLavoro,
  testoVoceSeduta,
  totaleVoce,
  valutaSeduta,
  VOCI,
  type DoseModello,
  type RigaConto,
  type Voce,
  type VoceSeduta
} from '../../../../shared/dose'
import { coloreDose } from '../dose/comune'

// La dose della seduta: UNA riga sola sopra agli esercizi, con i numeri. Dove
// manca qualcosa al minimo del modello il numero e' arancione, con quanto serve;
// sopra il minimo non succede niente. Il dettaglio (cosa manca, la settimana,
// com'e' divisa) si apre sopra la scheda solo cliccando la riga. Serve solo a
// programmare: non finisce in nessun documento.

interface Props {
  // null = la fase non ha un modello: si conta e basta
  modello: DoseModello | null
  // il conto di questa seduta, quello delle altre della settimana, una per una
  conto: Record<string, number>
  altre: Record<string, number>[]
  righe: RigaConto[]
  senza: { sezione: string; serie: number }[]
  categorie: Categoria[]
}

export default function RigaDose({
  modello,
  conto,
  altre,
  righe,
  senza,
  categorie
}: Props): React.JSX.Element | null {
  const [aperta, setAperta] = useState(false)
  const [vista, setVista] = useState<'seduta' | 'settimana'>('seduta')

  const riquadro = useRef<HTMLDivElement>(null)

  // Si chiude cliccando fuori. Niente velo sopra la pagina: fermerebbe la rotella.
  useEffect(() => {
    if (!aperta) return
    const fuori = (e: MouseEvent): void => {
      if (!riquadro.current?.contains(e.target as Node)) setAperta(false)
    }
    document.addEventListener('mousedown', fuori)
    return () => document.removeEventListener('mousedown', fuori)
  }, [aperta])

  const voci = valutaSeduta(modello, conto, altre)
  if (voci.length === 0 && senza.length === 0) return null

  const muscolo = (id: number): string => categorie.find((c) => c.id === id)?.nome ?? 'altro'

  // "4 forza + 3 ipertrofia = 7 serie", muscolo per muscolo
  const perMuscolo = (): { id: number; testo: string }[] => {
    const forza = new Map(muscoliVoce(conto, 'forza').map((m) => [m.categoria, m.fatto]))
    const ipertrofia = new Map(muscoliVoce(conto, 'ipertrofia').map((m) => [m.categoria, m.fatto]))
    return [...new Set([...forza.keys(), ...ipertrofia.keys()])]
      .sort((a, b) => muscolo(a).localeCompare(muscolo(b), 'it'))
      .map((id) => {
        const f = forza.get(id) ?? 0
        const i = ipertrofia.get(id) ?? 0
        const pezzi = [f > 0 ? `${f} forza` : '', i > 0 ? `${i} ipertrofia` : ''].filter(Boolean)
        return { id, testo: `${pezzi.join(' + ')} = ${f + i} serie` }
      })
  }
  const dettaglioMuscoli = perMuscolo()

  return (
    <div className="riga-dose" ref={riquadro}>
      <button
        type="button"
        className="riga-dose-sintesi"
        aria-expanded={aperta}
        onClick={() => setAperta(!aperta)}
      >
        <span className="riga-dose-titolo">
          Dose seduta {aperta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {voci.map((v) => (
          <span key={v.voce} className={`riga-dose-voce ${coloreDose(v.voce)}`} data-voce={v.voce}>
            <i aria-hidden="true" />
            {infoVoce(v.voce).breve} <b className={classeLivello(livelloVoce(v))}>{testoVoceSeduta(v)}</b>
            {infoVoce(v.voce).perMuscolo && v.totale > 0 && (
              <span className="riga-dose-bolla" role="tooltip">
                {dettaglioMuscoli.map((m) => (
                  <span key={m.id}>
                    <span>{muscolo(m.id)}</span>
                    <span>{m.testo}</span>
                  </span>
                ))}
              </span>
            )}
          </span>
        ))}
        {voci.length === 0 && <span className="hint">niente da contare</span>}
      </button>

      {aperta && (
        <div className="riga-dose-dettaglio">
            <div className="riga-dose-viste">
              <button type="button" className={vista === 'seduta' ? 'attivo' : ''} onClick={() => setVista('seduta')}>
                Seduta
              </button>
              <button
                type="button"
                className={vista === 'settimana' ? 'attivo' : ''}
                onClick={() => setVista('settimana')}
              >
                Settimana
              </button>
              <span className="hint">· {modello?.nome ?? 'fase senza modello di dose'}</span>
            </div>

            {vista === 'seduta' ? (
              <TabellaSeduta voci={voci} modello={modello} conto={conto} muscolo={muscolo} />
            ) : (
              <TabellaSettimana modello={modello} sedute={[conto, ...altre]} muscolo={muscolo} />
            )}

            {senza.length > 0 && (
              <p className="hint">
                Senza obiettivo:{' '}
                {senza.map((s) => `${s.serie} serie (${s.sezione})`).join(', ')}
              </p>
            )}

            <Divisione righe={righe} />
        </div>
      )}
    </div>
  )
}

const classeLivello = (l: ReturnType<typeof livelloDose>): string | undefined => (l ? `dose-${l}` : undefined)

// Una riga per voce, o per muscolo dove la voce e' per muscolo.
function TabellaSeduta({
  voci,
  modello,
  conto,
  muscolo
}: {
  voci: VoceSeduta[]
  modello: DoseModello | null
  conto: Record<string, number>
  muscolo: (id: number) => string
}): React.JSX.Element {
  const dose = (v: Voce): string => {
    const r = modello?.voci.find((x) => x.voce === v)
    return r ? intervalloTesto(r.minimo, r.massimo) : ''
  }
  const righe = voci.flatMap((v) => {
    const info = infoVoce(v.voce)
    const manca = (categoria: number | null): string => {
      const m = v.mancano.find((x) => x.categoria === categoria)
      return m ? `${m.minimo - m.fatto} ${info.unita}` : ''
    }
    // se non manca niente e' verde, anche quando ci ha pensato la settimana
    const livello = (categoria: number | null): ReturnType<typeof livelloDose> => {
      const m = v.mancano.find((x) => x.categoria === categoria)
      if (m) return livelloDose(m.fatto, m.minimo)
      return v.minimo == null ? null : 'raggiunta'
    }
    if (!info.perMuscolo || v.muscoli.length === 0) {
      return [{ chiave: v.voce, voce: v.voce, nome: info.nome, fatto: v.totale, manca: manca(null), livello: livello(null) }]
    }
    return v.muscoli.map((m) => ({
      chiave: chiaveDose(v.voce, m.categoria),
      voce: v.voce,
      nome: `${info.nome} · ${muscolo(m.categoria)}`,
      fatto: conto[chiaveDose(v.voce, m.categoria)] ?? 0,
      manca: manca(m.categoria),
      livello: livello(m.categoria)
    }))
  })
  if (righe.length === 0) return <p className="hint">Niente da contare per ora.</p>
  return (
    <table className="tabella-riga-dose">
      <thead>
        <tr>
          <th>Voce</th>
          <th>Fatto</th>
          <th>Dose</th>
          <th>Cosa manca</th>
        </tr>
      </thead>
      <tbody>
        {righe.map((r) => (
          <tr key={r.chiave}>
            <td>{r.nome}</td>
            <td className={classeLivello(r.livello)}>
              {r.fatto} <span className="hint">{infoVoce(r.voce).unita}</span>
            </td>
            <td>{dose(r.voce) || <span className="hint">–</span>}</td>
            <td className={r.manca ? classeLivello(r.livello) : undefined}>{r.manca || <span className="hint">–</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// La settimana, questa seduta compresa: quanto in tutto, quante sedute con la
// dose piena e quanto vuol dire la dose in una settimana.
function TabellaSettimana({
  modello,
  sedute,
  muscolo
}: {
  modello: DoseModello | null
  sedute: Record<string, number>[]
  muscolo: (id: number) => string
}): React.JSX.Element {
  const somma: Record<string, number> = {}
  for (const s of sedute) for (const [k, n] of Object.entries(s)) somma[k] = (somma[k] ?? 0) + n

  const righe = VOCI.flatMap((info) => {
    const r = modello?.voci.find((x) => x.voce === info.voce)
    if (totaleVoce(somma, info.voce) === 0 && r?.minimo == null) return []
    const chiavi = info.perMuscolo
      ? muscoliVoce(somma, info.voce).map((m) => ({ chiave: chiaveDose(info.voce, m.categoria), nome: `${info.nome} · ${muscolo(m.categoria)}` }))
      : [{ chiave: info.voce as string, nome: info.nome }]
    const righeVoce = chiavi.length > 0 ? chiavi : [{ chiave: info.voce as string, nome: info.nome }]
    return righeVoce.map(({ chiave, nome }) => {
      const minimo = r?.minimo ?? null
      const piene = minimo == null || minimo <= 0 ? null : sedute.filter((s) => (s[chiave] ?? 0) >= minimo).length
      const settimana =
        r && r.volte_min != null
          ? intervalloTesto(
              r.minimo == null ? null : r.minimo * r.volte_min,
              r.massimo == null ? null : r.massimo * (r.volte_max ?? r.volte_min)
            )
          : ''
      const volte = r ? intervalloTesto(r.volte_min, r.volte_max) : ''
      const fatto = somma[chiave] ?? 0
      const dovuto = (voce: Voce): number | null => {
        const x = modello?.voci.find((y) => y.voce === voce)
        return x?.minimo != null && x.volte_min != null ? x.minimo * x.volte_min : null
      }
      // potenza o pliometria intensiva: raggiunta una, l'altra non si colora
      const altra = info.voce === 'potenza' ? 'plio_int' : info.voce === 'plio_int' ? 'potenza' : null
      let livello = livelloDose(fatto, dovuto(info.voce))
      if (modello?.alternativa === 1 && altra && livello !== 'raggiunta') {
        if (livelloDose(somma[altra] ?? 0, dovuto(altra)) === 'raggiunta') livello = null
      }
      return { chiave, nome, unita: info.unita, fatto, piene, volte, settimana, livello }
    })
  })
  if (righe.length === 0) return <p className="hint">Niente da contare per ora.</p>
  return (
    <table className="tabella-riga-dose">
      <thead>
        <tr>
          <th>Voce</th>
          <th>In settimana</th>
          <th title="Sedute con almeno il minimo, e quante ne servono">Volte</th>
          <th>Dose settimanale</th>
        </tr>
      </thead>
      <tbody>
        {righe.map((r) => (
          <tr key={r.chiave}>
            <td>{r.nome}</td>
            <td className={classeLivello(r.livello)}>
              {r.fatto} <span className="hint">{r.unita}</span>
            </td>
            <td>
              {r.piene == null ? <span className="hint">–</span> : r.piene}
              {r.piene != null && r.volte && <span className="hint"> su {r.volte}</span>}
            </td>
            <td>{r.settimana || <span className="hint">–</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Divisione({ righe }: { righe: RigaConto[] }): React.JSX.Element | null {
  const quote = quoteLavoro(righe)
  if (quote.length === 0) return null
  return (
    <>
      <div className="riga-dose-etichetta">Come è divisa la seduta (serie)</div>
      <div className="riga-dose-quote" aria-hidden="true">
        {quote.map((q) => (
          <i key={q.voce} className={coloreDose(q.voce)} style={{ width: `${q.percento}%` }} />
        ))}
      </div>
      <p className="hint">{quote.map((q) => `${q.nome} ${q.percento}%`).join(' · ')}</p>
    </>
  )
}
