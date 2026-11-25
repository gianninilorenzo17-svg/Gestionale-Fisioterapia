import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import type { Categoria, SezioneConCategorie, SezioneLibreria } from '../../../shared/types'
import { useRiordinoSalvato } from '../riordino'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import Aiuto from './Aiuto'
import SceltaCategorie from './SceltaCategorie'
import { MenuObiettivo, PillObiettivo } from './dose/comune'

// La struttura della seduta di una fase: le sezioni, in ordine. Quelle della
// libreria si spuntano (nome, categorie e obiettivo stanno la'); una sezione
// solo di questa fase ha i suoi.
export default function StrutturaFase({ faseId }: { faseId: number }): React.JSX.Element {
  const [sezioni, setSezioni] = useState<SezioneConCategorie[]>([])
  const [libreria, setLibreria] = useState<SezioneLibreria[]>([])
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [selSez, setSelSez] = useState<number | null>(null)
  const [nuova, setNuova] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ id: number; nome: string } | null>(null)

  const load = useCallback(
    (): Promise<void> => window.api.sezioni.list(faseId).then(setSezioni),
    [faseId]
  )

  useEffect(() => {
    void load()
    void window.api.sezioniLibreria.list().then(setLibreria)
    void window.api.categorie.list().then(setCategorie)
  }, [load])

  const esegui = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const { ordine, contenitore, presa } = useRiordinoSalvato(sezioni, (ids) =>
    esegui(() => window.api.sezioni.reorder(ids))
  )

  const sez = sezioni.find((s) => s.id === selSez) ?? null

  const aggiungi = (): void => {
    const nome = (nuova ?? '').trim()
    if (nome === '') return
    void esegui(async () => {
      setSelSez(await window.api.sezioni.create(faseId, nome))
      setNuova(null)
    })
  }

  const rinomina = (): void => {
    if (!edit || !edit.nome.trim()) return
    void esegui(async () => {
      await window.api.sezioni.update(edit.id, edit.nome.trim())
      setEdit(null)
    })
  }

  const togli = async (s: SezioneConCategorie): Promise<void> => {
    if (s.libreria_id != null) {
      await esegui(() => window.api.sezioni.daLibreria(faseId, s.libreria_id!, false))
      return
    }
    if (await chiedi(`Eliminare "${s.nome}"?`)) await esegui(() => window.api.sezioni.remove(s.id))
  }

  const nomeCategoria = (cid: number): string => categorie.find((c) => c.id === cid)?.nome ?? '?'

  return (
    <div className="struttura-tab">
      <section className="crud-list">
        <h3>
          Sezioni della seduta
          <Aiuto testo="Le sezioni di questa fase, nell'ordine in cui compaiono nella seduta (si trascinano). Spunta qui sotto quelle della libreria; se te ne serve una che vale solo per questa fase, aggiungila a parte." />
        </h3>
        <ul>
          {ordine.map((s, idx) => {
            const dnd = contenitore(idx)
            return (
              <li
                key={s.id}
                {...dnd}
                {...presa(idx)}
                className={['selectable', selSez === s.id ? 'selected' : '', dnd.className ?? ''].filter(Boolean).join(' ')}
                onClick={() => setSelSez(s.id)}
              >
                {edit?.id === s.id ? (
                  <span className="edit-row" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={edit.nome}
                      onChange={(e) => setEdit({ id: s.id, nome: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') rinomina()
                        if (e.key === 'Escape') setEdit(null)
                      }}
                    />
                    <button onClick={rinomina}>OK</button>
                  </span>
                ) : (
                  <>
                    <span className="item-nome">
                      {s.nome}
                      {s.libreria_id == null && <span className="tag-riga">solo di questa fase</span>}
                    </span>
                    <PillObiettivo obiettivo={s.obiettivo} />
                    <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                      {s.libreria_id == null && (
                        <button title="Rinomina" onClick={() => setEdit({ id: s.id, nome: s.nome })}>
                          <Pencil size={16} />
                        </button>
                      )}
                      <button
                        title={s.libreria_id == null ? 'Elimina' : 'Togli dalla fase'}
                        className="danger"
                        onClick={() => void togli(s)}
                      >
                        <X size={16} />
                      </button>
                    </span>
                  </>
                )}
              </li>
            )
          })}
          {sezioni.length === 0 && <li className="empty">Nessuna sezione: spunta qui sotto.</li>}
        </ul>

        <div className="sotto-titolo">Dalla libreria</div>
        <ul className="checkbox-list sezioni-da-libreria">
          {libreria.map((l) => (
            <li key={l.id}>
              <label>
                <input
                  type="checkbox"
                  checked={sezioni.some((s) => s.libreria_id === l.id)}
                  onChange={(e) => void esegui(() => window.api.sezioni.daLibreria(faseId, l.id, e.target.checked))}
                />
                {l.nome}
              </label>
            </li>
          ))}
        </ul>
        {nuova == null ? (
          <button className="btn-aggiungi-lista" onClick={() => setNuova('')}>
            <Plus size={15} /> Sezione solo di questa fase
          </button>
        ) : (
          <div className="add-row">
            <input
              autoFocus
              placeholder="es. Core e stabilità"
              value={nuova}
              onChange={(e) => setNuova(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') aggiungi()
                if (e.key === 'Escape') setNuova(null)
              }}
            />
            <button onClick={aggiungi}>OK</button>
            <button title="Chiudi" onClick={() => setNuova(null)}>
              <X size={16} />
            </button>
          </div>
        )}
      </section>

      <section className="crud-list">
        <h3>Categorie della sezione</h3>
        {sez == null ? (
          <p className="hint">Seleziona una sezione</p>
        ) : sez.libreria_id != null ? (
          <>
            <p className="hint">
              È una sezione della libreria: obiettivo e categorie si cambiano in Libreria esercizi → Sezioni.
            </p>
            <ul className="checkbox-list">
              {sez.categoria_ids.map((cid) => (
                <li key={cid}>{nomeCategoria(cid)}</li>
              ))}
              {sez.categoria_ids.length === 0 && <li className="empty">Nessuna categoria associata.</li>}
            </ul>
          </>
        ) : (
          <>
            <div className="sotto-titolo">Obiettivo</div>
            <MenuObiettivo
              titolo={`Obiettivo di ${sez.nome}`}
              obiettivo={sez.obiettivo}
              onScegli={(o) => void esegui(() => window.api.sezioni.setObiettivo(sez.id, o))}
            />
            <div className="sotto-titolo">Categorie che propone</div>
            <SceltaCategorie
              key={sez.id}
              categorie={categorie}
              scelte={sez.categoria_ids}
              onCambia={(ids) => void esegui(() => window.api.sezioni.setCategorie(sez.id, ids))}
            />
          </>
        )}
      </section>
    </div>
  )
}
