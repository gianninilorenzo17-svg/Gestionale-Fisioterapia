import { useState } from 'react'
import type { Categoria } from '../../../shared/types'

// Le categorie che una sezione propone: sopra quelle spuntate, nell'ordine in
// cui sono state scelte, sotto le altre con la ricerca. La usano le sezioni
// della libreria e quelle solo di una fase.
export default function SceltaCategorie({
  categorie,
  scelte,
  onCambia
}: {
  categorie: Categoria[]
  scelte: number[]
  onCambia: (ids: number[]) => void
}): React.JSX.Element {
  const [ricerca, setRicerca] = useState('')

  // Un distretto si scrive con la sua categoria davanti: "Quadricipite" da solo
  // non dice di che lavoro si tratta.
  const nomeCategoria = (cid: number): string => {
    const c = categorie.find((x) => x.id === cid)
    if (!c) return '?'
    const padre = c.padre_id == null ? null : categorie.find((x) => x.id === c.padre_id)
    return padre ? `${padre.nome} › ${c.nome}` : c.nome
  }

  // In elenco i distretti vengono subito dopo la loro categoria.
  const inOrdine = (elenco: Categoria[]): Categoria[] =>
    elenco
      .filter((c) => c.padre_id == null)
      .flatMap((c) => [c, ...elenco.filter((f) => f.padre_id === c.id)])
      .concat(
        // quelli il cui padre non e' nell'elenco (perche' filtrato dalla
        // ricerca) restano comunque visibili
        elenco.filter((c) => c.padre_id != null && !elenco.some((x) => x.id === c.padre_id))
      )

  if (categorie.length === 0) {
    return <p className="hint">Nessuna categoria disponibile: creale in &ldquo;Libreria esercizi&rdquo;.</p>
  }

  const altre = categorie.filter((c) => !scelte.includes(c.id))
  const q = ricerca.trim().toLowerCase()
  const daAggiungere = inOrdine(q === '' ? altre : altre.filter((c) => c.nome.toLowerCase().includes(q)))

  return (
    <>
      <ul className="checkbox-list">
        {scelte.map((cid) => (
          <li key={cid}>
            <label>
              <input type="checkbox" checked onChange={() => onCambia(scelte.filter((x) => x !== cid))} />
              {nomeCategoria(cid)}
            </label>
          </li>
        ))}
        {scelte.length === 0 && <li className="empty">Nessuna categoria associata: spunta qui sotto.</li>}
      </ul>
      {altre.length > 0 && (
        <>
          <div className="sotto-titolo">Altre categorie</div>
          {/* Con trenta categorie scorrerle tutte per trovarne una e' piu'
              lento che scriverne tre lettere. */}
          <input
            type="search"
            className="cerca-categoria"
            placeholder="Cerca categoria…"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
          <ul className="checkbox-list elenco-categorie-scorre">
            {daAggiungere.map((c) => (
              <li key={c.id}>
                <label>
                  <input type="checkbox" checked={false} onChange={() => onCambia([...scelte, c.id])} />
                  {c.nome}
                </label>
              </li>
            ))}
            {daAggiungere.length === 0 && <li className="empty">Nessuna categoria con questo nome.</li>}
          </ul>
        </>
      )}
    </>
  )
}
