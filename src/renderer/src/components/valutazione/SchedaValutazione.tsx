import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type {
  Andamento,
  MovimentoDistretto,
  NoteMovimenti,
  DistrettoCompleto,
  LatoRilievo,
  RilievoMovimento,
  RilievoTest,
  ValutazioneCompleta
} from '../../../../shared/types'
import { toast, toastErrore } from '../Toast'
import { useClicSulFondo } from '../../clicSulFondo'
import { errMsg } from '../../lib'
import { useScorciatoie } from '../../scorciatoie'
import { useSalvataggio } from '../../salvataggio'
import IndicatoreSalvataggio from '../IndicatoreSalvataggio'
import { GRUPPI } from '../../pages/DistrettiPage'
import { TipoMovimento, TabellaMovimenti } from './TabellaMovimenti'
import { TabellaTest } from './TabellaTest'
import { SezioneNeuro } from './SezioneNeuro'

const ANDAMENTI: { valore: Andamento; etichetta: string; icona: React.JSX.Element }[] = [
  // Sui pulsanti una freccia; la parola resta nel suggerimento e nei documenti.
  // Le etichette concordano con "capacita' di carico", che e' femminile. Il
  // valore salvato resta quello di prima: le valutazioni gia' fatte non cambiano.
  { valore: 'aumentato', etichetta: 'Aumentata', icona: <ArrowUp size={16} /> },
  { valore: 'invariato', etichetta: 'Invariata', icona: <Minus size={16} /> },
  { valore: 'diminuito', etichetta: 'Diminuita', icona: <ArrowDown size={16} /> }
]

