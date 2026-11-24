import { useEffect, useState } from 'react'
import type { Tema } from '../../../shared/temi'
import type { Profilo } from '../../../shared/types'
import { precaricaImpostazioni } from '../precarico'
import { SchedaDati } from './impostazioni/SchedaDati'
import { SchedaProfilo } from './impostazioni/SchedaProfilo'
import { SchedaGuida } from './impostazioni/SchedaGuida'
import { SchedaSicurezza } from './impostazioni/SchedaSicurezza'
import { ModoScuro, SchedaAspetto } from './impostazioni/SchedaAspetto'

// Impostazioni dell'app: dove stanno i dati e le copie, la password, il colore.
//
// Prima erano due finestrine appese in fondo alla barra laterale, e il tema non
// c'era. Sono cose che si toccano di rado ma che vanno trovate subito, percio'
// stanno in una sezione sola, a schede, come la configurazione.

// Cinque schede, divise per domanda: "chi sono io", "che aspetto ha il
// programma per me", "chi puo' entrare", "dove stanno le mie cose e come sono al
// sicuro" e "come si faceva quella cosa". Il cestino sta con i dati perche' e'
// l'ultima rete prima di perderli davvero.
type Scheda = 'profilo' | 'aspetto' | 'sicurezza' | 'dati' | 'guida'

// Dall'alto in basso come si scende dal proprio nome all'archivio: prima chi
// sei, poi l'aspetto, poi l'accesso, poi dove stanno le cose, e in fondo la
// guida, che si apre solo quando serve.
const SCHEDE: { key: Scheda; label: string }[] = [
  { key: 'profilo', label: 'Profilo' },
  { key: 'aspetto', label: 'Aspetto' },
  { key: 'sicurezza', label: 'Sicurezza' },
  { key: 'dati', label: 'Dati e backup' },
  { key: 'guida', label: 'Guida' }
]

export default function ImpostazioniPage({
  tornaAllInizio,
  tema,
  onTema,
  scuro,
  modoScuro,
  orariScuro,
  onScuro,
  barraScura,
  onBarraScura,
  ingrandimento,
  onIngrandimento
}: {
  tornaAllInizio: number
  tema: Tema
  onTema: (t: Tema) => void
  scuro: boolean
  modoScuro: ModoScuro
  orariScuro: { dalle: string; alle: string }
  onScuro: (modo: ModoScuro, orari?: { dalle: string; alle: string }) => void
  barraScura: boolean
  onBarraScura: (valore: boolean) => void
  ingrandimento: number
  onIngrandimento: (valore: number) => void
}): React.JSX.Element {
  // Aprendo Impostazioni si arriva sulla prima scheda, come in configurazione.
  const [scheda, setScheda] = useState<Scheda>('profilo')

  // Entrando si rileggono i dati di «Dati e backup»: la scheda li trova gia' pronti.
  useEffect(() => {
    void precaricaImpostazioni()
  }, [])

  useEffect(() => {
    if (tornaAllInizio === 0) return
    setScheda('profilo')
  }, [tornaAllInizio])

  return (
    <div className="page">
      <header className="page-header">
        <h2>Impostazioni</h2>
      </header>
      <div className="config-tabs config-tabs-top">
        {SCHEDE.map((t) => (
          <button
            key={t.key}
            className={scheda === t.key ? 'active' : ''}
            onClick={() => setScheda(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Ogni scheda e' una colonna di riquadri con righe dentro (vedi Riga.tsx).
          La larghezza la decide il contenitore, non lo schermo: con il menu a
          sinistra lo spazio e' meno di quello che sembra. */}
      <div className="imp-pagina">
        {scheda === 'dati' && <SchedaDati />}
        {scheda === 'profilo' && <SchedaProfilo />}
        {scheda === 'guida' && (
          <div className="scheda">
            <SchedaGuida />
          </div>
        )}
        {scheda === 'sicurezza' && <SchedaSicurezza />}
        {scheda === 'aspetto' && (
          <SchedaAspetto
            tema={tema}
            onTema={onTema}
            scuro={scuro}
            modoScuro={modoScuro}
            orariScuro={orariScuro}
            onScuro={onScuro}
            barraScura={barraScura}
            onBarraScura={onBarraScura}
            ingrandimento={ingrandimento}
            onIngrandimento={onIngrandimento}
          />
        )}
      </div>
    </div>
  )
}
