import { useEffect, useId, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { PazienteDettaglio } from '../../../shared/types'
import { infoVoce, type Voce } from '../../../shared/dose'
import type { CaricoPaziente, SettimanaCarico } from '../../../shared/carico-settimane'
import { coloreDose } from './dose/comune'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'
import Aiuto from './Aiuto'
import Tendina from './Tendina'

// Il carico settimana per settimana: una tabella (dalla settimana piu' recente)
// e sopra due grafici piccoli sulle stesse settimane, il carico di una voce e,
// sotto, dolore e sforzo medi (da 0 a 10: su un asse loro, non su quello dei
// contatti). Qui si legge cosa e' stato fatto: nessun confronto con la dose.
// Come la dose serve SOLO a programmare: non compare in nessun documento. Senza
// esercizi che si contano (una lombalgia) il riquadro non c'e'.

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const SETTIMANE_GRAFICO = 12
const RIGHE_TABELLA = 8

const numero = (n: number): string => n.toLocaleString('it-IT', { maximumFractionDigits: 1 })

const parti = (iso: string): [number, number, number] => {
  const [a, m, g] = iso.split('-').map(Number)
  return [a, m, g]
}

// "3–9 nov", "27 ott–2 nov"; l'anno solo se non e' quello di oggi
function nomeSettimana(s: SettimanaCarico): string {
  const [a1, m1, g1] = parti(s.lunedi)
  const [, m2, g2] = parti(s.domenica)
  const anno = a1 !== new Date().getFullYear() ? ` ${a1}` : ''
  return m1 === m2 ? `${g1}–${g2} ${MESI[m2 - 1]}${anno}` : `${g1} ${MESI[m1 - 1]}–${g2} ${MESI[m2 - 1]}${anno}`
}

const breve = (s: SettimanaCarico): string => {
  const [, m, g] = parti(s.lunedi)
  return `${g} ${MESI[m - 1]}`
}

export default function CaricoSettimane({ paziente }: { paziente: PazienteDettaglio }): React.JSX.Element | null {
  const [dati, setDati] = useState<CaricoPaziente | null>(null)
  const [voce, setVoce] = useState<Voce | null>(null)
  const [tutte, setTutte] = useState(false)
  const [sopra, setSopra] = useState<number | null>(null)

  // Dipende dal paziente intero: dopo ogni seduta salvata l'oggetto cambia.
  useEffect(() => {
    let attuale = true
    window.api.dose
      .caricoPaziente(paziente.id)
      .then((d) => attuale && setDati(d))
      .catch((e) => toastErrore(errMsg(e)))
    return () => {
      attuale = false
    }
  }, [paziente])

  if (!dati || dati.chiavi.length === 0 || dati.settimane.length === 0) return null

  const chiavi = dati.chiavi
  const nome = (k: Voce): string => infoVoce(k).breve
  const unita = (k: Voce): string => infoVoce(k).unita
  // "Quadricipite 6, Ischiocrurali 3": il dettaglio per muscolo sotto il mouse
  const muscoli = (s: SettimanaCarico, k: Voce): string | undefined =>
    s.muscoli[k]?.map((m) => `${dati.nomi[m.categoria] ?? 'altro'} ${m.fatto}`).join(', ')

  // la voce del grafico: quella scelta, o la prima
  const scelta = voce != null && chiavi.includes(voce) ? voce : chiavi[0]

  const nelGrafico = dati.settimane.slice(0, SETTIMANE_GRAFICO).reverse()
  const inTabella = tutte ? dati.settimane : dati.settimane.slice(0, RIGHE_TABELLA)
  const settimanaSopra = sopra == null ? null : nelGrafico[sopra]
  const avviso = dati.avviso

  return (
    <section className="card carico-settimane">
      <h3>
        Carico settimana per settimana
        <Aiuto testo="Quanto ha fatto il paziente ogni settimana, contato come nella riga della dose in seduta: contatti di pliometria, serie di forza, ipertrofia e potenza, ripetizioni eccentriche e secondi di isometria. Passando sopra a forza e ipertrofia si vede il dettaglio per muscolo. La fase della settimana è quella dell'ultima seduta. Le sedute al campo non contano nel carico, ma dolore e sforzo sì. Serve solo a programmare: non compare nella cartella né nei referti." />
      </h3>

      {avviso && (
        <p className="avviso-carico">
          <TriangleAlert size={16} />
          <span>
            Nelle ultime tre settimane il dolore medio è salito ({avviso.dolori.map(numero).join(' → ')}) mentre{' '}
            <b>{nome(avviso.chiave)}</b> cresceva ({avviso.valori.join(' → ')} {unita(avviso.chiave)}).
          </span>
        </p>
      )}

      <div className="carico-grafici">
        <div className="carico-testata">
          <label className="compila-data">
            Nel grafico
            <Tendina value={scelta} onChange={(e) => setVoce(e.target.value as Voce)}>
              {chiavi.map((k) => (
                <option key={k} value={k}>
                  {nome(k)}
                </option>
              ))}
            </Tendina>
          </label>
          {/* Quello che c'e' sotto il mouse: una riga sola, sempre allo stesso posto. */}
          <span className="carico-lettura" aria-live="polite">
            {settimanaSopra ? (
              <Lettura s={settimanaSopra} k={scelta} />
            ) : (
              <span className="hint">Passa sopra una settimana per leggerne i numeri.</span>
            )}
          </span>
        </div>
        <GraficoCarico settimane={nelGrafico} k={scelta} sopra={sopra} onSopra={setSopra} />
        <GraficoDoloreSforzo settimane={nelGrafico} sopra={sopra} onSopra={setSopra} />
      </div>

      <div className="carico-tabella-scorre">
        <table className="data-table tabella-carico">
          <thead>
            <tr>
              <th>Settimana</th>
              <th>Fase</th>
              {chiavi.map((k) => (
                <th key={k} title={unita(k)}>
                  <span className={`punto-voce ${coloreDose(k)}`} aria-hidden="true" />
                  {nome(k)}
                </th>
              ))}
              <th>Sforzo</th>
              <th>Dolore</th>
            </tr>
          </thead>
          <tbody>
            {inTabella.map((s) => (
              <tr key={s.lunedi} className={s.sedute + s.seduteCampo === 0 ? 'settimana-vuota' : undefined}>
                <td>
                  <span className="carico-settimana-nome">{nomeSettimana(s)}</span>
                  {s.inCorso && <span className="badge">in corso</span>}
                  {s.sedute + s.seduteCampo > 0 && (
                    <span className="hint carico-settimana-sedute">
                      {s.sedute === 1 ? '1 seduta' : `${s.sedute} sedute`}
                      {s.seduteCampo > 0 && ` · ${s.seduteCampo} al campo`}
                    </span>
                  )}
                </td>
                {s.sedute + s.seduteCampo === 0 ? (
                  <td colSpan={chiavi.length + 3} className="hint">
                    Nessuna seduta
                  </td>
                ) : (
                  <>
                    <td>{s.fase ?? <span className="hint">—</span>}</td>
                    {chiavi.map((k) => (
                      <td key={k} className="voce-dose" title={muscoli(s, k)}>
                        {s.voci[k] ?? <span className="hint">—</span>}
                      </td>
                    ))}
                    <td>{s.sforzo == null ? <span className="hint">—</span> : numero(s.sforzo)}</td>
                    <td>{s.dolore == null ? <span className="hint">—</span> : numero(s.dolore)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dati.settimane.length > RIGHE_TABELLA && (
        <button className="btn-aggiungi-lista" onClick={() => setTutte(!tutte)}>
          {tutte ? 'Mostra solo le ultime' : `Mostra tutte (${dati.settimane.length})`}
        </button>
      )}
    </section>
  )
}

function Lettura({ s, k }: { s: SettimanaCarico; k: Voce }): React.JSX.Element {
  const { breve, unita } = infoVoce(k)
  const pezzi = [nomeSettimana(s)]
  if (s.sedute + s.seduteCampo === 0) pezzi.push('nessuna seduta')
  else {
    pezzi.push(`${breve} ${s.voci[k] ?? 0} ${unita}`)
    if (s.dolore != null) pezzi.push(`dolore ${numero(s.dolore)}`)
    if (s.sforzo != null) pezzi.push(`sforzo ${numero(s.sforzo)}`)
  }
  return <span>{pezzi.join(' · ')}</span>
}

// ---- i due grafici: stesse colonne, una per settimana ----

// largo e basso: il riquadro occupa tutta la pagina, e con 640 le scritte
// diventavano enormi
const L = 1000
const SX = 44
const DX = 12
const colonna = (n: number): number => (L - SX - DX) / Math.max(n, 1)
const centro = (i: number, n: number): number => SX + colonna(n) * (i + 0.5)

// Le colonne trasparenti per il mouse: piu' larghe della barra, tutta l'altezza.
function Bersagli({
  n,
  alto,
  onSopra
}: {
  n: number
  alto: number
  onSopra: (i: number | null) => void
}): React.JSX.Element {
  return (
    <g onMouseLeave={() => onSopra(null)}>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={SX + colonna(n) * i}
          y={0}
          width={colonna(n)}
          height={alto}
          fill="transparent"
          onMouseEnter={() => onSopra(i)}
        />
      ))}
    </g>
  )
}

// un passo "tondo" per le linee della griglia: 1, 2, 5, 10, 20, 50...
function passo(massimo: number): number {
  const grezzo = massimo / 4
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(grezzo, 1))))
  return [1, 2, 5, 10].map((m) => m * p).find((x) => x >= grezzo) ?? 10 * p
}

