import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, RotateCcw, Star } from 'lucide-react'
import StatoVuoto from '../components/StatoVuoto'
import MenuAltro from '../components/MenuAltro'
import type { PazienteDettaglio, Promemoria } from '../../../shared/types'
import { toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import { errMsg, formatData, testoPromemoria, oggiIso, aggiungiGiorni } from '../lib'

// Chi hai da sentire e chi hai finito di seguire, in un elenco solo.
//
// «Da fare» mette in fila per data i questionari, gli screening e i test da
// rifare e i pazienti da risentire: prima gli scaduti e quelli di oggi, poi la
// settimana, poi il resto. «Follow-up» e «Conclusi» sono gli elenchi completi.
// Chi stai seguendo adesso non e' qui: sta nell'elenco dei pazienti, dove si
// mette in follow-up o si conclude dalla riga.
//
// La spunta «sentito» vuol dire «sentito, e per ora non ho altro in
// programma»: rimettendo una data si toglie da sola. La data dell'ultimo
// contatto resta, cosi' non si perde la memoria di quando lo hai sentito.

type Filtro = 'fare' | 'followup' | 'conclusi'

const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

function dataLocale(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`)
}

// «Oggi», «Da 4 giorni» per chi e' in ritardo, poi «Gio 26» e, piu' in la,
// «Gio 3 dic». Sempre con la maiuscola.
function quando(iso: string, oggi: string): { grande: string; piccolo: string } {
  const diff = Math.round((dataLocale(iso).getTime() - dataLocale(oggi).getTime()) / 86400000)
  const piccolo = diff < 0 ? `era il ${formatData(iso)}` : ''
  if (diff === 0) return { grande: 'Oggi', piccolo }
  if (diff < 0) return { grande: diff === -1 ? 'Da 1 giorno' : `Da ${-diff} giorni`, piccolo }
  const d = dataLocale(iso)
  const g = GIORNI[d.getDay()]
  if (diff === 1) return { grande: `Domani`, piccolo: `${g} ${d.getDate()}` }
  if (diff <= 7) return { grande: `${g} ${d.getDate()}`, piccolo: '' }
  return { grande: `${g} ${d.getDate()} ${MESI[d.getMonth()]}`, piccolo: '' }
}

interface Voce {
  chiave: string
  pazienteId: number
  nome: string
  sotto: string
  pillola: string
  tono: 'att' | 'acc'
  data: string | null
  azione?: { etichetta: string; fa: () => Promise<unknown> }
  menu: Parameters<typeof MenuAltro>[0]['voci']
}

export default function FollowUpPage({
  onApriPaziente,
  ricarica,
  onCambiato
}: {
  // Porta alla scheda del paziente, nella sezione "Pazienti".
  onApriPaziente: (id: number) => void
  // Cambia quando si ripreme "Follow-up" nel menu: qui non c'e' niente da
  // chiudere, quindi si rilegge l'elenco.
  ricarica: number
  // Dopo ogni cambiamento: il menu rilegge quanti sono da sentire.
  onCambiato?: () => void
}): React.JSX.Element {
  const [concluso, setConcluso] = useState<PazienteDettaglio[]>([])
  const [promemoria, setPromemoria] = useState<Promemoria[]>([])
  const [filtro, setFiltro] = useState<Filtro>('fare')
  const [ricerca, setRicerca] = useState('')

  const carica = useCallback(async (): Promise<void> => {
    try {
      const { concluso: c } = await window.api.followUp.list()
      setConcluso(c)
      setPromemoria(await window.api.promemoria.list(null))
      onCambiato?.()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [])

  useEffect(() => {
    void carica()
  }, [carica, ricarica])

  const esegui = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const norma = (t: string): string =>
    t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const cercato = norma(ricerca.trim())
  const corrisponde = (p: { nome: string; cognome: string }): boolean =>
    cercato === '' ||
    norma(`${p.cognome} ${p.nome}`).includes(cercato) ||
    norma(`${p.nome} ${p.cognome}`).includes(cercato)

  // Chiude il follow-up di chi e' gia' li': passa fra i conclusi, senza data e
  // senza "contattato" (la data dell'ultimo contatto non resta).
  const chiudiFollowUp = async (p: PazienteDettaglio): Promise<void> => {
    if (
      !(await chiedi(
        `Concludere ${p.nome} ${p.cognome}?\n\nEsce dal follow-up e finisce fra i conclusi, senza altri contatti in programma.`
      ))
    ) {
      return
    }
    void esegui(async () => {
      await window.api.followUp.setStato(p.id, 'concluso', null)
      await window.api.followUp.segnaContattato(p.id, false)
    })
  }

  const riprendi = async (p: PazienteDettaglio): Promise<void> => {
    if (
      !(await chiedi(
        `${p.nome} ${p.cognome} ha ripreso il trattamento?\n\n` +
          'Torna nell’elenco di chi stai seguendo. La data del prossimo contatto viene tolta, ' +
          'la recensione e la data dell’ultimo contatto restano.'
      ))
    ) {
      return
    }
    void esegui(() => window.api.followUp.setStato(p.id, 'trattamento', null))
  }

  const oggi = oggiIso()
  // Chi ha concluso senza follow-up (nessuna data e mai contattato) sta nei
  // conclusi; tutti gli altri restano nel follow-up come sempre, anche quando
  // li hai gia' sentiti.
  const tuttiConclusi = concluso.filter((p) => p.follow_up_il == null && p.contattato_il == null)
  const tuttiInFollowUp = concluso.filter((p) => !tuttiConclusi.includes(p))

  const menuFollowUp = (p: PazienteDettaglio): Voce['menu'] => [
    {
      etichetta: p.recensione === 1 ? 'Togli la recensione' : 'Ha lasciato la recensione',
      icona: Star,
      onClick: () => void esegui(() => window.api.followUp.setRecensione(p.id, p.recensione !== 1))
    },
    { etichetta: 'Ha ripreso il trattamento', icona: RotateCcw, onClick: () => void riprendi(p) },
    { etichetta: 'Concludi', icona: CheckCircle2, onClick: () => void chiudiFollowUp(p) }
  ]

  // Le righe di «Da fare»: promemoria e follow-up con una data, per data.
  const daFare: Voce[] = [
    ...promemoria
      .filter((m) => corrisponde({ nome: m.paziente_nome, cognome: m.paziente_cognome }))
      .map<Voce>((m) => ({
        chiave: `m${m.id}`,
        pazienteId: m.paziente_id,
        nome: `${m.paziente_cognome} ${m.paziente_nome}`,
        sotto: m.nota ?? '',
        pillola: testoPromemoria(m),
        tono: 'att',
        data: m.scadenza,
        azione: { etichetta: 'Fatto', fa: () => window.api.promemoria.setFatto(m.id, true) },
        menu: []
      })),
    ...tuttiInFollowUp
      .filter((p) => p.follow_up_il != null && corrisponde(p))
      .map<Voce>((p) => ({
        chiave: `f${p.id}`,
        pazienteId: p.id,
        nome: `${p.cognome} ${p.nome}`,
        sotto: p.patologia_nome ?? '',
        pillola: 'Da risentire',
        tono: 'acc',
        data: p.follow_up_il,
        azione: { etichetta: 'Sentito', fa: () => window.api.followUp.segnaContattato(p.id, true) },
        menu: menuFollowUp(p)
      }))
  ].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))

  const finoA = aggiungiGiorni(oggi, 7)
  const gruppi = [
    { titolo: 'Scaduti o oggi', voci: daFare.filter((v) => (v.data ?? '') <= oggi) },
    {
      titolo: 'Questa settimana',
      voci: daFare.filter((v) => (v.data ?? '') > oggi && (v.data ?? '') <= finoA)
    },
    { titolo: 'Più avanti', voci: daFare.filter((v) => (v.data ?? '') > finoA) }
  ].filter((g) => g.voci.length > 0)

  const inFollowUp = tuttiInFollowUp
    .filter(corrisponde)
    .sort((a, b) => (a.follow_up_il ?? '9999').localeCompare(b.follow_up_il ?? '9999'))
  const conclusi = tuttiConclusi.filter(corrisponde)

  const riga = (v: Voce): React.JSX.Element => {
    const q = v.data ? quando(v.data, oggi) : null
    return (
      <div key={v.chiave} className="riga-lista riga-fu" onClick={() => onApriPaziente(v.pazienteId)}>
        <span className="chi-testo">
          <b>{v.nome}</b>
          {v.sotto && <span className="dettaglio-riga">{v.sotto}</span>}
        </span>
        <span>
          <span className={`pillola ${v.tono}`}>{v.pillola}</span>
        </span>
        <span className="quando">
          {q && (
            <>
              <b className={v.data! <= oggi ? 'in-ritardo' : ''}>{q.grande}</b>
              {q.piccolo && <span className="dettaglio-riga">{q.piccolo}</span>}
            </>
          )}
        </span>
        <span className="azioni-riga" onClick={(e) => e.stopPropagation()}>
          {v.azione && (
            <button className="btn-piccolo" onClick={() => void esegui(v.azione!.fa)}>
              ✓ {v.azione.etichetta}
            </button>
          )}
          {v.menu.length > 0 && <MenuAltro voci={v.menu} />}
        </span>
      </div>
    )
  }

  const vuoto = (titolo: string, testo: string): React.JSX.Element => (
    <StatoVuoto icona={CalendarClock} titolo={titolo} testo={testo} />
  )

  return (
    <div className="page">
      <header className="page-header">
        <h2>Follow-up</h2>
      </header>

      <div className="scheda">
        <div className="ricerca-sopra">
          <input
            type="search"
            placeholder="Cerca paziente…"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
          <div className="filtri-pillola" role="group" aria-label="Quali elenchi">
            {(
              [
                ['fare', 'Da fare', daFare.length],
                ['followup', 'Follow-up', tuttiInFollowUp.length],
                ['conclusi', 'Conclusi', tuttiConclusi.length]
              ] as const
            ).map(([valore, etichetta, quanti]) => (
              <button
                key={valore}
                className={filtro === valore ? 'attiva' : ''}
                aria-pressed={filtro === valore}
                onClick={() => setFiltro(valore)}
              >
                {etichetta} · {quanti}
              </button>
            ))}
          </div>
        </div>

        {filtro === 'fare' &&
          (gruppi.length === 0 ? (
            vuoto(
              ricerca ? 'Nessun risultato' : 'Niente da fare',
              ricerca
                ? 'Nessun paziente corrisponde alla ricerca.'
                : 'Qui compaiono i questionari e i test da rifare e i pazienti da risentire, in ordine di data.'
            )
          ) : (
            <div className="elenco-righe">
              {gruppi.map((g) => (
                <div key={g.titolo}>
                  <div className="gruppo-righe">
                    {g.titolo} <span className="conta-gruppo">{g.voci.length}</span>
                  </div>
                  {g.voci.map(riga)}
                </div>
              ))}
            </div>
          ))}

        {filtro === 'followup' &&
          (inFollowUp.length === 0 ? (
            vuoto(
              ricerca ? 'Nessun risultato' : 'Nessun paziente in follow-up',
              ricerca
                ? 'Nessun paziente corrisponde alla ricerca.'
                : 'Quando metti un paziente in follow-up dall’elenco dei pazienti, finisce qui con la data in cui risentirlo.'
            )
          ) : (
            <div className="elenco-righe">
              {inFollowUp.map((p) => (
                <div
                  key={p.id}
                  className="riga-lista riga-fu"
                  onClick={() => onApriPaziente(p.id)}
                >
                  <span className="chi-testo">
                    <b>
                      {p.cognome} {p.nome}
                    </b>
                    <span className="dettaglio-riga">
                      {p.contattato_il
                        ? `Ultimo contatto ${formatData(p.contattato_il)}`
                        : (p.patologia_nome ?? '')}
                    </span>
                  </span>
                  <span>
                    {p.follow_up_il == null ? (
                      <span className="pillola ok">Sentito</span>
                    ) : p.follow_up_il <= oggi ? (
                      <span className="pillola att">Da risentire</span>
                    ) : null}
                    {p.recensione === 1 && <span className="pillola ok">Recensione</span>}
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                    <input
                      type="date"
                      title="Quando risentirlo"
                      className={p.follow_up_il != null && p.follow_up_il <= oggi ? 'data-scaduta' : ''}
                      value={p.follow_up_il ?? ''}
                      onChange={(e) =>
                        void esegui(() => window.api.followUp.setFollowUp(p.id, e.target.value || null))
                      }
                    />
                  </span>
                  <span className="azioni-riga" onClick={(e) => e.stopPropagation()}>
                    {p.follow_up_il != null && (
                      <button
                        className="btn-piccolo"
                        title="L’ho sentito e non ho altro in programma"
                        onClick={() => void esegui(() => window.api.followUp.segnaContattato(p.id, true))}
                      >
                        ✓ Sentito
                      </button>
                    )}
                    <MenuAltro voci={menuFollowUp(p)} />
                  </span>
                </div>
              ))}
            </div>
          ))}

        {filtro === 'conclusi' &&
          (conclusi.length === 0 ? (
            vuoto(
              ricerca ? 'Nessun risultato' : 'Nessun paziente concluso',
              ricerca
                ? 'Nessun paziente corrisponde alla ricerca.'
                : 'Qui finiscono i pazienti conclusi senza follow-up.'
            )
          ) : (
            <div className="elenco-righe">
              {conclusi.map((p) => (
                <div
                  key={p.id}
                  className="riga-lista riga-fu"
                  onClick={() => onApriPaziente(p.id)}
                >
                  <span className="chi-testo">
                    <b>
                      {p.cognome} {p.nome}
                    </b>
                    <span className="dettaglio-riga">{p.patologia_nome ?? '—'}</span>
                  </span>
                  <span />
                  <span className="dettaglio-riga" />
                  <span className="azioni-riga" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="date"
                      title="Fissa un follow-up: il paziente passa fra quelli in follow-up"
                      value=""
                      onChange={(e) =>
                        e.target.value &&
                        void esegui(() => window.api.followUp.setFollowUp(p.id, e.target.value))
                      }
                    />
                    <MenuAltro
                      voci={[
                        {
                          etichetta: 'Ha ripreso il trattamento',
                          icona: RotateCcw,
                          onClick: () => void riprendi(p)
                        }
                      ]}
                    />
                  </span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  )
}
