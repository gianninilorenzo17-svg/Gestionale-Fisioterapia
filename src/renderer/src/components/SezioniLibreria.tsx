import { useCallback, useEffect, useState } from 'react'
import type { Categoria, SezioneLibreria } from '../../../shared/types'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'
import Aiuto from './Aiuto'
import CrudList from './CrudList'
import SceltaCategorie from './SceltaCategorie'
import { MenuObiettivo, PillObiettivo } from './dose/comune'

// Libreria → Sezioni: le sezioni della seduta si scrivono una volta e le fasi
// le spuntano. L'obiettivo dice dove va il rinforzo che ci si mette (la
// pliometria si conta ovunque).
export default function SezioniLibreria(): React.JSX.Element {
  const [sezioni, setSezioni] = useState<SezioneLibreria[]>([])
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [selId, setSelId] = useState<number | null>(null)

  const load = useCallback((): Promise<void> => window.api.sezioniLibreria.list().then(setSezioni), [])
  useEffect(() => {
    void load()
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

  const sez = sezioni.find((s) => s.id === selId) ?? null

  return (
    <section className="card">
      <div className="struttura-tab sezioni-libreria">
        <CrudList
          title="Sezioni"
          aiuto="Si scrivono una volta e le fasi le spuntano. La pillola dice dove va il rinforzo messo in quella sezione; la pliometria si conta ovunque, anche nel riscaldamento."
          items={sezioni}
          selectedId={selId}
          onSelect={setSelId}
          dopoNome={(s) => <PillObiettivo obiettivo={sezioni.find((x) => x.id === s.id)?.obiettivo ?? null} />}
          onAdd={async (nome) => {
            setSelId(await window.api.sezioniLibreria.create(nome))
            await load()
          }}
          onRename={async (id, nome) => {
            await window.api.sezioniLibreria.update(id, nome)
            await load()
          }}
          onDelete={async (id) => {
            await window.api.sezioniLibreria.remove(id)
            if (selId === id) setSelId(null)
            await load()
          }}
          onReorder={async (ids) => {
            await window.api.sezioniLibreria.reorder(ids)
            await load()
          }}
          etichettaAggiungi="Nuova sezione"
          addPlaceholder="es. Riscaldamento"
          emptyHint="Nessuna sezione."
        />
        <section className="crud-list">
          {sez == null ? (
            <p className="hint">Seleziona una sezione</p>
          ) : (
            <>
              <h3>{sez.nome}</h3>
              <div className="sotto-titolo">Obiettivo</div>
              <MenuObiettivo
                titolo={`Obiettivo di ${sez.nome}`}
                obiettivo={sez.obiettivo}
                onScegli={(o) => void esegui(() => window.api.sezioniLibreria.setObiettivo(sez.id, o))}
              />
              <div className="sotto-titolo">
                Categorie che propone
                <Aiuto testo="Spuntando una categoria la sezione propone anche gli esercizi dei distretti che ci stanno dentro: «Rinforzo» porta con sé quadricipite, spalla e polpaccio." />
              </div>
              <SceltaCategorie
                key={sez.id}
                categorie={categorie}
                scelte={sez.categoria_ids}
                onCambia={(ids) => void esegui(() => window.api.sezioniLibreria.setCategorie(sez.id, ids))}
              />            </>
          )}
        </section>
      </div>
    </section>
  )
}
