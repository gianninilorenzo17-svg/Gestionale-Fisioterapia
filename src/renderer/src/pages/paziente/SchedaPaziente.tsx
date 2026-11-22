import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarPlus,
  ClipboardList,
  Copy,
  Dumbbell,
  House,
  ListChecks,
  PersonStanding,
  Plus,
  Route,
  Stethoscope,
  Target,
  TrendingUp
} from 'lucide-react'
import type { Fase, Patologia, PazienteDettaglio, SedutaRiepilogo } from '../../../../shared/types'
import ProgrammaSettimana from '../../components/ProgrammaSettimana'
import QuestionariPaziente from '../../components/QuestionariPaziente'
import PedanaPaziente from '../../components/pedana/PedanaPaziente'
import PromemoriaPaziente from '../../components/PromemoriaPaziente'
import AnagraficaPaziente from '../../components/AnagraficaPaziente'
import SceltaConRicerca from '../../components/SceltaConRicerca'
import SegniPaziente from '../../components/SegniPaziente'
import IndicazioniCasa from '../../components/IndicazioniCasa'
import MassimaliPaziente from '../../components/MassimaliPaziente'
import ProgressioniPaziente from '../../components/ProgressioniPaziente'
import CaricoSettimane from '../../components/CaricoSettimane'
import AnamnesiPaziente from '../../components/AnamnesiPaziente'
import ValutazionePaziente from '../../components/ValutazionePaziente'
import QuadroPaziente from '../../components/quadro/QuadroPaziente'
import BodyChartPaziente from '../../components/BodyChartPaziente'
import IndiceSezioni, { type VoceIndice } from '../../components/IndiceSezioni'
import { ricordaScheda, schedaPronta, useDatiQuadro } from '../../components/quadro/useDatiQuadro'
import type {
  Destinazione,
  SchedaAperta,
  SezioneClinica,
  SezionePercorso
} from '../../components/quadro/sezioni'
import { useScorciatoie } from '../../scorciatoie'
import { toastErrore } from '../../components/Toast'
import { chiedi } from '../../components/Conferma'
import { errMsg, oggiIso } from '../../lib'
import { ObiettiviCard } from './ObiettiviCard'
import { DiarioCard } from './DiarioCard'

export type { SchedaAperta }

const SCHEDE_PAZIENTE: { key: SchedaAperta; label: string }[] = [
  // Prima voce e prima cosa che si vede aprendo un paziente: e' la domanda
  // che ci si fa per prima, "sta migliorando?", prima ancora di guardare il
  // diario di oggi.
  { key: 'quadro', label: 'Quadro' },
  { key: 'diario', label: 'Diario sedute' },
  { key: 'clinica', label: 'Clinica' },
  { key: 'pedana', label: 'Pedana' },
  { key: 'percorso', label: 'Percorso' }
]

