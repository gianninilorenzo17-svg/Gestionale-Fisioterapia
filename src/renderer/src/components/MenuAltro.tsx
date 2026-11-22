import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MoreHorizontal } from 'lucide-react'

// Il menu «⋯» in fondo a una riga: le cose che si fanno di rado, fuori dalla
// vista. Quello che si fa di continuo sta in un pulsante a parte.
export interface VoceMenuAltro {
  etichetta: string
  icona?: LucideIcon
  onClick: () => void
  pericolo?: boolean
  title?: string
}

export default function MenuAltro({
  voci,
  titolo = 'Altre azioni'
}: {
  voci: VoceMenuAltro[]
  titolo?: string
}): React.JSX.Element {
  const [aperto, setAperto] = useState(false)
  return (
    // il clic qui non deve arrivare alla riga, che aprirebbe il dettaglio
    <span className="menu-wrapper" onClick={(e) => e.stopPropagation()}>
      <button
        className="btn-icona menu-altro-bottone"
        title={titolo}
        aria-label={titolo}
        onClick={() => setAperto(!aperto)}
      >
        <MoreHorizontal size={18} />
      </button>
      {aperto && (
        <>
          <div className="menu-chiudi" onClick={() => setAperto(false)} />
          <div className="menu-tendina">
            {voci.map((v) => (
              <button
                key={v.etichetta}
                className={v.pericolo ? 'danger' : undefined}
                title={v.title}
                onClick={() => {
                  setAperto(false)
                  v.onClick()
                }}
              >
                {v.icona && <v.icona size={18} />} {v.etichetta}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  )
}
