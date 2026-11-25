import { ArrowRight, Bell, Check, Minus, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import type { Fase, PazienteDettaglio, SedutaRiepilogo } from '../../../../shared/types'
import { classeLsi, type ClasseLsi } from '../../../../shared/quadro'
import { durataTra, formatData, testoPromemoria } from '../../lib'
import type { Destinazione } from './sezioni'
import type { DatiQuadro } from './useDatiQuadro'
import Aiuto from '../Aiuto'
import { coloreDose } from '../dose/comune'

// La prima linguetta della scheda: una panoramica di cosa stiamo facendo e a che
// punto e' il paziente, senza scrivere niente. Ogni riquadro e' un pulsante
// intero: un clic porta alla linguetta (e alla parte) dove quella cosa si
// legge per esteso. Quello che il paziente non ha (la pedana, un questionario)
// non compare: niente riquadri vuoti.

// Un riquadro che porta da un'altra parte
function Vai({
  verso,
  onVai,
  classe,
  etichetta,
  children
}: {
  verso: Destinazione
  onVai: (d: Destinazione) => void
  classe?: string
  // dove porta, scritto a destra in alto quando ci si passa sopra
  etichetta: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section
      className={`q-card q-vai${classe ? ` ${classe}` : ''}`}
      role="link"
      tabIndex={0}
      onClick={() => onVai(verso)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onVai(verso)
        }
      }}
    >
      <span className="q-freccia">
        {etichetta} <ArrowRight size={13} aria-hidden="true" />
      </span>
      {children}
    </section>
  )
}

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
const giornoSettimana = (iso: string): string => {
  const [a, m, g] = iso.split('-').map(Number)
  return GIORNI[new Date(a, m - 1, g).getDay()]
}
const numeroGiorno = (iso: string): string => String(Number(iso.slice(8, 10)))

