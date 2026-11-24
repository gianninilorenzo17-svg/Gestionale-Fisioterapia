// I due pezzi con cui si compongono tutte le schede di Impostazioni: un
// riquadro con il titolo e, dentro, una riga per scelta. A sinistra cosa e' e
// una frase che lo spiega, a destra il controllo. Se lo spazio e' poco (la
// finestra e' stretta, o i caratteri sono ingranditi) il controllo va sotto il
// testo: lo decide la larghezza del riquadro, non quella dello schermo.

export function CardImp({
  titolo,
  nota,
  azioni,
  children
}: {
  titolo: string
  // una parola o due accanto al titolo, in piccolo
  nota?: string
  // pulsanti a destra del titolo
  azioni?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="imp-card">
      <h3 className="imp-card-titolo">
        <span>
          {titolo}
          {nota && <small>{nota}</small>}
        </span>
        {azioni && <span className="imp-card-azioni">{azioni}</span>}
      </h3>
      {children}
    </section>
  )
}

export function RigaImp({
  nome,
  descrizione,
  children,
  sotto,
  larga
}: {
  nome: string
  descrizione?: React.ReactNode
  // il controllo, a destra
  children?: React.ReactNode
  // qualcosa che occupa tutta la larghezza sotto la riga (un modulo che si apre)
  sotto?: React.ReactNode
  // il controllo e' grande: sta sotto il testo invece che a destra
  larga?: boolean
}): React.JSX.Element {
  return (
    <div className={`imp-riga${larga ? ' imp-riga-larga' : ''}`}>
      <div className="imp-riga-testo">
        <b>{nome}</b>
        {descrizione && <span className="imp-d">{descrizione}</span>}
      </div>
      {children != null && <div className="imp-riga-controllo">{children}</div>}
      {sotto && <div className="imp-riga-sotto">{sotto}</div>}
    </div>
  )
}
