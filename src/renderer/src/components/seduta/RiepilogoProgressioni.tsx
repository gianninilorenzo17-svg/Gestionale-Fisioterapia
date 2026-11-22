import type { StatoProgressione } from '../../../../shared/types'

// Uno specchietto per la striscia sopra agli esercizi: ogni progressione della
// fase con a che step siamo e una barretta. Un clic apre la scala intera.
// Serve solo a programmare: non va mai in cartella o nei referti.
export default function RiepilogoProgressioni({
  stati,
  onApri
}: {
  stati: StatoProgressione[]
  onApri: () => void
}): React.JSX.Element | null {
  if (stati.length === 0) return null
  return (
    <section className="card striscia-card riepilogo-prog">
      <div className="striscia-titolo">
        <span>Progressioni</span>
        <button className="btn-piccolo" title="Tutti gli step di ogni progressione" onClick={onApri}>
          Dettaglio
        </button>
      </div>
      {stati.map((p) => {
        const n = p.step.length
        const fatti = p.completata ? n : Math.min(p.posizione + 1, n)
        return (
          <div className="voce-striscia" key={p.id}>
            <div className="voce-striscia-riga">
              <span>{p.nome}</span>
              <span className="hint">{p.completata ? 'completata' : `${fatti}/${n}`}</span>
            </div>
            <div className="barra-striscia">
              <i style={{ width: `${n === 0 ? 0 : Math.round((fatti / n) * 100)}%` }} />
            </div>
          </div>
        )
      })}
    </section>
  )
}