function GraficoCarico({
  settimane,
  k,
  sopra,
  onSopra
}: {
  settimane: SettimanaCarico[]
  k: Voce
  sopra: number | null
  onSopra: (i: number | null) => void
}): React.JSX.Element {
  const A = 180
  const SU = 12
  const GIU = 28
  const alto = A - SU - GIU
  const n = settimane.length
  const idBarra = `sfum-barra-${useId().replace(/:/g, '')}`
  const valori = settimane.map((s) => s.voci[k] ?? 0)
  const { unita } = infoVoce(k)
  const p = passo(Math.max(...valori, 1))
  const cima = Math.ceil((Math.max(...valori, 1) * 1.05) / p) * p
  const y = (v: number): number => SU + (1 - v / cima) * alto
  const larga = Math.min(colonna(n) * 0.5, 36)
  const righe: number[] = []
  for (let v = 0; v <= cima; v += p) righe.push(v)
  // con tante settimane l'etichetta va a una si' e una no
  const ogni = n > 8 ? 2 : 1

  return (
    <svg className={`grafico grafico-carico ${coloreDose(k)}`} viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Carico per settimana, in ${unita}`}>
      <defs>
        <linearGradient id={idBarra} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--c)', stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: 'var(--c)', stopOpacity: 0.35 }} />
        </linearGradient>
      </defs>
      {righe.map((v) => (
        <g key={v}>
          <line className="grafico-griglia" x1={SX} y1={y(v)} x2={L - DX} y2={y(v)} />
          <text className="grafico-etichetta" x={SX - 6} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {sopra != null && (
        <rect className="carico-colonna-sopra" x={SX + colonna(n) * sopra} y={SU} width={colonna(n)} height={alto} />
      )}
      {settimane.map((s, i) => {
        const fatto = s.voci[k] ?? 0
        const cx = centro(i, n)
        return (
          <g key={s.lunedi}>
            {fatto > 0 && (
              <path
                className={`carico-barra${s.inCorso ? ' in-corso' : ''}`}
                d={barra(cx - larga / 2, y(fatto), larga, y(0) - y(fatto))}
                style={{ fill: `url(#${idBarra})` }}
              />
            )}
            {i % ogni === (n - 1) % ogni && (
              <text className="grafico-etichetta" x={cx} y={A - 8} textAnchor="middle">
                {breve(s)}
              </text>
            )}
          </g>
        )
      })}
      <Bersagli n={n} alto={A} onSopra={onSopra} />
    </svg>
  )
}

