import { useEffect, useState } from 'react'
import { toastErrore } from '../../components/Toast'
import { errMsg } from '../../lib'
import { daPrecarico, ricorda } from '../../precarico'
import { RigaImp } from './Riga'

// Blocco automatico: l'app torna alla password dopo un po' che non la tocchi.
// Sta con la password e il recupero perche' e' la stessa domanda — chi puo'
// entrare — vista da tre parti.
export function RigaBlocco(): React.JSX.Element {
  const iniziale = daPrecarico<{ attivo: boolean; minuti: number }>('blocco', {
    attivo: false,
    minuti: 15
  })
  const [attivo, setAttivo] = useState(iniziale.attivo)
  const [minuti, setMinuti] = useState(iniziale.minuti)

  useEffect(() => {
    void window.api.sicurezza.blocco().then((b) => {
      ricorda('blocco')(b)
      setAttivo(b.attivo)
      setMinuti(b.minuti)
    })
  }, [])

  const salva = (nuovo: { attivo: boolean; minuti: number }): void => {
    setAttivo(nuovo.attivo)
    setMinuti(nuovo.minuti)
    ricorda('blocco')(nuovo)
    window.api.sicurezza.setBlocco(nuovo).catch((e) => toastErrore(errMsg(e)))
  }

  return (
    <RigaImp
      nome="Blocco automatico"
      descrizione="Dopo un po' che non tocchi niente, il programma torna alla schermata della password. Il lavoro aperto resta dov'è: per riprendere basta riscriverla."
    >
      <span className="imp-azioni">
        {attivo && (
          <label className="imp-minuti">
            dopo
            <input
              type="number"
              min={1}
              max={240}
              aria-label="Dopo quanti minuti"
              value={minuti}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n >= 1) salva({ attivo, minuti: n })
              }}
            />
            minuti
          </label>
        )}
        <input
          type="checkbox"
          className="interruttore"
          aria-label="Blocco automatico"
          checked={attivo}
          onChange={(e) => salva({ attivo: e.target.checked, minuti })}
        />
      </span>
    </RigaImp>
  )
}
