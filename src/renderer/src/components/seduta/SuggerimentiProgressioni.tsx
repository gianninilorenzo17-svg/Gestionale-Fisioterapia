import { Lock, Plus } from 'lucide-react'
import type { EsercizioConCategoria } from '../../../../shared/types'
import { doseTesto } from '../../../../shared/dosaggio'
import { nomeStep } from '../../../../shared/varianti'
import type { DoseStep, GruppoSuggerito } from './modello'

interface Props {
  gruppi: GruppoSuggerito[]
  libreria: EsercizioConCategoria[]
  // gli esercizi gia' messi in questa seduta, in qualunque sezione
  inSeduta: Set<number>
  onAggiungi: (e: EsercizioConCategoria, dose: DoseStep) => void
  onSpecchietto: () => void
  // sblocca lo step successivo di una progressione (il paziente ci e' arrivato)
  onSblocca: (progressioneId: number, nome: string) => void
}

// In cima alla ricerca di "+ Esercizio": una pastiglia per progressione, con lo
// step a cui e' il paziente, da aggiungere con un clic. Le pastiglie vanno a
// capo da sole, quindi anche con tante scale (l'affondo orizzontale e quello
// verticale) il riquadro resta di una o due righe.
//
// Sulla pastiglia: il nome dello step e, in piccolo, la progressione e a che
// step siamo ("Affondo orizzontale · 2/5"). Lo step successivo non si legge: sta
// nel tooltip del lucchettino accanto, che lo sblocca (il paziente ci e'
// arrivato) e dice cosa serve per arrivarci. La scala intera si vede in "Vedi
// dove siamo". Dove lo step ha una sua dose (il ritorno alla corsa) la dose e'
// nel tooltip e, aggiungendo, e' quella a finire nella riga.
//
// Il calcolo di cosa mostrare sta in modello.ts (suggerimentiProgressioni).
export default function SuggerimentiProgressioni({
  gruppi,
  libreria,
  inSeduta,
  onAggiungi,
  onSpecchietto,
  onSblocca
}: Props): React.JSX.Element | null {
  if (gruppi.length === 0) return null

  return (
    <div className="suggeriti-prog">
      <div className="suggeriti-testata">
        Progressioni
        <button onClick={onSpecchietto}>Vedi dove siamo</button>
      </div>
      <div className="suggeriti-pastiglie">
        {gruppi.map(({ progressione: p, base, righe }) => {
          const primo = righe[0]
          // se lo step attuale non c'e' (la ricerca lo esclude) resta quello dopo,
          // ancora da sbloccare
          const bloccato = primo.indice !== 0
          const succ = bloccato ? primo : righe.find((r) => r.indice === 1)
          const s = primo.step
          const e = libreria.find((x) => x.id === s.esercizio_id)
          const giaQui = inSeduta.has(s.esercizio_id)
          const nome = nomeStep(s.esercizio_nome, s.variante, s.monopodalico)
          const dose = doseTesto(s)
          const titolo = [
            e ? `Aggiungi ${nome}` : 'Esercizio archiviato: non si può aggiungere',
            dose,
            bloccato && s.requisito ? `Requisito: ${s.requisito}` : '',
            giaQui ? 'già in seduta' : ''
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <span key={p.id} className={bloccato ? 'pastiglia-prog successivo' : 'pastiglia-prog'}>
              <button className="pastiglia-aggiungi" title={titolo} disabled={!e || giaQui} onClick={() => e && onAggiungi(e, s)}>
                <Plus size={14} />
                <span className="pp-testo">
                  <span className="pp-nome">{nome}</span>
                  <span className="pp-sub">
                    {p.nome} · {base + primo.indice + 1}/{p.step.length}
                  </span>
                </span>
              </button>
              {succ && (
                <button
                  className="pastiglia-sblocca"
                  title={
                    bloccato
                      ? `Il paziente è arrivato a «${nome}»? Sbloccalo${s.requisito ? ` (serve: ${s.requisito})` : ''}`
                      : `Il paziente è arrivato a «${nomeStep(succ.step.esercizio_nome, succ.step.variante, succ.step.monopodalico)}»? Sbloccalo${succ.step.requisito ? ` (serve: ${succ.step.requisito})` : ''}`
                  }
                  onClick={() =>
                    onSblocca(p.id, nomeStep(succ.step.esercizio_nome, succ.step.variante, succ.step.monopodalico))
                  }
                >
                  <Lock size={12} />
                </button>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
