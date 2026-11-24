import { useEffect, useState } from 'react'
import type { EsitoArchivio } from '../../../../shared/types'
import PannelloBackup from '../../components/PannelloBackup'
import { FolderOpen, ShieldCheck } from 'lucide-react'
import { toast, toastErrore } from '../../components/Toast'
import { errMsg } from '../../lib'
import { SchedaCestino } from './SchedaCestino'
import { CardImp, RigaImp } from './Riga'
import { daPrecarico, ricorda } from '../../precarico'

export function SchedaDati(): React.JSX.Element {
  const [esitoArchivio, setEsitoArchivio] = useState<EsitoArchivio | null>(null)
  const [inCorso, setInCorso] = useState(false)

  const controlla = async (): Promise<void> => {
    setInCorso(true)
    try {
      setEsitoArchivio(await window.api.archivio.controlla())
    } catch (e) {
      setEsitoArchivio({ ok: false, messaggio: errMsg(e), pazienti: 0, sedute: 0 })
    } finally {
      setInCorso(false)
    }
  }

  const iniziale = daPrecarico<{ cartella: string; cartellaExport: string } | null>('impostazioniInfo', null)
  const [cartella, setCartella] = useState(iniziale?.cartella ?? '')
  const [cartellaExport, setCartellaExport] = useState(iniziale?.cartellaExport ?? '')

  useEffect(() => {
    void window.api.impostazioni.info().then((i) => {
      ricorda('impostazioniInfo')(i)
      setCartella(i.cartella)
      setCartellaExport(i.cartellaExport)
    })
  }, [])

  const cambiaDati = async (): Promise<void> => {
    try {
      const nuova = await window.api.impostazioni.cambiaCartella()
      if (nuova) {
        setCartella(nuova)
        toast('Dati spostati nella nuova cartella.')
      }
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const cambiaExport = async (): Promise<void> => {
    try {
      const nuova = await window.api.impostazioni.cambiaCartellaExport()
      if (nuova) setCartellaExport(nuova)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="imp-colonna">
      {/* Prima le copie di sicurezza: sono la cosa che conta. Poi dove vivono i
          file, e in fondo le cose che si toccano solo quando qualcosa non va. */}
      <PannelloBackup />

      <CardImp titolo="Dove stanno i file">
        <RigaImp
          nome="Cartella dei dati"
          descrizione={
            <>
              Tutti i tuoi dati vivono qui: riabilitazione.db (il database cifrato) e auth.json
              (le chiavi di accesso). Servono entrambi.
              <br />
              <span className="cartella-path">{cartella}</span>
            </>
          }
          larga
        >
          <span className="imp-azioni">
            <button onClick={() => void window.api.impostazioni.apriCartella()}>Apri cartella</button>
            <button onClick={() => void cambiaDati()}>Cambia cartella…</button>
          </span>
        </RigaImp>
        <RigaImp
          nome="Cartella per gli export"
          descrizione={
            <>
              Dove il programma propone di salvare quando esporti una seduta o uno storico: l&apos;ultima
              cartella usata viene ricordata.
              <br />
              <span className="cartella-path">{cartellaExport}</span>
            </>
          }
          larga
        >
          <span className="imp-azioni">
            <button onClick={() => void cambiaExport()}>Cambia cartella…</button>
          </span>
        </RigaImp>
      </CardImp>

      <section className="imp-card imp-cestino">
        <SchedaCestino />
      </section>

      <CardImp titolo="Quando qualcosa non va">
        <RigaImp
          nome="Controllo dell'archivio"
          descrizione="Controlla che il file dell'archivio non si sia rovinato e che i collegamenti fra le schede siano interi. Da fare dopo uno spegnimento brutto del computer."
          sotto={
            esitoArchivio ? (
              <span
                className={
                  esitoArchivio.ok ? 'esito-copia esito-buono' : 'esito-copia esito-guasto'
                }
              >
                {esitoArchivio.ok
                  ? `Tutto in ordine — ${esitoArchivio.pazienti} pazienti, ${esitoArchivio.sedute} sedute.`
                  : esitoArchivio.messaggio}
              </span>
            ) : undefined
          }
        >
          <button disabled={inCorso} onClick={() => void controlla()}>
            <ShieldCheck size={16} /> {inCorso ? 'Controllo…' : 'Controlla'}
          </button>
        </RigaImp>
        <RigaImp
          nome="Registro degli errori"
          descrizione="Ogni errore del programma lascia una riga in un file di testo, con la data e il punto in cui è successo. Solo messaggi tecnici, nessun dato dei pazienti."
        >
          <button onClick={() => void window.api.registro.apri()}>
            <FolderOpen size={16} /> Apri il registro
          </button>
        </RigaImp>
      </CardImp>
    </div>
  )
}
