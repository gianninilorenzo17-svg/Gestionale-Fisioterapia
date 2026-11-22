import type { LucideIcon } from 'lucide-react'

// L'elenco a sinistra di una linguetta lunga (Clinica, Percorso): invece di
// cinque o sei riquadri uno sotto l'altro, una voce per parte con scritto sotto
// cosa c'e' dentro ("3 · KOOS 16 nov", "1 scaduto"). Un clic e a destra compare
// quella parte. Le voci vuote restano in fondo, in grigio, senza sparire: si
// puo' sempre aprirle per scrivere la prima cosa.
export interface VoceIndice {
  chiave: string
  titolo: string
  icona: LucideIcon
  // cosa c'e' dentro, in poche parole
  nota?: string | null
  // la nota e' un avvertimento (un promemoria scaduto): si legge in rosso
  avviso?: boolean
  // niente dentro: sta in fondo, in grigio
  vuota?: boolean
}

export default function IndiceSezioni({
  voci,
  attiva,
  onScegli,
  etichetta,
  children
}: {
  voci: VoceIndice[]
  attiva: string
  onScegli: (chiave: string) => void
  // il nome dell'elenco per chi usa il lettore di schermo
  etichetta: string
  children: React.ReactNode
}): React.JSX.Element {
  const piene = voci.filter((v) => !v.vuota)
  const vuote = voci.filter((v) => v.vuota)

  const voce = (v: VoceIndice): React.JSX.Element => {
    const Icona = v.icona
    return (
      <button
        key={v.chiave}
        type="button"
        className={`voce-indice${attiva === v.chiave ? ' attiva' : ''}${v.vuota ? ' vuota' : ''}`}
        aria-current={attiva === v.chiave ? 'true' : undefined}
        onClick={() => onScegli(v.chiave)}
      >
        <Icona size={17} aria-hidden="true" />
        <span className="voce-indice-titolo">{v.titolo}</span>
        {v.nota && <small className={v.avviso ? 'avviso' : undefined}>{v.nota}</small>}
      </button>
    )
  }

  return (
    <div className="con-indice">
      <nav className="indice-sezioni" aria-label={etichetta}>
        {piene.map(voce)}
        {vuote.length > 0 && piene.length > 0 && <div className="indice-separatore" />}
        {vuote.map(voce)}
      </nav>
      <div className="indice-contenuto">{children}</div>
    </div>
  )
}
