import { useEffect, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { toastErrore } from '../../components/Toast'
import { errMsg } from '../../lib'
import { STILI_SCHEDA, type QualeScheda, type StileScheda } from '../../../../shared/stile-scheda'
import type { Tema } from '../../../../shared/temi'
import { TEMI } from '../../../../shared/temi'
import { CardImp, RigaImp } from './Riga'

export type ModoScuro = 'chiaro' | 'scuro' | 'orari'

// Come si scrive la dose nella scheda che si mostra al paziente: si sceglie
// guardando com'e', non leggendo due nomi. Due scelte indipendenti: la scheda
// senza immagini (finestra e PDF) e quella con le immagini.
function AnteprimaStile({ stile }: { stile: StileScheda }): React.JSX.Element {
  return (
    <span className="imp-stile-prev" aria-hidden="true">
      <span className="imp-stile-nome">Squat</span>
      {stile === 'bolle' ? (
        <span className="imp-stile-bolle">
          <span>3 serie da 8 rip.</span>
          <i>20 kg</i>
          <i className="sabbia">90″</i>
        </span>
      ) : (
        <span className="imp-stile-caselle">
          {[
            ['Serie', '3'],
            ['Rip.', '8'],
            ['Kg', '20'],
            ['Rec.', '90″']
          ].map(([e, v]) => (
            <span key={e}>
              <small>{e}</small>
              <b>{v}</b>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

function StileSchedaPaziente(): React.JSX.Element | null {
  const [stili, setStili] = useState<Record<QualeScheda, StileScheda> | null>(null)
  useEffect(() => {
    window.api.impostazioni
      .stiliScheda()
      .then(setStili)
      .catch((e) => toastErrore(errMsg(e)))
  }, [])
  if (!stili) return null
  const scegli = (quale: QualeScheda, stile: StileScheda): void => {
    const prima = stili
    setStili({ ...stili, [quale]: stile })
    window.api.impostazioni.setStileScheda(quale, stile).catch((e) => {
      setStili(prima)
      toastErrore(errMsg(e))
    })
  }
  const riga = (quale: QualeScheda, nome: string, descrizione: string): React.JSX.Element => (
    <RigaImp nome={nome} descrizione={descrizione} larga>
      <div className="imp-stili" role="radiogroup" aria-label={nome}>
        {STILI_SCHEDA.map((st) => (
          <button
            key={st.valore}
            type="button"
            role="radio"
            aria-checked={stili[quale] === st.valore}
            className={`imp-stile${stili[quale] === st.valore ? ' scelta-attiva' : ''}`}
            onClick={() => scegli(quale, st.valore)}
          >
            <b>{st.etichetta}</b>
            <AnteprimaStile stile={st.valore} />
          </button>
        ))}
      </div>
    </RigaImp>
  )
  return (
    <CardImp titolo="Scheda del paziente" nota="come si legge la dose, a schermo e nei PDF">
      {riga(
        'senza',
        'Senza immagini',
        'La finestra che mostri al paziente durante la seduta e il PDF senza immagini.'
      )}
      {riga('con', 'Con immagini', 'La scheda illustrata (foto e spiegazioni) e il suo PDF.')}
    </CardImp>
  )
}

export function SchedaAspetto({
  tema,
  onTema,
  scuro,
  modoScuro,
  orariScuro,
  onScuro,
  barraScura,
  onBarraScura,
  ingrandimento,
  onIngrandimento
}: {
  tema: Tema
  onTema: (t: Tema) => void
  scuro: boolean
  modoScuro: ModoScuro
  orariScuro: { dalle: string; alle: string }
  onScuro: (modo: ModoScuro, orari?: { dalle: string; alle: string }) => void
  barraScura: boolean
  onBarraScura: (valore: boolean) => void
  ingrandimento: number
  onIngrandimento: (valore: number) => void
}): React.JSX.Element {
  const colore = TEMI.find((t) => t.valore === tema)?.colore ?? '#55806a'
  const colonnaScura = barraScura || scuro
  return (
    <>
      <CardImp titolo="Colori e schermo">
        <RigaImp
          nome="Colore dell'app"
          descrizione="Cambia subito, e vale anche per i documenti che stampi: intestazioni delle sezioni e righe dei titoli nelle tabelle."
          larga
        >
          <div className="imp-colori">
            <span
              className={`imp-anteprima-app${scuro ? ' scuro' : ''}`}
              style={{ ['--prev' as string]: colore }}
              aria-hidden="true"
            >
              <span className={`lat${colonnaScura ? ' scura' : ''}`}>
                <i className="s" />
                <i />
                <i />
                <i />
              </span>
              <span className="cor">
                <i />
                <i />
                <i className="b" />
              </span>
            </span>
            <div className="scelta-tema">
              {TEMI.map((t) => (
                <button
                  key={t.valore}
                  className={tema === t.valore ? 'scelta-attiva' : ''}
                  onClick={() => onTema(t.valore)}
                >
                  <span className="pallino-tema" style={{ background: t.colore }} />
                  {t.etichetta}
                </button>
              ))}
            </div>
          </div>
        </RigaImp>

        <RigaImp
          nome="Modalità"
          descrizione="Scura: fondi scuri e scritte chiare. «A orari» la accende da sola all'ora che scegli. I documenti che stampi restano chiari."
          sotto={
            modoScuro === 'orari' ? (
              <div className="orari-scuro">
                <span>Scura dalle</span>
                <input
                  type="time"
                  value={orariScuro.dalle}
                  onChange={(e) =>
                    e.target.value && onScuro('orari', { ...orariScuro, dalle: e.target.value })
                  }
                />
                <span>alle</span>
                <input
                  type="time"
                  value={orariScuro.alle}
                  onChange={(e) =>
                    e.target.value && onScuro('orari', { ...orariScuro, alle: e.target.value })
                  }
                />
              </div>
            ) : undefined
          }
        >
          <span className="scelta-coppia segmentata">
            {(
              [
                ['chiaro', 'Chiara'],
                ['scuro', 'Scura'],
                ['orari', 'A orari']
              ] as const
            ).map(([modo, nome]) => (
              <button
                key={modo}
                type="button"
                className={modoScuro === modo ? 'scelta-attiva' : ''}
                onClick={() => onScuro(modo)}
              >
                {nome}
              </button>
            ))}
          </span>
        </RigaImp>

        {/* Prima la barra scura era una caratteristica del blu: adesso e' una
            scelta a se', valida con qualunque colore. Con la modalita' scura la
            colonna e' scura comunque: l'interruttore lo dice restando acceso. */}
        <RigaImp
          nome="Colonna laterale scura"
          descrizione="Il menu a sinistra scuro stacca di più dal contenuto. Con la modalità scura è sempre scuro."
        >
          <input
            type="checkbox"
            className="interruttore"
            aria-label="Colonna laterale scura"
            checked={colonnaScura}
            disabled={scuro}
            onChange={(e) => onBarraScura(e.target.checked)}
          />
        </RigaImp>

        {/* Il programma e' scritto in pixel fissi: si ingrandisce tutta la
            pagina, come fa il browser con Ctrl +, e cresce ogni cosa in
            proporzione. */}
        <RigaImp
          nome="Dimensione dei caratteri"
          descrizione="Ingrandisce tutto il programma, non solo le scritte: caselle, pulsanti e spazi crescono insieme."
        >
          <span className="regola-ingrandimento">
            <button
              title="Più piccolo"
              disabled={ingrandimento <= 0.8}
              onClick={() => onIngrandimento(Math.round((ingrandimento - 0.1) * 10) / 10)}
            >
              <Minus size={16} />
            </button>
            <span className="valore-ingrandimento">{Math.round(ingrandimento * 100)}%</span>
            <button
              title="Più grande"
              disabled={ingrandimento >= 1.6}
              onClick={() => onIngrandimento(Math.round((ingrandimento + 0.1) * 10) / 10)}
            >
              <Plus size={16} />
            </button>
            <button title="Torna alla misura normale" onClick={() => onIngrandimento(1)}>
              <RotateCcw size={15} />
            </button>
          </span>
        </RigaImp>
      </CardImp>

      <StileSchedaPaziente />
    </>
  )
}