export function SchedaPaziente({
  paziente,
  patologie,
  scheda,
  onSchedaChange,
  onChanged,
  onDeleted,
  onNuovaSeduta,
  onApriSeduta,
  onDuplicaSeduta
}: {
  paziente: PazienteDettaglio
  patologie: Patologia[]
  // Quale linguetta e' aperta: vive nel componente sopra (PazientiPage), non
  // qui, perche' aprire una seduta smonta questo componente. Se lo stato
  // fosse qui dentro, tornando dalla seduta la scheda ripartirebbe sempre dal
  // quadro invece di restare sulla linguetta da cui si era partiti.
  scheda: SchedaAperta
  onSchedaChange: (s: SchedaAperta) => void
  onChanged: () => Promise<void> | void
  onDeleted: () => void
  onNuovaSeduta: () => void
  onApriSeduta: (id: number) => void
  onDuplicaSeduta: (id: number) => void
}): React.JSX.Element {
  // Quando il paziente cambia (una fase avanzata, un dato corretto) le sezioni
  // nascoste si rimontano in silenzio, cosi' quando le si apre sono aggiornate;
  // quella che si sta guardando non si tocca.
  const [versioni, setVersioni] = useState<Record<SchedaAperta, number>>({
    quadro: 0,
    diario: 0,
    clinica: 0,
    pedana: 0,
    percorso: 0
  })
  const schedaRef = useRef(scheda)
  schedaRef.current = scheda
  const primoGiro = useRef(true)
  useEffect(() => {
    if (primoGiro.current) {
      primoGiro.current = false
      return
    }
    setVersioni((v) => {
      const n = { ...v }
      for (const k of Object.keys(n) as SchedaAperta[]) if (k !== schedaRef.current) n[k]++
      return n
    })
  }, [paziente])
  // Chi apre la scheda l'ha gia' letta (preparaScheda in useDatiQuadro.ts): si
  // parte da li', cosi' compare gia' piena, e si rilegge in silenzio.
  const pronta = useRef(schedaPronta(paziente.id)).current
  const [fasi, setFasi] = useState<Fase[]>(pronta?.fasi ?? [])
  // Serve solo a sapere se c'e' una seduta da riprendere e quale.
  const [ultimaSeduta, setUltimaSeduta] = useState<number | null>(
    () => pronta?.sedute.find((s) => s.data <= oggiIso())?.id ?? null
  )

  // Dipende dal paziente intero e non dal solo id: quando si salva una seduta
  // l'elenco dei pazienti si ricarica, l'oggetto cambia, e cosi' "Riprendi
  // l'ultima" punta davvero all'ultima.
  const [sedutePaziente, setSedutePaziente] = useState<SedutaRiepilogo[]>(pronta?.sedute ?? [])
  // Quante sedute aspettano il paziente: si vede sulla linguetta, senza entrare.
  const daFare = sedutePaziente.filter((s) => s.data > oggiIso()).length
  const [programma, setProgramma] = useState(false)

  // Quale parte e' aperta nelle due linguette lunghe. Si ricorda anche tornando
  // alla linguetta, cosi' dopo un giro nel Diario si riparte da dove si era.
  const [sezClinica, setSezClinica] = useState<SezioneClinica>('anamnesi')
  const [sezPercorso, setSezPercorso] = useState<SezionePercorso>('fase')
  // Sale quando dentro una parte cambia qualcosa che l'elenco racconta (una body
  // chart, un segno): le note dell'elenco si rileggono.
  const [rilettura, setRilettura] = useState(0)
  const dati = useDatiQuadro(paziente, sedutePaziente, `${scheda}|${sezClinica}|${sezPercorso}|${rilettura}`)

  // Un clic sul Quadro porta alla linguetta e, dove serve, alla parte giusta.
  const vai = (d: Destinazione): void => {
    if (d.scheda === 'clinica' && d.sezione) setSezClinica(d.sezione)
    if (d.scheda === 'percorso' && d.sezione) setSezPercorso(d.sezione)
    onSchedaChange(d.scheda)
  }

  // I tasti da 1 a 5 cambiano linguetta, nell'ordine in cui stanno: niente mouse
  // per saltare dal Quadro al Diario. Non scattano mentre si scrive.
  useScorciatoie(
    SCHEDE_PAZIENTE.map((t, i) => ({
      tasto: String(i + 1),
      azione: () => onSchedaChange(t.key),
      senzaFinestre: true
    }))
  )

  const ricaricaUltima = useCallback((): void => {
    const oggi = oggiIso()
    void window.api.sedute
      .list(paziente.id)
      // le sedute programmate per i giorni a venire non sono "l'ultima": si
      // riparte da quella davvero svolta
      .then((righe) => {
        setSedutePaziente(righe)
        ricordaScheda(paziente.id, { sedute: righe })
        setUltimaSeduta(righe.find((s) => s.data <= oggi)?.id ?? null)
      })
  }, [paziente])

  useEffect(ricaricaUltima, [ricaricaUltima])

  useEffect(() => {
    if (paziente.patologia_id == null) {
      setFasi([])
      ricordaScheda(paziente.id, { fasi: [] })
      return
    }
    void window.api.fasi.list(paziente.patologia_id).then((f) => {
      setFasi(f)
      ricordaScheda(paziente.id, { fasi: f })
    })
  }, [paziente.id, paziente.patologia_id])

  const setPatologia = async (patologiaId: number | null): Promise<void> => {
    if (
      paziente.patologia_id != null &&
      patologiaId !== paziente.patologia_id &&
      !(await chiedi('Cambiare patologia? La fase corrente verrà azzerata.'))
    ) {
      return
    }
    try {
      await window.api.pazienti.setPatologiaFase(paziente.id, patologiaId, null)
      await onChanged()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const setFase = async (faseId: number | null): Promise<void> => {
    try {
      await window.api.pazienti.setPatologiaFase(paziente.id, paziente.patologia_id, faseId)
      await onChanged()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const [seduteSettimana, setSeduteSettimana] = useState(paziente.sedute_settimana?.toString() ?? '')
  useEffect(() => setSeduteSettimana(paziente.sedute_settimana?.toString() ?? ''), [paziente.sedute_settimana])
  const salvaSeduteSettimana = async (): Promise<void> => {
    const testo = seduteSettimana.trim()
    const quante = testo === '' ? null : Number(testo)
    if (quante === paziente.sedute_settimana) return
    try {
      await window.api.pazienti.setSeduteSettimana(paziente.id, quante)
      await onChanged()
    } catch (e) {
      toastErrore(errMsg(e))
      setSeduteSettimana(paziente.sedute_settimana?.toString() ?? '')
    }
  }

  // L'avanzamento cammina solo sulle fasi di palestra: da Intermedia si passa
  // ad Avanzata, mai a una fase del campo, che e' un percorso parallelo.
  const fasiPalestra = fasi.filter((f) => f.campo !== 1)
  const idxFase = fasiPalestra.findIndex((f) => f.id === paziente.fase_corrente_id)
  // Se la fase corrente non e' nell'elenco (una fase del campo rimasta da prima)
  // non si sa da dove ripartire: niente "Avanza", si sceglie dall'elenco.
  const faseFuoriElenco = paziente.fase_corrente_id != null && idxFase < 0
  const prossima = faseFuoriElenco
    ? undefined
    : idxFase >= 0
      ? fasiPalestra[idxFase + 1]
      : fasiPalestra[0]

  const avanza = async (): Promise<void> => {
    if (!prossima) return
    const domanda =
      paziente.fase_corrente_id == null
        ? `Impostare "${prossima.nome}" come fase corrente di ${paziente.nome} ${paziente.cognome}?`
        : `Avanzare ${paziente.nome} ${paziente.cognome} a "${prossima.nome}"?\nLe nuove sedute useranno la struttura della nuova fase.`
    if (!(await chiedi(domanda))) return
    await setFase(prossima.id)
  }

  // "16 nov": le date nelle note degli elenchi, corte
  const dataBreve = (iso: string): string => {
    const [a, m, g] = iso.split('-').map(Number)
    return new Date(a, m - 1, g).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')
  }

  const vociClinica: VoceIndice[] = [
    {
      chiave: 'anamnesi',
      titolo: 'Anamnesi',
      icona: ClipboardList,
      nota: 'prossima, remota, obiettivi'
    },
    {
      chiave: 'bodychart',
      titolo: 'Body chart',
      icona: PersonStanding,
      nota:
        dati.bodyChart.quante > 0
          ? `${dati.bodyChart.quante}${dati.bodyChart.ultima ? ` · ultima ${dataBreve(dati.bodyChart.ultima)}` : ''}`
          : 'nessuna',
      vuota: dati.pronto && dati.bodyChart.quante === 0
    },
    {
      chiave: 'questionari',
      titolo: 'Questionari',
      icona: ListChecks,
      nota:
        dati.compilazioni > 0
          ? `${dati.compilazioni}${dati.questionario ? ` · ${dati.questionario.nome} ${dataBreve(dati.questionario.data)}` : ''}`
          : 'nessuno',
      vuota: dati.pronto && dati.compilazioni === 0
    },
    {
      chiave: 'valutazione',
      titolo: 'Valutazione obiettiva',
      icona: Stethoscope,
      nota:
        dati.valutazioni.quante > 0
          ? `${dati.valutazioni.quante}${dati.valutazioni.ultima ? ` · ultima ${dataBreve(dati.valutazioni.ultima)}` : ''}`
          : 'nessuna',
      vuota: dati.pronto && dati.valutazioni.quante === 0
    },
    {
      chiave: 'promemoria',
      titolo: 'Promemoria',
      icona: Bell,
      nota:
        dati.promemoria.scaduti > 0
          ? `${dati.promemoria.scaduti} ${dati.promemoria.scaduti === 1 ? 'scaduto' : 'scaduti'}`
          : dati.promemoria.aperti > 0
            ? `${dati.promemoria.aperti} da fare`
            : 'nessuno',
      avviso: dati.promemoria.scaduti > 0,
      vuota: dati.pronto && dati.promemoria.aperti === 0
    },
    {
      chiave: 'segni',
      titolo: 'Segni di riferimento',
      icona: Activity,
      nota: dati.segni > 0 ? String(dati.segni) : 'nessuno',
      vuota: dati.pronto && dati.segni === 0
    }
  ]

  const raggiuntiOb = dati.obiettivi.filter((o) => o.raggiunto).length
  const vociPercorso: VoceIndice[] = [
    {
      chiave: 'fase',
      titolo: 'Patologia e fase',
      icona: Route,
      nota: paziente.fase_nome
        ? `${paziente.fase_nome}${idxFase >= 0 ? ` · ${idxFase + 1} di ${fasiPalestra.length}` : ''}`
        : paziente.patologia_nome
          ? 'fase non impostata'
          : 'nessun percorso'
    },
    {
      chiave: 'obiettivi',
      titolo: 'Obiettivi della fase',
      icona: Target,
      nota: dati.obiettivi.length > 0 ? `${raggiuntiOb} di ${dati.obiettivi.length} raggiunti` : 'nessuno',
      vuota: dati.pronto && dati.obiettivi.length === 0
    },
    ...(dati.progressioni.length > 0
      ? [
          {
            chiave: 'progressioni',
            titolo: 'Progressioni',
            icona: TrendingUp,
            nota: `${dati.progressioni.length} ${dati.progressioni.length === 1 ? 'scala' : 'scale'}`
          }
        ]
      : []),
    ...(dati.carico
      ? [
          {
            chiave: 'carico',
            titolo: 'Carico settimanale',
            icona: Dumbbell,
            nota: dati.carico.avviso ? 'dolore in salita' : `${dati.carico.settimane} settimane`,
            avviso: dati.carico.avviso
          }
        ]
      : []),
    {
      chiave: 'casa',
      titolo: 'Indicazioni per casa',
      icona: House,
      nota: paziente.frequenza_casa || null
    },
    {
      chiave: 'massimali',
      titolo: 'Massimali',
      icona: Dumbbell,
      nota: dati.massimali > 0 ? String(dati.massimali) : 'nessuno',
      vuota: dati.pronto && dati.massimali === 0
    }
  ]
  // una parte che sparisce (le progressioni di una fase senza) non lascia il pannello vuoto
  const sezPercorsoAttiva = vociPercorso.some((v) => v.chiave === sezPercorso) ? sezPercorso : 'fase'

  return (
    <div className="scheda">
      <AnagraficaPaziente paziente={paziente} onChanged={onChanged} onDeleted={onDeleted} />

      {/* I limiti da non superare, subito sotto al nome e sopra a tutto il
          resto: si scrivono nei dati del paziente e si rileggono qui senza
          doverli cercare. */}
      {paziente.precauzioni && (
        <p className="fascia-precauzioni">
          <AlertTriangle size={16} />
          {paziente.precauzioni}
        </p>
      )}

      {/* I due gesti di tutti i giorni restano sempre a portata di clic, in
          qualunque linguetta ti trovi: creare la seduta di oggi, o ripartire da
          quella di ieri invece di rifarla da zero. */}
      <div className="barra-scheda">
        <div className="config-tabs">
          {SCHEDE_PAZIENTE.map((t) => (
            <button
              key={t.key}
              className={scheda === t.key ? 'active' : ''}
              onClick={() => onSchedaChange(t.key)}
            >
              {t.label}
              {t.key === 'diario' && daFare > 0 && <span className="pallino-conta">{daFare}</span>}
            </button>
          ))}
        </div>
        <span className="row-actions">
          <button
            disabled={ultimaSeduta == null}
            title="Riprendi l'ultima: nuova seduta copiando l'ultima"
            aria-label="Riprendi l'ultima seduta"
            onClick={() => ultimaSeduta != null && onDuplicaSeduta(ultimaSeduta)}
          >
            <Copy size={17} />
          </button>
          <button
            disabled={sedutePaziente.length === 0}
            title="Programma: copia un programma su piu' giorni"
            aria-label="Programma su più giorni"
            onClick={() => setProgramma(true)}
          >
            <CalendarPlus size={17} />
          </button>
          <button className="primary" onClick={onNuovaSeduta}>
            <Plus size={17} /> Nuova seduta
          </button>
        </span>
      </div>

      {programma && (
        <ProgrammaSettimana
          sedute={sedutePaziente}
          onChiudi={(create) => {
            setProgramma(false)
            if (create > 0) {
              ricaricaUltima()
              // Il Diario carica le sedute solo quando cambia il paziente, e la
              // sezione che si sta guardando non si rimonta da sola: lo si
              // rimonta qui, cosi' le sedute programmate si vedono subito.
              setVersioni((v) => ({ ...v, diario: v.diario + 1 }))
              void onChanged()
            }
          }}
        />
      )}

      {/* Le cinque sezioni restano tutte montate e si nasconde quella che non
          serve: cosi' si caricano subito, appena si apre il paziente, e
          cambiando linguetta non si vedono righe che arrivano una a una. */}
      <div className="sezione-scheda" hidden={scheda !== 'quadro'}>
        <QuadroPaziente
          paziente={paziente}
          fasi={fasi}
          dati={dati}
          onVai={vai}
          onApriSeduta={onApriSeduta}
        />
      </div>

      <div className="sezione-scheda" hidden={scheda !== 'diario'}>
        <DiarioCard
          key={`d${versioni.diario}`}
          paziente={paziente}
          onNuova={onNuovaSeduta}
          onApri={onApriSeduta}
          onDuplica={onDuplicaSeduta}
        />
      </div>

      <div className="sezione-scheda" hidden={scheda !== 'clinica'} key={`c${versioni.clinica}`}>
        <IndiceSezioni
          etichetta="Parti della clinica"
          voci={vociClinica}
          attiva={sezClinica}
          onScegli={(k) => setSezClinica(k as SezioneClinica)}
        >
          <div hidden={sezClinica !== 'anamnesi'}>
            <AnamnesiPaziente paziente={paziente} />
          </div>
          <div hidden={sezClinica !== 'bodychart'}>
            <BodyChartPaziente paziente={paziente} onCambiato={() => setRilettura((n) => n + 1)} />
          </div>
          <div hidden={sezClinica !== 'questionari'}>
            <QuestionariPaziente paziente={paziente} />
          </div>
          <div hidden={sezClinica !== 'valutazione'}>
            <ValutazionePaziente paziente={paziente} />
          </div>
          <div hidden={sezClinica !== 'promemoria'}>
            <PromemoriaPaziente paziente={paziente} />
          </div>
          <div hidden={sezClinica !== 'segni'}>
            <SegniPaziente paziente={paziente} aperto onCambiato={() => setRilettura((n) => n + 1)} />
          </div>
        </IndiceSezioni>
      </div>

      <div className="sezione-scheda" hidden={scheda !== 'pedana'}>
        <PedanaPaziente key={`p${versioni.pedana}`} paziente={paziente} />
      </div>

      <div className="sezione-scheda" hidden={scheda !== 'percorso'} key={`r${versioni.percorso}`}>
        <IndiceSezioni
          etichetta="Parti del percorso"
          voci={vociPercorso}
          attiva={sezPercorsoAttiva}
          onScegli={(k) => setSezPercorso(k as SezionePercorso)}
        >
          <div hidden={sezPercorsoAttiva !== 'fase'}>
          <section className="card">
            <h3>Percorso riabilitativo</h3>
            {/* Patologia, fase e il pulsante che fa avanzare stanno su una riga
                sola: sono la stessa decisione, presa in tre passi. */}
            <div className="riga-percorso">
              <label className="field">
                Patologia
                <SceltaConRicerca
                  voci={patologie}
                  valore={paziente.patologia_id ?? ''}
                  segnaposto="— nessuna —"
                  vuoto="— nessuna —"
                  onCambia={(id) => void setPatologia(id === '' ? null : id)}
                />
              </label>
              <label className="field campo-fase">
                Fase corrente
                <SceltaConRicerca
                  voci={fasi
                    .filter((f) => f.campo !== 1 || f.id === paziente.fase_corrente_id)
                    .map((f) => ({ id: f.id, nome: f.nome }))}
                  valore={paziente.fase_corrente_id ?? ''}
                  disabled={paziente.patologia_id == null}
                  segnaposto="— non impostata —"
                  vuoto="— non impostata —"
                  onCambia={(id) => void setFase(id === '' ? null : id)}
                />
              </label>
              {paziente.patologia_id != null && fasiPalestra.length > 0 && (
                <label className="field campo-avanza">
                  {idxFase >= 0
                    ? `Fase ${idxFase + 1} di ${fasiPalestra.length}`
                    : faseFuoriElenco
                      ? 'Fase fuori dal percorso'
                      : 'Nessuna fase impostata'}
                  <button disabled={!prossima} onClick={() => void avanza()}>
                    {paziente.fase_corrente_id == null
                      ? 'Imposta prima fase'
                      : faseFuoriElenco
                        ? 'Scegli una fase di palestra'
                        : prossima
                          ? `Avanza a "${prossima.nome}" →`
                          : 'Ultima fase raggiunta'}
                  </button>
                </label>
              )}
              {/* Un numero solo, che si cambia al volo: dipende dalla fase ma anche
                  da quanto puo' spendere. Divide la dose di forza sulla settimana. */}
              <label className="field campo-sedute-settimana">
                Sedute a settimana
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={seduteSettimana}
                  onChange={(e) => setSeduteSettimana(e.target.value)}
                  onBlur={() => void salvaSeduteSettimana()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
              </label>
            </div>
            {paziente.patologia_id == null ? (
              <p className="hint">Assegna una patologia per impostare le fasi.</p>
            ) : fasi.length === 0 ? (
              <p className="hint">
                Questa patologia non ha fasi: definiscile in &ldquo;Patologie e fasi&rdquo;.
              </p>
            ) : null}
          </section>
          </div>
          <div hidden={sezPercorsoAttiva !== 'obiettivi'}>
            <ObiettiviCard paziente={paziente} />
          </div>
          <div hidden={sezPercorsoAttiva !== 'progressioni'}>
            <ProgressioniPaziente paziente={paziente} />
          </div>
          {/* Quanto ha fatto ogni settimana rispetto alla dose della fase: solo a video. */}
          <div hidden={sezPercorsoAttiva !== 'carico'}>
            <CaricoSettimane paziente={paziente} />
          </div>
          {/* Cosa deve fare a casa, ogni quanto, e come regolarsi. Finisce sul
              foglio che si porta via. */}
          <div hidden={sezPercorsoAttiva !== 'casa'}>
            <IndicazioniCasa paziente={paziente} onChanged={onChanged} aperto />
          </div>
          {/* I massimali con cui si prescrive il carico della fase di forza. */}
          <div hidden={sezPercorsoAttiva !== 'massimali'}>
            <MassimaliPaziente paziente={paziente} />
          </div>
        </IndiceSezioni>
      </div>
    </div>
  )
}