export function SchedaValutazione({
  id,
  soloLettura,
  latoInteressato,
  onChiudi
}: {
  id: number
  soloLettura: boolean
  // il lato operato o infortunato scritto nel paziente, se c'e'
  latoInteressato: 'dx' | 'sx' | null
  onChiudi: (salvata: boolean) => void
}): React.JSX.Element {
  const [dati, setDati] = useState<ValutazioneCompleta | null>(null)
  const [librerie, setLibrerie] = useState<DistrettoCompleto[]>([])
  const [modificato, setModificato] = useState(false)
  const [voceAttiva, setVoceAttiva] = useState('ispezione')
  // Chiudendo il programma, o uscendo da questa scheda, a valutazione non
  // salvata: si salva da sola.
  const salvataggio = useSalvataggio(!soloLettura && modificato)

  useScorciatoie([
    { tasto: 'Escape', azione: () => void chiudi() },
    { tasto: 's', ctrl: true, azione: () => void salvataggio.salva(), attiva: !soloLettura && modificato }
  ])

  // Un clic fuori dalla finestra la chiude: quello che c'era di non salvato
  // si salva da solo (vedi useSalvataggio sopra).
  const chiudi = (): void => {
    onChiudi(modificato)
  }
  const sulFondo = useClicSulFondo(() => void chiudi())

  useEffect(() => {
    void (async () => {
      try {
        const v = await window.api.valutazioni.get(id)
        setDati(v)
        setLibrerie(await Promise.all(v.distretto_ids.map((d) => window.api.distretti.get(d))))
      } catch (e) {
        toastErrore(errMsg(e))
      }
    })()
  }, [id])

  if (!dati) {
    return (
      <div className="modal-overlay caricamento-ritardato">
        <div className="modal">
          <p className="hint caricamento-ritardato">Caricamento…</p>
        </div>
      </div>
    )
  }

  const aggiorna = (patch: Partial<ValutazioneCompleta>): void => {
    setDati({ ...dati, ...patch })
    setModificato(true)
  }

  const campoValutazione = (patch: Partial<ValutazioneCompleta['valutazione']>): void =>
    aggiorna({ valutazione: { ...dati.valutazione, ...patch } })

  // Un rilievo e' di un movimento e di un lato: '' per i distretti che non
  // hanno lato, 'dx' e 'sx' per quelli che si valutano da tutte e due le parti.
  const stesso = (m: RilievoMovimento, movimentoId: number, lato: LatoRilievo): boolean =>
    m.movimento_id === movimentoId && (m.lato ?? '') === lato

  const rilievoIn = (
    lista: RilievoMovimento[],
    movimentoId: number,
    lato: LatoRilievo
  ): RilievoMovimento =>
    lista.find((m) => stesso(m, movimentoId, lato)) ?? {
      movimento_id: movimentoId,
      lato,
      attivo_restrizione: null,
      attivo_dolore: null,
      attivo_gradi: null,
      passivo_restrizione: null,
      passivo_dolore: null,
      passivo_gradi: null,
      nota: null,
      norma: null,
      passivo_norma: null
    }

  const rilievo = (movimentoId: number, lato: LatoRilievo): RilievoMovimento =>
    rilievoIn(dati.movimenti, movimentoId, lato)

  const cambiaMovimento = (
    movimentoId: number,
    lato: LatoRilievo,
    patch: Partial<RilievoMovimento>
  ): void => {
    const nuovo = { ...rilievo(movimentoId, lato), ...patch }
    // Segnare un'intensita' o il dolore vuol dire che nella norma non e': per
    // l'attivo o per il passivo, ognuno per conto suo.
    const segnato = (k: keyof RilievoMovimento): boolean => k in patch && patch[k] != null
    if (segnato('attivo_restrizione') || segnato('attivo_dolore')) nuovo.norma = null
    if (segnato('passivo_restrizione') || segnato('passivo_dolore')) nuovo.passivo_norma = null
    aggiorna({
      movimenti: [...dati.movimenti.filter((m) => !stesso(m, movimentoId, lato)), nuovo]
    })
  }

  // "Il resto nella norma", per l'attivo o per il passivo di un lato: segna
  // tutti i movimenti che non hanno ne' un'intensita' ne' il dolore. Quelli gia'
  // segnati restano come sono. Ripremuto quando e' gia' fatto, toglie le spunte.
  const campoNorma = (tipo: TipoMovimento): 'norma' | 'passivo_norma' =>
    tipo === 'attivo' ? 'norma' : 'passivo_norma'
  const segnatoIn = (r: RilievoMovimento, tipo: TipoMovimento): boolean =>
    r[`${tipo}_restrizione`] != null || (r[`${tipo}_dolore`] ?? 0) > 0

  const restoFatto = (movimenti: MovimentoDistretto[], lato: LatoRilievo, tipo: TipoMovimento): boolean => {
    const righe = movimenti.map((m) => rilievo(m.id as number, lato))
    return (
      righe.some((r) => r[campoNorma(tipo)] === 1) &&
      righe.every((r) => r[campoNorma(tipo)] === 1 || segnatoIn(r, tipo))
    )
  }

  const restoNellaNorma = (movimenti: MovimentoDistretto[], lato: LatoRilievo, tipo: TipoMovimento): void => {
    const togli = restoFatto(movimenti, lato, tipo)
    const campo = campoNorma(tipo)
    let lista = dati.movimenti
    for (const m of movimenti) {
      const r = rilievoIn(lista, m.id as number, lato)
      if (togli ? r[campo] !== 1 : r[campo] === 1 || segnatoIn(r, tipo)) continue
      lista = [
        ...lista.filter((x) => !stesso(x, m.id as number, lato)),
        { ...r, [campo]: togli ? null : 1 }
      ]
    }
    aggiorna({ movimenti: lista })
  }

  const noteDi = (distrettoId: number): NoteMovimenti =>
    dati.note_movimenti.find((n) => n.distretto_id === distrettoId) ?? {
      distretto_id: distrettoId,
      attivo: null,
      passivo: null,
      neuro: null
    }

  const cambiaNote = (distrettoId: number, patch: Partial<NoteMovimenti>): void => {
    const nuovo = { ...noteDi(distrettoId), ...patch }
    aggiorna({
      note_movimenti: [
        ...dati.note_movimenti.filter((n) => n.distretto_id !== distrettoId),
        nuovo
      ]
    })
  }

  // Un rilievo neurologico e' di una voce e di un lato; valore null lo toglie.
  const cambiaNeuro = (voceId: number, lato: 'sx' | 'dx', valore: string | null): void => {
    const altri = dati.neuro.filter((n) => !(n.voce_id === voceId && n.lato === lato))
    aggiorna({ neuro: valore == null ? altri : [...altri, { voce_id: voceId, lato, valore }] })
  }

  const rispostaTest = (testId: number, lato: LatoRilievo): RilievoTest =>
    dati.test.find((t) => t.test_id === testId && (t.lato ?? '') === lato) ?? {
      test_id: testId,
      lato,
      valore: null,
      nota: null
    }

  // Con i due lati la nota e' una sola, del test: sta nella riga del primo
  // lato. Se una valutazione vecchia ne ha due, si leggono insieme e alla prima
  // modifica diventano una.
  const notaTest = (testId: number, lati: LatoRilievo[]): string =>
    [...new Set(lati.map((l) => rispostaTest(testId, l).nota).filter(Boolean))].join(' — ')

  const cambiaNotaTest = (testId: number, lati: LatoRilievo[], nota: string | null): void => {
    const [primo, ...altri] = lati
    aggiorna({
      test: [
        ...dati.test.filter((t) => !(t.test_id === testId && lati.includes((t.lato ?? '') as LatoRilievo))),
        { ...rispostaTest(testId, primo), nota },
        ...altri.map((l) => ({ ...rispostaTest(testId, l), nota: null }))
      ]
    })
  }

  const cambiaTest = (testId: number, lato: LatoRilievo, patch: Partial<RilievoTest>): void => {
    const nuovo = { ...rispostaTest(testId, lato), ...patch }
    aggiorna({
      test: [
        ...dati.test.filter((t) => !(t.test_id === testId && (t.lato ?? '') === lato)),
        nuovo
      ]
    })
  }

  // Da quali lati si valuta un distretto. Se nella libreria ha il lato si' — a
  // meno che questa valutazione non sia stata scritta prima, senza lati: allora
  // resta com'era, altrimenti i valori di quel giorno sparirebbero dalla vista.
  const latiDi = (lib: DistrettoCompleto): LatoRilievo[] => {
    if (lib.distretto.bilaterale !== 1) return ['']
    const movimenti = new Set(lib.movimenti.map((m) => m.id))
    const test = new Set(lib.test.map((t) => t.id))
    const scrittaSenzaLati =
      dati.movimenti.some((m) => movimenti.has(m.movimento_id) && (m.lato ?? '') === '') ||
      dati.test.some((t) => test.has(t.test_id) && (t.lato ?? '') === '')
    // In tabella la sinistra sta a sinistra e la destra a destra, come si
    // guarda il paziente di fronte: l'ordine dei due lati parte da qui.
    return scrittaSenzaLati ? [''] : ['sx', 'dx']
  }

  salvataggio.funzione.current = () => salva()
  const salva = async (): Promise<boolean> => {
    try {
      await window.api.valutazioni.salva(dati)
      toast('Valutazione salvata.')
      // gia' salvata: chiudendosi non deve salvarla una seconda volta
      salvataggio.funzione.current = null
      onChiudi(true)
      return true
    } catch (e) {
      toastErrore(errMsg(e))
      return false
    }
  }

  // L'indice a sinistra: una voce per ogni parte della pagina, con un cenno di
  // quanto c'e' di segnato. Un clic porta li'.
  const vaiA = (chiave: string): void => {
    setVoceAttiva(chiave)
    document.getElementById(`val-${chiave}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  const segnatiMovimenti = (lib: DistrettoCompleto): number => {
    const ids = new Set(lib.movimenti.map((m) => m.id))
    return dati.movimenti.filter(
      (r) =>
        ids.has(r.movimento_id) &&
        (r.attivo_restrizione != null ||
          (r.attivo_dolore ?? 0) > 0 ||
          r.passivo_restrizione != null ||
          (r.passivo_dolore ?? 0) > 0)
    ).length
  }
  const positivi = (lib: DistrettoCompleto): number => {
    const ids = new Set(lib.test.map((t) => t.id))
    return dati.test.filter((r) => ids.has(r.test_id) && r.valore === 'positivo').length
  }
  const CARICHI = ['carico_locale', 'carico_generale', 'capacita_locale', 'capacita_generale'] as const
  const voci: { chiave: string; titolo: string; nota: string }[] = [
    {
      chiave: 'ispezione',
      titolo: 'Ispezione',
      nota: (dati.valutazione.ispezione ?? '').trim() ? 'scritta' : 'vuota'
    },
    ...librerie.flatMap((lib) => {
      const n = lib.distretto.id as number
      const mov = segnatiMovimenti(lib)
      const pos = positivi(lib)
      return [
        ...(lib.movimenti.length > 0
          ? [
              {
                chiave: `mov-${n}`,
                titolo: `${lib.distretto.nome} · movimenti`,
                nota: mov > 0 ? `${mov} segnati` : 'niente segnato'
              }
            ]
          : []),
        ...(lib.test.length > 0
          ? [
              {
                chiave: `test-${n}`,
                titolo: `${lib.distretto.nome} · test`,
                nota: pos > 0 ? `${pos} positivi` : `${lib.test.length} test`
              }
            ]
          : []),
        ...(lib.distretto.esame_neuro === 1 && lib.neuro.length > 0
          ? [{ chiave: `neuro-${n}`, titolo: `${lib.distretto.nome} · neurologico`, nota: 'esame' }]
          : [])
      ]
    }),
    {
      chiave: 'carico',
      titolo: 'Carico',
      nota: `${CARICHI.filter((k) => dati.valutazione[k] != null).length} su 4`
    },
    { chiave: 'note', titolo: 'Note', nota: (dati.valutazione.note ?? '').trim() ? 'scritte' : 'vuote' }
  ]

  return (
    <div className="modal-overlay" {...sulFondo}>
      <div className="modal val-pagina" onClick={(e) => e.stopPropagation()}>
        <div className="val-testa">
          <h3>{soloLettura ? 'Valutazione obiettiva' : 'Valutazione obiettiva — modifica'}</h3>
          <label className="campo-data-pillola">
            <small>Data</small>
            <input
              type="date"
              disabled={soloLettura}
              value={dati.valutazione.data}
              onChange={(e) => campoValutazione({ data: e.target.value })}
            />
          </label>
          <span className="val-spazio" />
          {!soloLettura && <IndicatoreSalvataggio stato={salvataggio.stato} errore={salvataggio.errore} />}
          <button onClick={() => void chiudi()}>{soloLettura ? 'Chiudi' : 'Annulla'}</button>
          {!soloLettura && (
            <button
              className="primary"
              disabled={!modificato || salvataggio.stato === 'salvo'}
              onClick={() => void salvataggio.salva()}
            >
              Salva
            </button>
          )}
        </div>

        <div className="val-corpo">
          <nav className="val-indice" aria-label="Parti della valutazione">
            {voci.map((v) => (
              <button
                key={v.chiave}
                type="button"
                className={voceAttiva === v.chiave ? 'attiva' : ''}
                onClick={() => vaiA(v.chiave)}
              >
                <b>{v.titolo}</b>
                <small>{v.nota}</small>
              </button>
            ))}
          </nav>

          <div className="val-colonna">
            <section id="val-ispezione" className="riquadro-test">
              <div className="sotto-titolo">Ispezione, osservazione e palpazione</div>
              {/* In anteprima la casella cresce fino a mostrare tutto il testo:
                  da leggere non serve scorrerla dentro una finestra di due righe. */}
              <textarea
                rows={4}
                className={soloLettura ? 'testo-adatta' : undefined}
                aria-label="Ispezione, osservazione e palpazione"
                disabled={soloLettura}
                value={dati.valutazione.ispezione ?? ''}
                onChange={(e) => campoValutazione({ ispezione: e.target.value || null })}
              />
            </section>

            {/* Un gruppo per distretto: i movimenti e ogni gruppo di test sono
                riquadri a parte, cosi' si vede dove finisce una cosa e comincia
                l'altra. */}
            {librerie.map((lib) => {
              const lati = latiDi(lib)
              const n = lib.distretto.id as number
              return (
                <div key={n} className="riquadro-distretto">
                  <h4 className="titolo-distretto">{lib.distretto.nome}</h4>

                  {lib.movimenti.length > 0 && (
                    <div id={`val-mov-${n}`}>
                      <TabellaMovimenti
                        movimenti={lib.movimenti}
                        lati={lati}
                        latoInteressato={latoInteressato}
                        soloLettura={soloLettura}
                        rilievo={rilievo}
                        onCambia={cambiaMovimento}
                        onRestoNellaNorma={(lato, tipo) => restoNellaNorma(lib.movimenti, lato, tipo)}
                        restoFatto={(lato, tipo) => restoFatto(lib.movimenti, lato, tipo)}
                        note={noteDi(n)}
                        onNote={(patch) => cambiaNote(n, patch)}
                      />
                    </div>
                  )}

                  <div id={`val-test-${n}`}>
                    {GRUPPI.map((g) => {
                      // la forza dei muscoli compare solo dove l'interruttore e' acceso
                      if (g.valore === 'forza' && lib.distretto.test_muscolari !== 1) return null
                      const test = lib.test.filter((t) => t.gruppo === g.valore)
                      if (test.length === 0) return null
                      return (
                        <div key={g.valore} className="riquadro-test">
                          <div className="sotto-titolo">{g.etichetta}</div>
                          <TabellaTest
                            test={test}
                            lati={lati}
                            latoInteressato={latoInteressato}
                            soloLettura={soloLettura}
                            risposta={rispostaTest}
                            onCambia={cambiaTest}
                            nota={(id) => notaTest(id, lati)}
                            onNota={(id, nota) => cambiaNotaTest(id, lati, nota)}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {lib.distretto.esame_neuro === 1 && (
                    <div id={`val-neuro-${n}`}>
                      <SezioneNeuro
                        voci={lib.neuro}
                        rilievi={dati.neuro.filter((x) => lib.neuro.some((v) => v.id === x.voce_id))}
                        nota={noteDi(n).neuro ?? ''}
                        latoInteressato={latoInteressato}
                        soloLettura={soloLettura}
                        onCambia={cambiaNeuro}
                        onNota={(neuro) => cambiaNote(n, { neuro })}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            <section id="val-carico" className="riquadro-test">
              <div className="sotto-titolo">Carico e capacità di carico</div>
              <div className="griglia-carico">
                {(
                  [
                    ['carico_locale', 'Carico locale'],
                    ['carico_generale', 'Carico generale'],
                    ['capacita_locale', 'Capacità di carico locale'],
                    ['capacita_generale', 'Capacità di carico generale']
                  ] as const
                ).map(([chiave, etichetta]) => (
                  <div key={chiave} className="riga-sino">
                    <span>{etichetta}</span>
                    {/* Tre pulsanti invece della tendina: si sceglie con un clic, e
                        ripremendo quello scelto si toglie. */}
                    <span className="scelta-coppia segmentata scelta-andamento">
                      {ANDAMENTI.map((a) => {
                        const scelto = dati.valutazione[chiave] === a.valore
                        return (
                          <button
                            key={a.valore}
                            type="button"
                            title={a.etichetta}
                            disabled={soloLettura}
                            className={scelto ? 'scelta-attiva' : ''}
                            onClick={() => campoValutazione({ [chiave]: scelto ? null : a.valore })}
                          >
                            {a.icona}
                          </button>
                        )
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section id="val-note" className="riquadro-test">
              <div className="sotto-titolo">Note</div>
              <textarea
                rows={2}
                aria-label="Note"
                disabled={soloLettura}
                value={dati.valutazione.note ?? ''}
                onChange={(e) => campoValutazione({ note: e.target.value || null })}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