// La lineetta del dolore: scala fissa da 0 a 10, cosi' due pazienti si
// confrontano a occhio e un dolore che sale da 1 a 2 non sembra un precipizio.
function LineettaDolore({ serie }: { serie: { data: string; dolore: number }[] }): React.JSX.Element | null {
  if (serie.length < 2) return null
  const L = 104
  const A = 40
  const x = (i: number): number => 5 + (i * (L - 10)) / (serie.length - 1)
  const y = (v: number): number => 5 + (1 - v / 10) * (A - 10)
  return (
    <svg className="q-lineetta" width={L} height={A} viewBox={`0 0 ${L} ${A}`} aria-hidden="true">
      <polyline
        points={serie.map((p, i) => `${x(i)},${y(p.dolore)}`).join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {serie.map((p, i) => (
        <circle
          key={p.data + i}
          cx={x(i)}
          cy={y(p.dolore)}
          r={i === serie.length - 1 ? 4 : 2.2}
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  )
}

// la pastiglia dice solo come sta l'LSI; quale test e' sta sotto
const TESTO_CLASSE: Record<ClasseLsi, string> = {
  ok: 'da 90% in su',
  att: 'fra 80% e 89%',
  no: "sotto l'80%"
}

const ICONA_CLASSE: Record<ClasseLsi, React.JSX.Element> = {
  ok: <Check size={12} aria-hidden="true" />,
  att: <TriangleAlert size={12} aria-hidden="true" />,
  no: <TriangleAlert size={12} aria-hidden="true" />
}

export default function QuadroPaziente({
  paziente,
  fasi,
  dati,
  onVai,
  onApriSeduta
}: {
  paziente: PazienteDettaglio
  fasi: Fase[]
  dati: DatiQuadro
  onVai: (d: Destinazione) => void
  onApriSeduta: (id: number) => void
}): React.JSX.Element {
  // le fasi di palestra sono la strada; quelle del campo sono un percorso a parte
  const strada = fasi.filter((f) => f.campo !== 1)
  const idx = strada.findIndex((f) => f.id === paziente.fase_corrente_id)
  const dalleFase = dati.inFaseDal ? durataTra(dati.inFaseDal) : null
  const raggiunti = dati.obiettivi.filter((o) => o.raggiunto).length
  const frazione = dati.obiettivi.length > 0 ? raggiunti / dati.obiettivi.length : 0
  const CIRC = 2 * Math.PI * 19
  const mancanti = dati.obiettivi.filter((o) => !o.raggiunto)
  const mostraObiettivi = mancanti.slice(0, 6)

  const tempi: { valore: string; etichetta: string }[] = []
  if (dalleFase) tempi.push({ valore: dalleFase, etichetta: 'In questa fase' })

  const u = dati.ultima
  const notaUltima = u?.note?.trim() || u?.riferito?.trim() || null

  const nProgressioni = dati.progressioni.length
  const s = dati.settimana
  const segmenti = s.previste != null ? Math.min(Math.max(s.previste, 1), 14) : 0
  const d = dati.dolore
  const lsi = dati.lsi
  const q = dati.questionario
  const m = dati.promemoria

  return (
    <div className="quadro">
      {/* ---- A che punto e' ---- */}
      <Vai
        verso={{ scheda: 'percorso', sezione: 'fase' }}
        onVai={onVai}
        etichetta="Percorso"
        classe="q-percorso"
      >
        <div className="q-percorso-strada">
          <div className="q-titoletto">
            A che punto è
          </div>
          {paziente.patologia_id == null ? (
            <p className="hint">Nessun percorso impostato: scegli la patologia e la fase.</p>
          ) : strada.length === 0 ? (
            <p className="hint">Questa patologia non ha fasi.</p>
          ) : (
            <ol className="q-fasi">
              {strada.map((f, i) => {
                const stato = idx < 0 ? '' : i < idx ? 'fatta' : i === idx ? 'ora' : ''
                return (
                  <li key={f.id} className={`q-fase ${stato}`} aria-current={stato === 'ora' ? 'step' : undefined}>
                    <span className="q-fase-punto">{stato === 'fatta' && <Check size={13} aria-hidden="true" />}</span>
                    <span className="q-fase-nome">{f.nome}</span>
                  </li>
                )
              })}
            </ol>
          )}
          {paziente.patologia_id != null && idx < 0 && strada.length > 0 && (
            <p className="hint">
              {paziente.fase_corrente_id == null
                ? 'Fase non impostata.'
                : `Fase attuale: ${paziente.fase_nome ?? '—'} (fuori dal percorso di palestra).`}
            </p>
          )}
          <div className="q-tempi">
            {tempi.map((t) => (
              <div key={t.etichetta}>
                <span>{t.etichetta}</span>
                <b>{t.valore}</b>
              </div>
            ))}
          </div>
        </div>

        {dati.obiettivi.length > 0 && (
          <div
            className="q-obiettivi"
            role="link"
            tabIndex={0}
            title="Apri gli obiettivi"
            onClick={(e) => {
              e.stopPropagation()
              onVai({ scheda: 'percorso', sezione: 'obiettivi' })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                onVai({ scheda: 'percorso', sezione: 'obiettivi' })
              }
            }}
          >
            <div className="q-obiettivi-testa">
              <svg className="q-anello" viewBox="0 0 46 46" aria-hidden="true">
                <circle cx="23" cy="23" r="19" fill="none" stroke="var(--border)" strokeWidth={5} />
                <circle
                  cx="23"
                  cy="23"
                  r="19"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray={`${CIRC * frazione} ${CIRC}`}
                  transform="rotate(-90 23 23)"
                />
                <text x="23" y="27.5" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text)">
                  {raggiunti}/{dati.obiettivi.length}
                </text>
              </svg>
              <div>
                <b>Obiettivi della fase</b>
                <div className="hint">{raggiunti === dati.obiettivi.length ? 'tutti raggiunti' : `${dati.obiettivi.length - raggiunti} da raggiungere`}</div>
              </div>
            </div>
            <ul className="q-obiettivi-lista">
              {mostraObiettivi.map((o) => (
                <li key={o.nome}>
                  <span className="q-spunta" />
                  {o.nome}
                </li>
              ))}
              {mancanti.length > mostraObiettivi.length && (
                <li className="altri">+{mancanti.length - mostraObiettivi.length} altri</li>
              )}
            </ul>
          </div>
        )}
      </Vai>

      {/* ---- Cosa stiamo facendo ---- */}
      <div className="q-tre">
        <section
          className="q-card q-vai"
          role="link"
          tabIndex={0}
          onClick={() => (u ? onApriSeduta(u.id) : onVai({ scheda: 'diario' }))}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (u) onApriSeduta(u.id)
              else onVai({ scheda: 'diario' })
            }
          }}
        >
          <span className="q-freccia">
            {u ? 'Apri la seduta' : 'Diario'} <ArrowRight size={13} aria-hidden="true" />
          </span>
          <div className="q-titoletto">{u ? `Ultima seduta · ${formatData(u.data)}` : 'Ultima seduta'}</div>
          {!u ? (
            <p className="hint">Ancora nessuna seduta.</p>
          ) : (
            <>
              {notaUltima &&
                (notaUltima.length <= 110 ? (
                  <p className="q-nota">{notaUltima}</p>
                ) : (
                  <div className="q-nota-lunga" tabIndex={0}>
                    <span className="q-nota-etichetta">Note</span>
                    <div className="q-nota-bolla" role="tooltip">{notaUltima}</div>
                  </div>
                ))}
              {u.trattamento || u.tecniche_nomi ? (
                <div className="q-riga-piccola">
                  <span>Trattamento</span> {[u.tecniche_nomi, u.trattamento].filter(Boolean).join(' — ')}
                </div>
              ) : null}
              {dati.lavoroUltima.length > 0 && (
                <div className="q-lavoro" title={`${dati.eserciziUltima.length} esercizi, pesati sulle serie`}>
                  <svg className="q-lavoro-ciambella" viewBox="0 0 42 42" aria-hidden="true">
                    {(() => {
                      const tot = dati.lavoroUltima.reduce((s, l) => s + l.percento, 0) || 1
                      const C = 2 * Math.PI * 15.9155
                      let cumulato = 0
                      return dati.lavoroUltima.map((l) => {
                        const parte = (l.percento / tot) * C
                        const el = (
                          <circle
                            key={l.voce}
                            className={coloreDose(l.voce)}
                            cx="21"
                            cy="21"
                            r="15.9155"
                            fill="none"
                            strokeWidth="6"
                            strokeDasharray={`${Math.max(parte - 0.8, 0.1)} ${C - Math.max(parte - 0.8, 0.1)}`}
                            strokeDashoffset={-cumulato}
                            transform="rotate(-90 21 21)"
                          />
                        )
                        cumulato += parte
                        return el
                      })
                    })()}
                  </svg>
                  <ul>
                    {dati.lavoroUltima.map((l) => (
                      <li key={l.voce}>
                        <span className={`q-lavoro-punto ${coloreDose(l.voce)}`} aria-hidden="true" />
                        {l.nome} <b>{l.percento}%</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(u.dolore != null || u.sforzo != null) && (
                <div className="q-mini">
                  {u.dolore != null && (
                    <div>
                      <b>{u.dolore}<small>/10</small></b>
                      <span>Dolore</span>
                    </div>
                  )}
                  {u.sforzo != null && (
                    <div>
                      <b>{u.sforzo}<small>/10</small></b>
                      <span>Sforzo</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {nProgressioni > 0 && (
          <Vai verso={{ scheda: 'percorso', sezione: 'progressioni' }} onVai={onVai} etichetta="Percorso">
            <div className="q-titoletto">Progressioni</div>
            <div className="q-progressioni">
              {dati.progressioni.slice(0, 4).map((p) => (
                <div key={p.id} className="q-prog">
                  <span>{p.nome}</span>
                  <span className="hint">
                    {p.completata ? 'completata' : `step ${p.posizione + 1} di ${p.step.length}`}
                  </span>
                  <div className="q-scala" aria-hidden="true">
                    {p.step.map((st) => (
                      <span key={st.id} className={st.stato === 'fatto' ? 'f' : st.stato === 'attuale' ? 'a' : ''} />
                    ))}
                  </div>
                </div>
              ))}
              {nProgressioni > 4 && <div className="hint">+{nProgressioni - 4} altre</div>}
            </div>
          </Vai>
        )}

        <Vai verso={{ scheda: 'diario' }} onVai={onVai} etichetta="Diario">
          <div className="q-titoletto">Prossime sedute</div>
          {dati.programmate.length === 0 ? (
            <p className="hint">Nessuna seduta in programma.</p>
          ) : (
            <ul className="q-prossime">
              {dati.programmate.slice(0, 3).map((p: SedutaRiepilogo) => (
                <li key={p.id}>
                  <span className="q-giorno">
                    <small>{giornoSettimana(p.data)}</small>
                    <b>{numeroGiorno(p.data)}</b>
                  </span>
                  <span>{p.focus || p.fase_nome || 'Seduta'}</span>
                </li>
              ))}
              {dati.programmate.length > 3 && <li className="altri">+{dati.programmate.length - 3} altre</li>}
            </ul>
          )}
          <div className="q-settimana-testo">
            {s.previste != null
              ? `Questa settimana ${s.fatte} di ${s.previste}`
              : `Questa settimana: ${s.fatte} ${s.fatte === 1 ? 'seduta' : 'sedute'}`}
          </div>
          {segmenti > 0 && (
            <div className="q-settimana" aria-hidden="true">
              {Array.from({ length: segmenti }, (_, i) => (
                <span key={i} className={i < s.fatte ? 'f' : ''} />
              ))}
            </div>
          )}
        </Vai>
      </div>

      {/* ---- I numeri: solo quelli che ci sono ---- */}
      {(d || lsi || q || m.aperti > 0) && (
        <div className="q-numeri">
          {d && (
            <Vai verso={{ scheda: 'diario' }} onVai={onVai} etichetta="Diario">
              <div className="q-titoletto">
                Dolore{' '}
                <Aiuto testo="Il dolore segnato in fondo alle sedute e, prima ancora, i punti del grafico dall'esordio nell'anamnesi. Il numero grande è l'ultimo." />
              </div>
              <div className="q-numero-riga">
                <div>
                  <div className="q-valore">
                    {d.ultimo}
                    <small>/10</small>
                  </div>
                  {d.serie.length > 1 && (
                    <span className={`q-pill ${d.differenza < 0 ? 'ok' : d.differenza > 0 ? 'no' : 'neutro'}`}>
                      {d.differenza < 0 ? (
                        <TrendingDown size={12} aria-hidden="true" />
                      ) : d.differenza > 0 ? (
                        <TrendingUp size={12} aria-hidden="true" />
                      ) : (
                        <Minus size={12} aria-hidden="true" />
                      )}
                      {d.differenza === 0 ? `uguale all'inizio (${d.primo})` : `da ${d.primo} all'inizio`}
                    </span>
                  )}
                </div>
                <LineettaDolore serie={d.serie} />
              </div>
            </Vai>
          )}

          {lsi && (
            <Vai verso={{ scheda: 'pedana' }} onVai={onVai} etichetta="Pedana">
              <div className="q-titoletto">LSI più basso</div>
              <div className="q-valore">
                {lsi.valore}
                <small>%</small>
              </div>
              <span className={`q-pill ${classeLsi(lsi.valore)}`}>
                {ICONA_CLASSE[classeLsi(lsi.valore)]}
                {TESTO_CLASSE[classeLsi(lsi.valore)]}
              </span>
              <div className="q-sotto">
                <b className="q-test">{lsi.test}</b> · {formatData(lsi.data)}
                {lsi.altri > 0 &&
                  `
altri ${lsi.altri} test${
                    lsi.minimoAltri != null
                      ? lsi.minimoAltri === lsi.massimoAltri
                        ? ` a ${lsi.minimoAltri}%`
                        : ` fra ${lsi.minimoAltri}% e ${lsi.massimoAltri}%`
                      : ''
                  }`}
              </div>
            </Vai>
          )}

          {q && (
            <Vai verso={{ scheda: 'clinica', sezione: 'questionari' }} onVai={onVai} etichetta="Questionari">
              <div className="q-titoletto">{q.nome}</div>
              <div className="q-valore">{String(q.valore).replace('.', ',')}</div>
              {q.cambio ? (
                <span className={`q-pill ${q.cambio.migliora === true ? 'ok' : q.cambio.migliora === false ? 'no' : 'neutro'}`}>
                  {q.cambio.differenza > 0 ? (
                    <TrendingUp size={12} aria-hidden="true" />
                  ) : q.cambio.differenza < 0 ? (
                    <TrendingDown size={12} aria-hidden="true" />
                  ) : (
                    <Minus size={12} aria-hidden="true" />
                  )}
                  {q.cambio.differenza === 0
                    ? `uguale al ${formatData(q.cambio.dal)}`
                    : `${q.cambio.differenza > 0 ? '+' : '−'}${String(Math.abs(q.cambio.differenza)).replace('.', ',')} dal ${formatData(q.cambio.dal)}`}
                </span>
              ) : (
                <span className="q-pill neutro">prima compilazione</span>
              )}
              <div className="q-sotto">
                {q.punteggioNome !== 'Totale' && q.punteggioNome ? `${q.punteggioNome} · ` : ''}
                compilato il {formatData(q.data)}
              </div>
            </Vai>
          )}

          {m.aperti > 0 && m.primo && (
            <Vai verso={{ scheda: 'clinica', sezione: 'promemoria' }} onVai={onVai} etichetta="Promemoria">
              <div className="q-titoletto">
                Promemoria {m.aperti > 1 && <span className="q-conta">{m.aperti}</span>}
              </div>
              <div className="q-promemoria-testo">{testoPromemoria(m.primo)}</div>
              <span className={`q-pill ${m.giorniScaduto != null ? 'no' : 'neutro'}`}>
                <Bell size={12} aria-hidden="true" />
                {m.giorniScaduto != null ? `scaduto dal ${formatData(m.primo.scadenza)}` : `per il ${formatData(m.primo.scadenza)}`}
              </span>
              {m.scaduti > 1 && <div className="q-sotto">{m.scaduti} scaduti in tutto</div>}
            </Vai>
          )}
        </div>
      )}
    </div>
  )
}