// Una barra con gli angoli in alto arrotondati (4px) e la base dritta sull'asse.
function barra(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

function GraficoDoloreSforzo({
  settimane,
  sopra,
  onSopra
}: {
  settimane: SettimanaCarico[]
  sopra: number | null
  onSopra: (i: number | null) => void
}): React.JSX.Element | null {
  const A = 120
  const SU = 10
  const GIU = 10
  const alto = A - SU - GIU
  const n = settimane.length
  const y = (v: number): number => SU + (1 - v / 10) * alto
  if (settimane.every((s) => s.dolore == null && s.sforzo == null)) return null

  // una linea per tratti: una settimana senza il valore la interrompe
  const tratti = (valore: (s: SettimanaCarico) => number | null): string[] => {
    const fuori: string[] = []
    let ora: string[] = []
    settimane.forEach((s, i) => {
      const v = valore(s)
      if (v == null) {
        if (ora.length > 1) fuori.push(ora.join(' '))
        ora = []
      } else ora.push(`${centro(i, n)},${y(v)}`)
    })
    if (ora.length > 1) fuori.push(ora.join(' '))
    return fuori
  }

  return (
    <>
      <div className="legenda-carico">
        <span>
          <svg width="22" height="12" aria-hidden>
            <line x1="1" y1="6" x2="21" y2="6" className="carico-linea-dolore" />
            <circle cx="11" cy="6" r="4" className="carico-punto-dolore" />
          </svg>
          Dolore medio
        </span>
        <span>
          <svg width="22" height="12" aria-hidden>
            <line x1="1" y1="6" x2="21" y2="6" className="carico-linea-sforzo" />
            <rect x="7" y="2" width="8" height="8" className="carico-punto-sforzo" />
          </svg>
          Sforzo medio
        </span>
        <span className="hint">da 0 a 10</span>
      </div>
      <svg className="grafico grafico-dolore-sforzo" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Dolore e sforzo medi per settimana">
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line className="grafico-griglia" x1={SX} y1={y(v)} x2={L - DX} y2={y(v)} />
            <text className="grafico-etichetta" x={SX - 6} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {sopra != null && (
          <rect className="carico-colonna-sopra" x={SX + colonna(n) * sopra} y={SU} width={colonna(n)} height={alto} />
        )}
        {tratti((s) => s.sforzo).map((pt, i) => (
          <polyline key={`s${i}`} className="carico-linea-sforzo" points={pt} />
        ))}
        {tratti((s) => s.dolore).map((pt, i) => (
          <polyline key={`d${i}`} className="carico-linea-dolore" points={pt} />
        ))}
        {settimane.map((s, i) => (
          <g key={s.lunedi}>
            {s.sforzo != null && (
              <rect className="carico-punto-sforzo" x={centro(i, n) - 4} y={y(s.sforzo) - 4} width={8} height={8} />
            )}
            {s.dolore != null && <circle className="carico-punto-dolore" cx={centro(i, n)} cy={y(s.dolore)} r={4.5} />}
          </g>
        ))}
        <Bersagli n={n} alto={A} onSopra={onSopra} />
      </svg>
    </>
  )
}
