import { useState } from 'react'
import type { Categoria } from '../../../../shared/types'
import { infoVoce, quoteLavoro, serieDellaRiga, voceRiga, type RigaConto, type Voce } from '../../../../shared/dose'
import { coloreDose } from '../dose/comune'

// Lo specchietto «Lavoro di oggi»: com'e' divisa la seduta, pesata sulle serie.
// Passando su una parte (o sul suo nome) si vede quanto va a ogni muscolo. Come
// tutta la dose serve solo a programmare.

const C = 2 * Math.PI * 15.9155

export default function CiambellaDose({
  righe,
  categorie
}: {
  righe: RigaConto[]
  categorie: Categoria[]
}): React.JSX.Element {
  const [sopra, setSopra] = useState<Voce | null>(null)
  const quote = quoteLavoro(righe)

  const muscoli = (voce: Voce): { id: number | null; nome: string; percento: number }[] => {
    const serie = new Map<number | null, number>()
    for (const r of righe) {
      if (voceRiga(r) !== voce) continue
      serie.set(r.categoria_id, (serie.get(r.categoria_id) ?? 0) + serieDellaRiga(r))
    }
    const totale = [...serie.values()].reduce((t, n) => t + n, 0) || 1
    return [...serie]
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => ({
        id,
        nome: categorie.find((c) => c.id === id)?.nome ?? 'altro',
        percento: Math.round((n / totale) * 100)
      }))
  }

  const su = (voce: Voce): { onMouseEnter: () => void; onMouseLeave: () => void } => ({
    onMouseEnter: () => setSopra(voce),
    onMouseLeave: () => setSopra(null)
  })

  let cumulato = 0
  return (
    <section className="card striscia-card ciambella-dose">
      <div className="striscia-titolo">
        <span>Lavoro di oggi</span>
      </div>
      {quote.length === 0 ? (
        <p className="hint">Ancora niente da contare.</p>
      ) : (
        <div className="ciambella-dose-corpo">
          <svg viewBox="0 0 42 42" aria-hidden="true">
            {quote.map((q) => {
              const parte = (q.percento / 100) * C
              const arco = Math.max(parte - (quote.length > 1 ? 0.8 : 0), 0.1)
              const inizio = cumulato
              cumulato += parte
              return (
                <circle
                  key={q.voce}
                  className={coloreDose(q.voce)}
                  data-voce={q.voce}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  strokeWidth={sopra === q.voce ? 8 : 6.5}
                  strokeDasharray={`${arco} ${C - arco}`}
                  strokeDashoffset={-inizio}
                  transform="rotate(-90 21 21)"
                  {...su(q.voce)}
                />
              )
            })}
          </svg>
          <ul>
            {quote.map((q) => (
              <li key={q.voce} {...su(q.voce)}>
                <i className={coloreDose(q.voce)} aria-hidden="true" />
                {q.nome} <b>{q.percento}%</b>
              </li>
            ))}
          </ul>
          {sopra && quote.some((q) => q.voce === sopra) && (
            <div className="ciambella-dose-bolla" role="tooltip">
              <strong>{infoVoce(sopra).nome}</strong>
              {muscoli(sopra).map((m) => (
                <span key={m.id ?? 'altro'}>
                  <span>{m.nome}</span>
                  <span>{m.percento}%</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
