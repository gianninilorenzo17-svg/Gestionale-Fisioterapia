// Le pillole e i menu della dose, uguali dappertutto (libreria, fasi, seduta):
// il colore dice la voce, e si definisce in stili/16-dose.css (.voce-…).
import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  infoVoce,
  OBIETTIVI,
  TIPI_ESERCIZIO,
  type ObiettivoSezione,
  type TipoEsercizio,
  type Voce
} from '../../../../shared/dose'

// La classe del colore di una voce, di un obiettivo o di un tipo di esercizio.
export function coloreDose(x: Voce | ObiettivoSezione | TipoEsercizio | 'senza' | null | undefined): string {
  if (x == null || x === 'senza' || x === 'non_conta' || x === 'rinforzo') return 'voce-nessuna'
  return `voce-${x === 'pliometria' ? 'plio_int' : x}`
}

export const nomeObiettivo = (o: ObiettivoSezione | null): string =>
  OBIETTIVI.find((x) => x.obiettivo === o)?.nome ?? 'Senza obiettivo'

export function PillVoce({ voce }: { voce: Voce }): React.JSX.Element {
  return <span className={`pill-dose ${coloreDose(voce)}`}>{infoVoce(voce).nome}</span>
}

export function PillObiettivo({ obiettivo }: { obiettivo: ObiettivoSezione | null }): React.JSX.Element {
  return <span className={`pill-dose ${coloreDose(obiettivo)}`}>{nomeObiettivo(obiettivo)}</span>
}

export function PillTipo({ tipo }: { tipo: TipoEsercizio | null }): React.JSX.Element {
  if (tipo == null) return <span className="pill-dose da-sistemare">Da sistemare</span>
  // il rinforzo non ha un colore suo: dove va lo dice la sezione
  const classe = tipo === 'rinforzo' ? 'voce-forza' : coloreDose(tipo)
  return <span className={`pill-dose ${classe}`}>{TIPI_ESERCIZIO.find((t) => t.tipo === tipo)!.nome}</span>
}

export interface VoceMenuDose {
  valore: string
  etichetta: string
  // una riga che separa quelle sopra da questa
  separa?: boolean
}

// Un menu piccolo che si apre da un pulsante qualsiasi.
export function MenuDose({
  voci,
  valore,
  onScegli,
  titolo,
  className,
  children
}: {
  voci: VoceMenuDose[]
  valore: string
  onScegli: (valore: string) => void
  titolo: string
  className: string
  children: React.ReactNode
}): React.JSX.Element {
  const [aperto, setAperto] = useState(false)
  return (
    <span className="menu-wrapper menu-dose-wrapper" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={className}
        title={titolo}
        aria-label={titolo}
        aria-expanded={aperto}
        onClick={() => setAperto(!aperto)}
      >
        {children}
      </button>
      {aperto && (
        <>
          <div className="menu-chiudi" onClick={() => setAperto(false)} />
          <div className="menu-tendina menu-dose">
            {voci.map((v) => (
              <button
                type="button"
                key={v.valore}
                className={v.separa ? 'separa' : undefined}
                aria-pressed={v.valore === valore}
                onClick={() => {
                  setAperto(false)
                  onScegli(v.valore)
                }}
              >
                <span>{v.etichetta}</span>
                {v.valore === valore && <Check size={16} />}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  )
}

// Il menu dell'obiettivo di una sezione, come pillola da premere.
export function MenuObiettivo({
  obiettivo,
  onScegli,
  titolo
}: {
  obiettivo: ObiettivoSezione | null
  onScegli: (o: ObiettivoSezione | null) => void
  titolo: string
}): React.JSX.Element {
  return (
    <MenuDose
      titolo={titolo}
      className={`pill-dose pill-menu ${coloreDose(obiettivo)}`}
      valore={obiettivo ?? ''}
      voci={[
        ...OBIETTIVI.map((o) => ({ valore: o.obiettivo, etichetta: o.nome })),
        { valore: '', etichetta: 'Senza obiettivo', separa: true }
      ]}
      onScegli={(v) => onScegli(v === '' ? null : (v as ObiettivoSezione))}
    >
      {obiettivo == null ? 'Scegli obiettivo' : nomeObiettivo(obiettivo)} <ChevronDown size={14} />
    </MenuDose>
  )
}
