import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Categoria } from '../../../../shared/types'
import {
  controllaDose,
  intervalloTesto,
  TIPI_LAVORO,
  type ControlloDose,
  type DoseFase,
  type DoseSettimana
} from '../../../../shared/dose'

// Quanta dose c'e' nella seduta, confrontata con quella della fase: una riga
// sola sopra agli esercizi ("Pliometria est. 90 ✓ · Quadricipite 3 serie ✓").
// Un clic la apre e dice da dove vengono i numeri: per la forza, quante serie
// sono gia' nelle altre sedute della settimana e quante ne restano da fare.
// Serve solo a programmare: non finisce in nessun documento.

const nomeVoce = (chiave: string, categorie: Categoria[]): string =>
  chiave.startsWith('forza:')
    ? (categorie.find((c) => c.id === Number(chiave.slice(6)))?.nome ?? 'Forza')
    : (TIPI_LAVORO.find((t) => t.tipo === chiave)?.breve ?? chiave)

const unita = (chiave: string): string => (chiave.startsWith('plio') ? 'contatti' : 'serie')

const ESITO: Record<ControlloDose['esito'], string> = {
  ok: 'va bene',
  poco: 'poco',
  troppo: 'troppo'
}

export default function RigaDose({
  dosi,
  conto,
  settimana,
  categorie,
}: {
  dosi: DoseFase[]
  conto: Record<string, number>
  settimana: DoseSettimana
  categorie: Categoria[]
}): React.JSX.Element | null {
  const [aperta, setAperta] = useState(false)
  // nell'ordine della seduta: prima la pliometria, poi potenza e forza
  const ordine = (k: string): number => TIPI_LAVORO.findIndex((t) => k.startsWith(t.tipo))
  const controlliTutti = controllaDose(dosi, conto, settimana).sort(
    (a, b) => ordine(a.chiave) - ordine(b.chiave) || nomeVoce(a.chiave, categorie).localeCompare(nomeVoce(b.chiave, categorie), 'it')
  )

  const controlli = controlliTutti
  // Quello che c'e' nella seduta ma la fase non misura (nessun minimo/massimo, o
  // nessuna dose): si mostra comunque il conto, senza barra.
  const senzaObiettivo = Object.entries(conto)
    .filter(([k, v]) => v > 0 && !controlli.some((c) => c.chiave === k))
    .sort(([a], [b]) => ordine(a) - ordine(b) || nomeVoce(a, categorie).localeCompare(nomeVoce(b, categorie), 'it'))

  return (
    <section className="card striscia-card riga-dose">
      <button className="striscia-titolo riga-dose-sintesi" aria-expanded={aperta} onClick={() => setAperta(!aperta)}>
        <span>Dose seduta</span>
        {aperta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {controlli.map((c) => {
        const meta = c.a ?? c.da
        const perc = meta ? Math.min(100, Math.round((c.questa / meta) * 100)) : 100
        return (
          <div className="voce-striscia" key={c.chiave}>
            <div className="voce-striscia-riga">
              <span>{nomeVoce(c.chiave, categorie)}</span>
              <b title={ESITO[c.esito]}>{meta != null ? `${c.questa}/${meta}` : c.questa}</b>
            </div>
            <div className="barra-striscia">
              <i className={c.esito === 'troppo' ? 'oltre' : ''} style={{ width: `${perc}%` }} />
            </div>
          </div>
        )
      })}
      {senzaObiettivo.map(([k, v]) => (
        <div className="voce-striscia" key={k}>
          <div className="voce-striscia-riga">
            <span>{nomeVoce(k, categorie)}</span>
            <b title="Nessuna dose impostata per la fase">{v}</b>
          </div>
        </div>
      ))}
      {controlli.length === 0 && senzaObiettivo.length === 0 && (
        <p className="hint">Nessun esercizio da contare per ora</p>
      )}

      {aperta && (
        <div className="riga-dose-dettaglio">
          <ul>
            {controlli.map((c) => (
              <li key={c.chiave} className={c.esito}>
                <b>{nomeVoce(c.chiave, categorie)}</b>: in questa seduta {c.questa} {unita(c.chiave)}
                {(c.da != null || c.a != null) && (
                  <>
                    {' '}
                    · {c.settimana ? 'da fare oggi' : 'per seduta'} {intervalloTesto(c.da, c.a)}
                  </>
                )}
                {c.settimana && (
                  <span className="hint">
                    {' '}
                    · in settimana {c.settimana.fatte} su {intervalloTesto(c.settimana.da, c.settimana.a)}, da
                    dividere su {c.settimana.restano === 1 ? 'questa seduta' : `${c.settimana.restano} sedute`}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="riga-dose-frequenza">
            Sedute a settimana: <b>{settimana.frequenza ?? '—'}</b>
          </p>
          {settimana.frequenza == null && (
            <p className="hint">Impostale nella scheda del paziente: servono a contare la forza.</p>
          )}
        </div>
      )}
    </section>
  )
}
