import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NOMI_LIVELLO, type FarmacoScheda, type RefFarmaco } from '../../../../shared/farmaci'
import type { DatiFarmaci } from '../../farmaci'

// La bolla che compare passando il cursore su un farmaco sottolineato (o su uno
// della lista del paziente): testi brevi, per consultare. Non dice cosa fare.
// Il clic apre la scheda completa.

export const ATTESA_BOLLA = 250
const ATTESA_CHIUSURA = 180
const LARGHEZZA = 340
const ALTEZZA_STIMATA = 280

export interface StatoBolla {
  refs: RefFarmaco[]
  // dove sta la parola, in coordinate della finestra
  rect: { left: number; top: number; bottom: number; right: number }
}

// Tiene aperta la bolla mentre il cursore e' sulla parola o sulla bolla stessa.
export function useBolla(): {
  bolla: StatoBolla | null
  mostra: (s: StatoBolla) => void
  nascondi: () => void
  sullaBolla: { onMouseEnter: () => void; onMouseLeave: () => void }
} {
  const [bolla, setBolla] = useState<StatoBolla | null>(null)
  const apertura = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chiusura = useRef<ReturnType<typeof setTimeout> | null>(null)

  const annulla = (): void => {
    if (apertura.current) clearTimeout(apertura.current)
    if (chiusura.current) clearTimeout(chiusura.current)
    apertura.current = chiusura.current = null
  }
  useEffect(() => annulla, [])

  const mostra = useCallback((s: StatoBolla): void => {
    if (chiusura.current) clearTimeout(chiusura.current)
    chiusura.current = null
    if (apertura.current) clearTimeout(apertura.current)
    apertura.current = setTimeout(() => setBolla(s), ATTESA_BOLLA)
  }, [])

  const nascondi = useCallback((): void => {
    if (apertura.current) clearTimeout(apertura.current)
    apertura.current = null
    if (chiusura.current) clearTimeout(chiusura.current)
    chiusura.current = setTimeout(() => setBolla(null), ATTESA_CHIUSURA)
  }, [])

  return {
    bolla,
    mostra,
    nascondi,
    sullaBolla: {
      onMouseEnter: () => {
        if (chiusura.current) clearTimeout(chiusura.current)
        chiusura.current = null
      },
      onMouseLeave: nascondi
    }
  }
}

export function PuntoLivello({ livello }: { livello: 0 | 1 | 2 }): React.JSX.Element {
  return <span className={`farmaco-livello livello-${livello}`} title={NOMI_LIVELLO[livello]} />
}

export function AvvisoBozza(): React.JSX.Element {
  return <span className="farmaco-bozza">Bozza da verificare</span>
}

function PezzoBolla({ r, dati }: { r: RefFarmaco; dati: DatiFarmaci }): React.JSX.Element {
  const scheda: FarmacoScheda | undefined = r.schedaId != null ? dati.schedaPerId.get(r.schedaId) : undefined
  if (!scheda) {
    return (
      <div className="bolla-farmaco-pezzo">
        <div className="bolla-farmaco-titolo">{r.principio}</div>
        <div className="bolla-farmaco-vuoto">Nessuna scheda per questo principio attivo.</div>
      </div>
    )
  }
  return (
    <div className="bolla-farmaco-pezzo">
      <div className="bolla-farmaco-titolo">
        <PuntoLivello livello={scheda.livello} />
        {scheda.principio_attivo}
        {scheda.classe && <span className="bolla-farmaco-classe">{scheda.classe}</span>}
      </div>
      {scheda.stato === 'bozza' && <AvvisoBozza />}
      {scheda.livello > 0 && (
        <div className={`bolla-farmaco-livello livello-${scheda.livello}`}>{NOMI_LIVELLO[scheda.livello]}</div>
      )}
      {scheda.usi && <p><b>A cosa serve:</b> {scheda.usi}</p>}
      {scheda.info_fisio && <p><b>Per la fisioterapia:</b> {scheda.info_fisio}</p>}
      {scheda.avvertenze && <p><b>Avvertenze:</b> {scheda.avvertenze}</p>}
    </div>
  )
}

export default function BollaFarmaco({
  stato,
  dati,
  gestori,
  onApri
}: {
  stato: StatoBolla
  dati: DatiFarmaci
  gestori: { onMouseEnter: () => void; onMouseLeave: () => void }
  onApri: () => void
}): React.JSX.Element {
  const rif = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: stato.rect.left })

  useLayoutEffect(() => {
    const alt = rif.current?.offsetHeight ?? ALTEZZA_STIMATA
    const sotto = window.innerHeight - stato.rect.bottom
    const left = Math.max(8, Math.min(stato.rect.left, window.innerWidth - LARGHEZZA - 8))
    if (sotto < alt + 12 && stato.rect.top > sotto) {
      setPos({ left, bottom: window.innerHeight - stato.rect.top + 6 })
    } else {
      setPos({ left, top: stato.rect.bottom + 6 })
    }
  }, [stato])

  return createPortal(
    <div
      ref={rif}
      className="bolla-farmaco"
      style={{ ...pos, width: LARGHEZZA }}
      role="tooltip"
      onClick={onApri}
      {...gestori}
    >
      {stato.refs.map((r, i) => (
        <PezzoBolla key={`${r.schedaId ?? r.principio}-${i}`} r={r} dati={dati} />
      ))}
      <div className="bolla-farmaco-piede">Clic per la scheda completa</div>
    </div>,
    document.body
  )
}
