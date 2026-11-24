import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  Cloud,
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  FolderOpen,
  HardDriveDownload,
  RotateCcw,
  Save,
  ShieldCheck
} from 'lucide-react'
import type { EsitoControllo, InfoBackup } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg, formatData } from '../lib'
import { avvisoCopiaFuori, giorniDallaCopiaFuori } from '../../../shared/copie'
import { CardImp, RigaImp } from '../pages/impostazioni/Riga'
import { daPrecarico, ricorda } from '../precarico'

// Copie di sicurezza dell'archivio. Ogni copia contiene il database cifrato e
// il file delle chiavi: servono entrambi, uno solo non riapre niente.
export default function PannelloBackup(): React.JSX.Element {
  const [info, setInfo] = useState<InfoBackup | null>(() => daPrecarico('backupInfo', null))
  const [menuCopia, setMenuCopia] = useState(false)
  // Le copie si fanno senza bloccare il programma: intanto il pulsante lo dice,
  // e non ne fa partire un'altra.
  const [copiaInCorso, setCopiaInCorso] = useState(false)
  // L'esito del controllo di ogni copia, da quando lo si chiede: 'attesa'
  // mentre la copia viene aperta.
  const [esiti, setEsiti] = useState<Record<string, EsitoControllo | 'attesa'>>({})

  const carica = useCallback(
    (): Promise<void> => window.api.backup.info().then(ricorda<InfoBackup>('backupInfo')).then(setInfo),
    []
  )

  useEffect(() => {
    void carica().catch((e) => toastErrore(errMsg(e)))
  }, [carica])

  // La domanda di recupero apre l'archivio come la password: se le copie stanno
  // online, chi le ottenesse potrebbe provare a indovinarne la risposta.
  const [conDomanda, setConDomanda] = useState(() => daPrecarico<string | null>('domanda', null) != null)
  // Lo stesso per una password corta: online, la si prova all'infinito.
  const [passwordDebole, setPasswordDebole] = useState(() => daPrecarico('passwordDebole', false))
  useEffect(() => {
    window.api.auth
      .domanda()
      .then(ricorda<string | null>('domanda'))
      .then((d) => setConDomanda(d != null))
      .catch(() => undefined)
    window.api.auth
      .passwordDebole()
      .then(ricorda<boolean>('passwordDebole'))
      .then(setPasswordDebole)
      .catch(() => undefined)
  }, [])

  if (!info) return <p className="hint caricamento-ritardato">Caricamento…</p>

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const copia = async (fn: () => Promise<unknown>): Promise<void> => {
    setCopiaInCorso(true)
    try {
      await run(fn)
    } finally {
      setCopiaInCorso(false)
    }
  }

  const quando = (nome: string): string => {
    // nome nella forma 2026-08-31_1435, eventualmente con un prefisso
    const m = nome.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})$/)
    if (!m) return nome
    return `${m[3]}/${m[2]}/${m[1]} alle ${m[4]}:${m[5]}`
  }

  const peso = (byte: number): string =>
    byte > 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.round(byte / 1024)} kB`

  // Controllare una copia vuol dire aprirla davvero. Le copie servono il giorno
  // che qualcosa e' andato storto, ed e' il giorno sbagliato per scoprire che
  // non si aprono: qui si scopre prima, senza toccare l'archivio in uso.
  const controlla = async (nome: string): Promise<void> => {
    setEsiti((prec) => ({ ...prec, [nome]: 'attesa' }))
    try {
      const esito = await window.api.backup.controlla(nome)
      setEsiti((prec) => ({ ...prec, [nome]: esito }))
    } catch (e) {
      setEsiti((prec) => ({
        ...prec,
        [nome]: { ok: false, messaggio: errMsg(e) }
      }))
    }
  }

  // Quello che uno vuole leggere: si apre, e c'e' dentro il mio lavoro.
  const dentro = (e: EsitoControllo): string => {
    const parti = [
      `${e.pazienti} ${e.pazienti === 1 ? 'paziente' : 'pazienti'}`,
      `${e.sedute} ${e.sedute === 1 ? 'seduta' : 'sedute'}`
    ]
    if (e.ultimaSeduta) parti.push(`l'ultima del ${formatData(e.ultimaSeduta)}`)
    return parti.join(', ')
  }

  const ripristina = async (nome: string): Promise<void> => {
    if (
      !(await chiedi({
        titolo: 'Ripristinare questa copia?',
        testo:
          `Riportare l'archivio a com'era il ${quando(nome)}?\n\n` +
          'Tutto quello che hai aggiunto dopo quella data sparirà dall’app.\n' +
          'Prima di procedere viene fatta una copia dello stato attuale, così è comunque recuperabile.\n\n' +
          "L'app si riavvierà e dovrai rientrare con la password che usavi in quella data: se nel frattempo l'hai cambiata, la nuova non vale per questa copia (resta la chiave di recupero).",
        // è l'azione che sostituisce l'archivio: rossa, come "Elimina"
        conferma: 'Ripristina',
        pericolo: true
      }))
    ) {
      return
    }
    void window.api.backup.ripristina(nome).catch((e) => toastErrore(errMsg(e)))
  }

  // Le tre domande a cui si risponde guardando qui: quando e' l'ultima copia,
  // quante ce ne sono, e se ce n'e' una fuori dal computer.
  const ultima = info.copie[0]
  const parti = ultima ? quando(ultima.nome).split(' alle ') : null
  const giorniFuori = giorniDallaCopiaFuori(info.ultimaCopiaFuori)
  const fuoriAvviso = avvisoCopiaFuori(info)

  const faiCopiaFuori = (): void => {
    void copia(async () => {
      const dove = await window.api.backup.copiaFuori()
      if (dove) toast('Copia salvata sul supporto scelto.')
    })
  }

  const menuFaiCopia = (
    <span className="menu-wrapper">
      <button className="primary" disabled={copiaInCorso} onClick={() => setMenuCopia(!menuCopia)}>
        <Save size={16} /> {copiaInCorso ? 'Copia in corso…' : 'Fai una copia'}
        {!copiaInCorso && <ChevronDown size={15} />}
      </button>
      {menuCopia && (
        <>
          <div className="menu-chiudi" onClick={() => setMenuCopia(false)} />
          <div className="menu-tendina">
            <button
              onClick={() => {
                setMenuCopia(false)
                void copia(async () => {
                  await window.api.backup.eseguiOra()
                  toast('Copia di sicurezza creata.')
                })
              }}
            >
              <Save size={16} /> Qui, nella cartella delle copie
            </button>
            <button
              onClick={() => {
                setMenuCopia(false)
                faiCopiaFuori()
              }}
            >
              <HardDriveDownload size={16} /> Su chiavetta o disco esterno…
            </button>
            <button
              onClick={() => {
                setMenuCopia(false)
                void run(async () => {
                  const dove = await window.api.backup.esportaArchivio()
                  if (dove) toast('Archivio esportato in tabelle leggibili.')
                })
              }}
            >
              <FileSpreadsheet size={16} /> In tabelle Excel…
            </button>
          </div>
        </>
      )}
    </span>
  )

  return (
    <div className="imp-colonna">
      {/* Prima lo stato: "i miei dati sono al sicuro?". Quello che non va si
          riconosce dal colore, e ha il pulsante per sistemarlo. */}
      <div className="imp-stati">
        <div className={`imp-stato${!ultima || info.copiaFallita ? ' avv' : ''}`}>
          <small>Ultima copia</small>
          {info.copiaFallita ? (
            <>
              <b>non riuscita</b>
              <span>le copie di prima ci sono ancora</span>
            </>
          ) : parti ? (
            <>
              <b>{parti[0]}</b>
              <span>
                {parti[1] ? `alle ${parti[1]} · ` : ''}
                {peso(ultima.dimensione)}
              </span>
            </>
          ) : (
            <>
              <b>mai fatta</b>
              <span>
                {info.attivo
                  ? 'si fa da sola quando accedi e quando chiudi'
                  : 'le copie automatiche sono spente'}
              </span>
            </>
          )}
        </div>
        <div className="imp-stato">
          <small>Copie nella cartella</small>
          <b>
            {info.copie.length} di {info.daTenere}
          </b>
          <span>le più vecchie si cancellano da sole</span>
        </div>
        <div className={`imp-stato${info.inOneDrive ? ' ok' : fuoriAvviso ? ' avv' : ' ok'}`}>
          <small>Fuori dal computer</small>
          {info.inOneDrive ? (
            <>
              <b>in OneDrive</b>
              <span>le copie finiscono online da sole</span>
            </>
          ) : giorniFuori == null ? (
            <>
              <b>nessuna</b>
              <span>se il computer si rompe, le copie vanno via con lui</span>
            </>
          ) : (
            <>
              <b>{giorniFuori === 0 ? 'oggi' : `${giorniFuori} giorni fa`}</b>
              <span>l&apos;ultima su chiavetta o disco esterno</span>
            </>
          )}
          {!info.inOneDrive && fuoriAvviso && (
            <button className="primary" disabled={copiaInCorso} onClick={faiCopiaFuori}>
              <HardDriveDownload size={15} /> Copia su chiavetta
            </button>
          )}
        </div>
      </div>

      <CardImp titolo="Copie di sicurezza" azioni={menuFaiCopia}>
        <RigaImp
          nome="Fai le copie automaticamente"
          descrizione="Una quando accedi e una quando chiudi il programma. Ogni copia contiene il database cifrato e il file delle chiavi: servono entrambi."
        >
          <input
            type="checkbox"
            className="interruttore"
            aria-label="Fai le copie automaticamente"
            checked={info.attivo}
            onChange={(e) => void run(() => window.api.backup.setAttivo(e.target.checked))}
          />
        </RigaImp>
        <RigaImp
          nome="Copie da tenere"
          descrizione="Quando superano questo numero, le più vecchie si cancellano. Vale dalla prossima copia."
        >
          <input
            type="number"
            className="imp-numero"
            min={1}
            max={100}
            aria-label="Copie da tenere"
            value={info.daTenere}
            onChange={(e) => {
              // Il campo svuotato non e' "tienine zero": si aspetta che scriva
              // un numero. Il valore si salva subito.
              const n = Number(e.target.value)
              if (Number.isFinite(n) && n >= 1) void run(() => window.api.backup.setDaTenere(n))
            }}
          />
        </RigaImp>
        <RigaImp
          nome="Cartella delle copie"
          descrizione={<span className="cartella-path">{info.cartella}</span>}
          larga
        >
          <span className="imp-azioni">
            <button onClick={() => void window.api.backup.apriCartella()}>
              <FolderOpen size={16} /> Apri cartella
            </button>
            <button onClick={() => void run(() => window.api.backup.cambiaCartella())}>
              Cambia cartella…
            </button>
            {/* Le copie dentro OneDrive vanno online da sole: e' il modo piu'
                semplice di averle fuori dal computer. Il pulsante compare solo
                se OneDrive su questo computer c'e' davvero. */}
            {info.oneDrive && !info.inOneDrive && (
              <button
                onClick={() =>
                  void run(async () => {
                    // Online le copie sono fuori dal computer, ed e' il bello; ma
                    // chi se ne procura una puo' provare password senza limiti.
                    const ok = await chiedi({
                      titolo: 'Mettere le copie in OneDrive?',
                      testo:
                        'Le copie restano cifrate: senza la password, o la chiave di recupero, non si aprono.\n\n' +
                        'Ma online chi se ne procurasse una potrebbe provare password quante vuole, senza che tu lo sappia: ' +
                        'conta che la password sia lunga e non comune.' +
                        (passwordDebole
                          ? '\n\nLa tua password è corta o facile da indovinare: dopo, cambiala da Impostazioni, in «Sicurezza».'
                          : '') +
                        (conDomanda
                          ? '\n\nHai anche una domanda di recupero: vale lo stesso per la sua risposta.'
                          : ''),
                      conferma: 'Metti in OneDrive'
                    })
                    if (!ok) return
                    await window.api.backup.usaOneDrive()
                    toast('Le copie andranno in OneDrive.')
                  })
                }
              >
                <Cloud size={16} /> Metti in OneDrive
              </button>
            )}
          </span>
        </RigaImp>
        {(info.copiaFallita ||
          info.inOneDrive ||
          (info.inOneDrive && passwordDebole) ||
          (info.inOneDrive && conDomanda)) && (
          <div className="imp-avvisi">
            {info.copiaFallita && (
              <span className="esito-copia esito-guasto">
                <CircleAlert size={15} /> L&apos;ultima copia automatica non è riuscita (
                {new Date(info.copiaFallita.quando).toLocaleString('it-IT', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })}
                , {info.copiaFallita.messaggio}). Le copie di prima ci sono ancora. Prova «Fai una
                copia» › «Qui, nella cartella delle copie»: se non riesce, controlla che la cartella
                delle copie sia raggiungibile. Alla prossima chiusura riuscita questo avviso
                sparisce.
              </span>
            )}
            {info.inOneDrive && (
              <span className="esito-copia esito-buono">
                <Cloud size={15} /> Queste copie finiscono anche online, in OneDrive: se il computer
                si rompe, i dati non si perdono.
              </span>
            )}
            {info.inOneDrive && passwordDebole && (
              <span className="esito-copia esito-guasto">
                <CircleAlert size={15} /> Le copie stanno online e la tua password è corta o facile
                da indovinare: chi si procurasse una copia potrebbe provarne quante vuole. Cambiala
                da Impostazioni, in «Sicurezza»: meglio una frase di qualche parola.
              </span>
            )}
            {info.inOneDrive && conDomanda && (
              <span className="esito-copia esito-guasto">
                <CircleAlert size={15} /> Hai una domanda di recupero, e le copie stanno online:
                chi si procurasse quelle copie potrebbe provare a indovinare la risposta quante
                volte vuole. Se preferisci, toglila da Impostazioni, in «Sicurezza»: la chiave di
                recupero basta.
              </span>
            )}
          </div>
        )}
      </CardImp>

      <CardImp titolo="Copie fatte" nota={info.copie.length > 0 ? String(info.copie.length) : undefined}>
        {info.copie.length === 0 ? (
          <p className="hint imp-vuoto">
            Nessuna copia ancora. Premi &ldquo;Fai una copia&rdquo; per averne subito una.
          </p>
        ) : (
          <ul className="sedute-list imp-copie">
            {info.copie.map((c) => (
              <li key={c.nome} className="riga-copia">
                <div className="seduta-info">
                  <span className="seduta-data">{quando(c.nome)}</span>
                  <span className="seduta-meta">
                    {peso(c.dimensione)}
                    {c.nome.startsWith('prima-del-ripristino') && ' · prima di un ripristino'}
                    {c.nome.startsWith('prima-della-migrazione') && ' · prima di un aggiornamento'}
                  </span>
                  {esiti[c.nome] === 'attesa' && (
                    <span className="esito-copia">Controllo in corso…</span>
                  )}
                  {typeof esiti[c.nome] === 'object' && (
                    <span
                      className={
                        (esiti[c.nome] as EsitoControllo).ok
                          ? 'esito-copia esito-buono'
                          : 'esito-copia esito-guasto'
                      }
                    >
                      {(esiti[c.nome] as EsitoControllo).ok ? (
                        <>
                          <CircleCheck size={15} /> Si apre, e contiene{' '}
                          {dentro(esiti[c.nome] as EsitoControllo)}.
                        </>
                      ) : (
                        <>
                          <CircleAlert size={15} /> {(esiti[c.nome] as EsitoControllo).messaggio}
                        </>
                      )}
                    </span>
                  )}
                </div>
                <span className="row-actions">
                  <button
                    title="Apre questa copia in disparte e controlla che sia leggibile"
                    disabled={esiti[c.nome] === 'attesa'}
                    onClick={() => void controlla(c.nome)}
                  >
                    <ShieldCheck size={18} /> Controlla
                  </button>
                  <button
                    title="Riporta l'archivio a questa copia"
                    onClick={() => void ripristina(c.nome)}
                  >
                    <RotateCcw size={18} /> Ripristina
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardImp>
    </div>
  )
}
