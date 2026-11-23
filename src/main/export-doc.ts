// Generazione documenti (HTML per il PDF, docx per Word) da dati già letti.
// Nessuna dipendenza da Electron: testabile con Node (vedi test/export-seduta.test.ts).
import { coloriTema } from '../shared/temi'
import { coloreSezione } from '../shared/colore-sezione'
import { caselleDose, fraseDose, gambeTesto } from '../shared/scheda-riga'
import { stileScheda, type StileScheda } from '../shared/stile-scheda'
import { esc } from './html'
import { leggiProfilo, righeProfilo, testoIscrizione } from './profilo'
import { LINK_WEB } from './validazione'
import {
  caricoTesto,
  intensitaTesto,
  rirTesto,
  recuperoTesto,
  ripetizioniTesto,
  volumeTesto
} from '../shared/dosaggio'
import { nomeConMonopodalico, nomeConVariante } from '../shared/varianti'
// La libreria di Word pesa (circa 180 ms a caricarla) e serve solo a chi esporta
// in .docx: si carica in generaDocx, alla prima esportazione, e non all'avvio.
// Qui entrano solo i tipi, che spariscono a compilazione.
import type { Paragraph as ParagrafoWord, Table as TabellaWord } from 'docx'

export interface DatiPazienteExport {
  nome: string
  cognome: string
  tipo_intervento: string | null
  data_intervento: string | null
  patologia_nome: string | null
  // Cosa deve fare a casa: ogni quanto, e le indicazioni scelte per lui.
  // Finiscono in fondo al foglio, dopo il programma.
  frequenza_casa?: string | null
  indicazioni?: string[]
}

export interface DatiSedutaExport {
  data: string
  fase_nome: string | null
  note: string | null
  sezioni: {
    nome: string | null // null = esercizi senza sezione (sedute v1)
    esercizi: {
      nome: string
      // null per un esercizio "al volo" (scritto solo per quella seduta):
      // non ha una categoria di libreria. Non compare in stampa comunque.
      categoria_nome: string | null
      unita_carico: string | null
      serie: string | null
      cluster: string | null
      ripetizioni: string | null
      rir: string | null
      carico: string | null
      recupero_cluster: string | null
      recupero: string | null
      nota: string | null
      // La variante dell'esercizio ("con conteggio all'indietro"): senza, e'
      // l'esercizio normale e non si scrive niente.
      variante?: string | null
      // 1 = fatto a una gamba: "Squat monopodalico".
      monopodalico?: 0 | 1 | null
      // Come si fa in libreria (due / scelta / una): dove si sceglie, la scheda scrive anche «Bipodalico».
      gambe?: string | null
      // Solo per la scheda illustrata: la spiegazione dell'esercizio, il video
      // e la foto (data URL). Nella scheda normale restano a null, cosi' le
      // immagini non vengono nemmeno lette dal database.
      nota_tecnica?: string | null
      link?: string | null
      immagine?: string | null
    }[]
  }[]
}

function formatData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function infoPaziente(p: DatiPazienteExport): string[] {
  const parti: string[] = []
  // La patologia non si scrive: la scheda va al paziente.
  if (p.tipo_intervento) parti.push(`Intervento: ${p.tipo_intervento}`)
  if (p.data_intervento) parti.push(`Data intervento: ${formatData(p.data_intervento)}`)
  return parti
}

// La scheda illustrata e' pensata per il paziente che deve allenarsi da solo:
// una foto per esercizio, la spiegazione e il link al video. Le foto stanno
// tutte in riquadri della stessa misura (ritagliate al centro), altrimenti una
// verticale e una orizzontale sfalserebbero tutta la pagina.
// L'intestazione di chi firma, uguale in tutti i documenti: chi sei sopra,
// come ti si trova sotto, e una riga sottile che la stacca dal contenuto. Se
// il profilo e' vuoto non esce niente e il foglio resta come prima.
// Sul foglio che va al paziente (`schedaPaziente`) ci sono solo nome e
// qualifica. L'iscrizione all'Ordine sta in fondo a destra della riga del
// nome, se nel profilo e' acceso l'interruttore.
export function intestazioneHtml(colore: string, schedaPaziente = false): string {
  const profilo = leggiProfilo()
  const { chi, dove } = righeProfilo(profilo, schedaPaziente)
  const iscrizione = profilo.iscrizione_in_scheda === 0 ? '' : testoIscrizione(profilo.numero_iscrizione)
  if (chi === '' && dove === '' && iscrizione === '') return ''
  return `<div class="carta-intestata">
    <div class="ci-riga">
      <div class="ci-chi">${esc(chi)}</div>
      ${iscrizione ? `<div class="ci-iscrizione">${esc(iscrizione)}</div>` : ''}
    </div>
    ${dove ? `<div class="ci-dove">${esc(dove)}</div>` : ''}
  </div>
  <style>
    .carta-intestata { border-bottom: 1px solid ${colore}; padding-bottom: 5px;
                       margin-bottom: 10px; }
    .carta-intestata .ci-riga { display: flex; justify-content: space-between;
                                align-items: baseline; gap: 16px; }
    .carta-intestata .ci-chi { font-size: 12.5px; font-weight: 600; color: ${colore}; }
    .carta-intestata .ci-iscrizione { font-size: 10.5px; color: #6b7280; white-space: nowrap; }
    .carta-intestata .ci-dove { font-size: 10px; color: #6b7280; margin-top: 1px; }
  </style>`
}

// Le indicazioni per casa, in fondo al foglio: ogni quanto farlo e come
// regolarsi. Sono la parte che decide se il programma verra' fatto bene, e
// finora sul foglio non c'era.
function indicazioniHtml(p: DatiPazienteExport): string {
  const voci = p.indicazioni ?? []
  const quando = (p.frequenza_casa ?? '').trim()
  if (voci.length === 0 && quando === '') return ''
  return `<div class="per-casa">
    <div class="pc-titolo">Indicazioni</div>
    ${quando ? `<div class="pc-quando">${esc(quando)}</div>` : ''}
    ${voci.length ? `<ul>${voci.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>` : ''}
  </div>`
}

export function generaHtml(
  p: DatiPazienteExport,
  sedute: DatiSedutaExport[],
  illustrata = false
): string {
  // La stessa tabella della finestra che si mostra al paziente: quattro colonne
  // sempre nello stesso posto — cosa fare, quanto, con che carico, quanto
  // riposare. Quello che si legge a schermo e quello che si stampa sono la
  // stessa cosa, e i numeri incolonnati si ritrovano a colpo d'occhio.
  //
  // La variante sta sotto al nome: il paziente deve vedere subito se l'esercizio
  // e' quello normale (niente) o con qualcosa in piu'.
  // Un testo scritto a mano si stampa come e' stato scritto: gli a capo e i
  // rientri li tiene la pagina (white-space: pre-wrap nelle regole sotto), qui
  // basta che i ritorni a capo di Windows ("\r\n") diventino "\n".
  const comeScritto = (testo: string): string => esc(testo.replace(/\r\n?/g, '\n'))
  const variante = (e: { variante?: string | null }): string =>
    e.variante?.trim() ? `<span class="variante">${esc(e.variante.trim())}</span>` : ''
  type RigaEs = DatiSedutaExport['sezioni'][number]['esercizi'][number]

  // La dose, scritta nello stile scelto in Impostazioni > Accesso e aspetto:
  // «bolle» (frase + due bolle colorate) o «caselle» (quattro caselle bianche).
  const doseHtml = (e: RigaEs, stile: StileScheda): string => {
    if (stile === 'caselle') {
      const c = caselleDose(e)
      const caselle: [string, string | null][] = [
        ['Serie', c.serie],
        ['Rip.', c.rip],
        ['Carico', c.carico],
        ['Recupero', c.recupero]
      ]
      return `<div class="caselle-scheda">${caselle
        .map(
          ([et, v]) =>
            `<div class="casella${v ? '' : ' vuota'}"><small>${et}</small><b>${v ? esc(v) : '–'}</b></div>`
        )
        .join('')}</div>`
    }
    const frase = fraseDose(e)
    const carico = intensitaTesto(e)
    const recupero = recuperoTesto(e)
    return `${
      frase
        ? `<div class="frase-scheda"><span class="lunga">${frase.lunga
            .map((x) => (x.forte ? `<b>${esc(x.testo)}</b>` : esc(x.testo)))
            .join('')}</span><span class="corta"><b>${esc(frase.corta)}</b></span></div>`
        : ''
    }${
      carico || recupero
        ? `<div class="bolle-scheda">${
            carico ? `<span class="bolla carico"><small>carico</small><b>${esc(carico)}</b></span>` : ''
          }${
            recupero
              ? `<span class="bolla recupero"><small>recupero</small><b>${esc(recupero)}</b></span>`
              : ''
          }</div>`
        : ''
    }`
  }

  // Il nome con le gambe (mono/bipodalico) e la variante accanto, sulla stessa riga.
  const titolo = (e: RigaEs): string => {
    const gambe = gambeTesto(e)
    const v = e.variante?.trim()
    return `<div class="titolo-es"><span class="nome">${esc(e.nome)}</span>${
      gambe
        ? `<span class="gambe-es"><span class="pieno">${gambe.pieno}</span><span class="ab">${gambe.corto}</span></span>`
        : ''
    }${v ? `<span class="variante-es">${esc(v)}</span>` : ''}</div>`
  }

  // Una carta per esercizio, come nella finestra e tutta su una riga: il nome con
  // le gambe e la variante accanto, la dose nello stile scelto per la scheda senza
  // immagini. Sotto al nome c'e' solo la nota, quando c'e'. Dove un dato manca non
  // si scrive niente.
  const carte = (esercizi: RigaEs[]): string =>
    esercizi
      .map(
        (e) => `<div class="esercizio-scheda">
          <div class="testa-es">${titolo(e)}${
            e.nota ? `<span class="nota-es">${comeScritto(e.nota)}</span>` : ''
          }</div>
          ${doseHtml(e, stileScheda('senza'))}
        </div>`
      )
      .join('')

  // La scheda con le immagini e' la stessa carta con la foto a sinistra: nome e
  // dose sulla prima riga, sotto la spiegazione, la nota e il video. La dose segue
  // lo stile scelto per la scheda con immagini.
  const schede = (esercizi: RigaEs[]): string => {
    // Il riquadro della foto si tiene anche dove la foto manca, cosi' le righe
    // restano allineate. Ma se in tutta la sezione non ce n'e' nessuna, sarebbe
    // solo una colonna di rettangoli grigi: allora si toglie.
    const conFoto = esercizi.some((e) => e.immagine)
    const stile = stileScheda('con')
    return esercizi
      .map(
        (e) => `<div class="scheda-es esercizio-scheda con-foto">
          ${
            conFoto
              ? `<div class="foto">${e.immagine ? `<img src="${esc(e.immagine)}" alt="">` : ''}</div>`
              : ''
          }
          <div class="corpo-es">
            <div class="riga-es"><div class="testa-es">${titolo(e)}</div>${doseHtml(e, stile)}</div>
            ${e.nota_tecnica ? `<div class="come">${comeScritto(e.nota_tecnica)}</div>` : ''}
            ${e.nota ? `<div class="nota-es">${comeScritto(e.nota)}</div>` : ''}
            ${e.link && LINK_WEB.test(e.link) ? `<a class="video" href="${esc(e.link)}">Guarda il video</a>` : ''}
          </div>
        </div>`
      )
      .join('')
  }

  const sedHtml = sedute
    .map((s, i) => {
      return `
    <section class="seduta${i > 0 ? ' nuova-pagina' : ''}">
      <h2>Seduta del ${formatData(s.data)}</h2>
      ${s.sezioni
        .map(
          (sez, k) => `
      <div class="sezione-scheda colore-${coloreSezione(sez.nome ?? '', k)}">
      ${sez.nome ? `<h3><span class="fascetta">${esc(sez.nome)}</span></h3>` : ''}
      ${illustrata ? schede(sez.esercizi) : carte(sez.esercizi)}
      </div>`
        )
        .join('')}
      ${s.note ? `<p class="note"><strong>Note della seduta:</strong><br>${comeScritto(s.note)}</p>` : ''}
    </section>`
    })
    .join('')

  const { accento, intestazione } = coloriTema()

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2733; font-size: 12px; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .info { color: #555b66; margin: 0 0 6px; font-size: 11px; }
  h2 { font-size: 15px; border-bottom: 2px solid ${accento}; padding-bottom: 4px; margin: 18px 0 8px; }
  h2 .fase { color: ${accento}; font-weight: 600; }
  /* Un titolo non resta mai da solo in fondo a una pagina con quello che
     descrive sulla successiva: e' il caso del nome della sezione (es.
     "Attivazione muscolare cervicale") separato dai suoi esercizi. */
  h2, h3 { break-after: avoid; page-break-after: avoid; }
  h3 { font-size: 13px; margin: 16px 0 7px; color: ${accento}; }
  /* La fascetta della sezione, come nella finestra che si mostra al paziente:
     tenue, non un blocco di colore. Sulla carta il beige pieno pesava. */
  h3 .fascetta { display: inline-block;
                 background: color-mix(in srgb, ${intestazione} 55%, #fff);
                 color: ${accento}; border-radius: 999px; padding: 3px 11px;
                 font-size: 10.5px; font-weight: 600;
                 text-transform: uppercase; letter-spacing: 0.05em; }
  .nuova-pagina { page-break-before: always; }
  /* In stampa un grafico, una riga di grafici o una nota non si spezzano fra due
     pagine: passano intere alla successiva. I titoli restano con quello che segue. */
  figure, svg, .coppia-pedana, .sezione-pedana, .confronto-lati, .valori-riga, .riassunto-pedana li,
  .andamento-pedana { break-inside: avoid; page-break-inside: avoid; }
  h4 { break-after: avoid; page-break-after: avoid; }
  .gruppo-esercizi { margin: 0 0 8px; page-break-inside: avoid; }
  .gruppo-esercizi .cat { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
                          color: ${accento}; margin-bottom: 2px; }
  /* Ogni sezione e' un riquadro del suo colore (riscaldamento ambra, pliometria
     blu, forza verde...) con dentro una carta bianca per esercizio: la stessa
     scheda che il paziente vede a schermo. */
  .sezione-scheda { container-type: inline-size; --c: ${accento}; margin: 0 0 12px; padding: 9px 10px 2px; border-radius: 10px;
                    background: color-mix(in srgb, var(--c) 12%, #fff);
                    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sezione-scheda.colore-ambra { --c: #b7791f; }
  .sezione-scheda.colore-blu { --c: #2f6690; }
  .sezione-scheda.colore-viola { --c: #7a5a9a; }
  .sezione-scheda h3 { margin: 0 0 7px; font-size: 11px; text-transform: uppercase;
                       letter-spacing: 0.06em; color: var(--c); }
  .sezione-scheda h3 .fascetta { background: none; padding: 0; border-radius: 0;
                                 color: var(--c); font-weight: 700; font-size: 11px; }
  .sezione-scheda h3 .fascetta::before { content: ''; display: inline-block; width: 8px; height: 8px;
                                         border-radius: 2px; background: var(--c); margin-right: 6px; }
  .esercizio-scheda { display: flex; align-items: center; gap: 10px; background: #fff;
                      border-radius: 7px; padding: 8px 11px; margin-bottom: 6px;
                      break-inside: avoid; page-break-inside: avoid; }
  .esercizio-scheda .testa-es { flex: 1 1 0; min-width: 0; }
  .esercizio-scheda .titolo-es { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .esercizio-scheda .nome { flex: 0 1 auto; min-width: 4ch; font-weight: 600; font-size: 12.5px;
                            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .esercizio-scheda .gambe-es { flex: none; font-size: 10.5px; font-weight: 700; color: #8a4fa0;
                                white-space: nowrap; }
  .esercizio-scheda .gambe-es .ab { display: none; }
  .esercizio-scheda .variante-es { flex: 0 8 auto; min-width: 8ch; font-size: 10.5px; font-weight: 700;
                                   color: #c0502f; overflow: hidden; text-overflow: ellipsis;
                                   white-space: nowrap; }
  .esercizio-scheda .nota-es { display: block; margin-top: 2px; color: #555b66;
                               font-size: 11px; font-style: italic; white-space: pre-wrap; }
  .esercizio-scheda .frase-scheda { flex: none; font-size: 11.5px; white-space: nowrap; text-align: right; }
  .esercizio-scheda .frase-scheda b { color: var(--c); font-size: 13.5px; font-weight: 700; }
  .esercizio-scheda .frase-scheda .corta { display: none; }
  .bolle-scheda { flex: none; display: flex; gap: 5px; }
  .bolla { display: inline-flex; align-items: baseline; gap: 4px; padding: 3px 9px; border-radius: 999px;
           font-size: 11px; white-space: nowrap;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bolla small { font-size: 10px; opacity: 0.8; }
  .bolla b { font-size: 11.5px; font-weight: 700; }
  .bolla.carico { background: #e1ecf7; color: #2f6a9a; }
  .bolla.recupero { background: #f6e8c8; color: #8a5f12; }
  .caselle-scheda { flex: none; display: flex; gap: 4px; }
  .casella { min-width: 44px; padding: 3px 6px; text-align: center; background: #fff;
             border: 1px solid #d5dae1; border-radius: 6px; }
  .casella small { display: block; font-size: 8px; letter-spacing: 0.05em; text-transform: uppercase;
                   color: #6b7280; }
  .casella b { display: block; font-size: 12.5px; font-weight: 700; white-space: nowrap; color: var(--c); }
  .casella.vuota b { color: #c4c8ce; font-weight: 400; }
  @container (max-width: 520px) {
    .esercizio-scheda .gambe-es .pieno { display: none; }
    .esercizio-scheda .gambe-es .ab { display: inline; }
    .esercizio-scheda .variante-es { max-width: 16ch; }
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccd2da; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: ${intestazione}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  tr { page-break-inside: avoid; }
  .cat { color: #777e88; font-size: 10px; }
  /* Le note si scrivono come le ha scritte il fisioterapista: a capo e spazi restano. */
  .note { margin: 10px 0 0; background: #f5f6f8; padding: 8px 10px; border-radius: 4px;
          white-space: pre-wrap; }
  /* Scheda con le immagini: la stessa carta della scheda normale, con la foto a
     sinistra. Il riquadro e' sempre della stessa misura, cosi' le righe non si
     sfalsano, ma la foto ci sta dentro intera (ritagliata perdeva pezzi di
     esercizio). Ogni esercizio e' un blocco che non si spezza fra due pagine. */
  .esercizio-scheda.con-foto { align-items: flex-start; gap: 12px; }
  .con-foto .foto { flex: none; width: 110px; height: 110px; background: #fff; border-radius: 6px;
                    overflow: hidden; }
  .con-foto .foto img { width: 110px; height: 110px; object-fit: contain; display: block; }
  .con-foto .corpo-es { flex: 1 1 0; min-width: 0; }
  .con-foto .riga-es { display: flex; align-items: center; gap: 10px; }
  /* La spiegazione e la nota si leggono come le ha scritte il fisioterapista:
     a capo, righe vuote e rientri restano. */
  .scheda-es .come { color: #555b66; margin-top: 5px; font-size: 11.5px; white-space: pre-wrap; }
  .scheda-es .nota-es { color: #555b66; margin-top: 4px; font-style: italic; white-space: pre-wrap; }
  .scheda-es .video { display: inline-block; margin-top: 6px; color: ${accento}; font-weight: 600; }
  /* Le indicazioni per casa: un riquadro chiaro in fondo, staccato dal
     programma ma sullo stesso foglio. */
  .per-casa { margin-top: 16px; padding: 9px 12px; border: 1px solid #dfe4ea;
              border-radius: 5px; page-break-inside: avoid; }
  .per-casa .pc-titolo { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
                         color: ${accento}; font-weight: 600; }
  .per-casa .pc-quando { font-size: 13px; font-weight: 600; margin-top: 2px; }
  .per-casa ul { margin: 5px 0 0; padding-left: 16px; }
  .per-casa li { margin-bottom: 2px; }
</style>
</head>
<body>
  ${intestazioneHtml(accento, illustrata)}
  <h1>${esc(p.cognome)} ${esc(p.nome)}</h1>
  <p class="info">${infoPaziente(p).map(esc).join(' &nbsp;·&nbsp; ')}</p>
  ${sedHtml}
  ${indicazioniHtml(p)}
</body>
</html>`
}

export async function generaDocx(
  p: DatiPazienteExport,
  sedute: DatiSedutaExport[]
): Promise<Buffer> {
  const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } =
    await import('docx')
  const children: (ParagrafoWord | TabellaWord)[] = []

  // Un testo scritto a mano con i suoi a capo: in Word un "\n" dentro un testo
  // non basta, serve un'interruzione di riga a ogni riga.
  const conACapo = (testo: string): InstanceType<typeof TextRun>[] =>
    testo
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((riga, i) => new TextRun({ text: riga, break: i > 0 ? 1 : 0 }))

  // Anche il documento Word esce con l'intestazione di chi firma: chi lo
  // riceve deve sapere da chi arriva, in qualunque formato.
  const { chi, dove } = righeProfilo()
  if (chi !== '') {
    children.push(new Paragraph({ children: [new TextRun({ text: chi, bold: true })] }))
  }
  if (dove !== '') {
    children.push(
      new Paragraph({ children: [new TextRun({ text: dove, size: 16, color: '6B7280' })] })
    )
  }

  children.push(
    new Paragraph({ text: `${p.cognome} ${p.nome}`, heading: HeadingLevel.TITLE })
  )
  const info = infoPaziente(p)
  if (info.length > 0) {
    children.push(new Paragraph({ text: info.join('  ·  '), spacing: { after: 200 } }))
  }

  sedute.forEach((s, i) => {
    children.push(
      new Paragraph({
        text: `Seduta del ${formatData(s.data)}`,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: i > 0
      })
    )
    for (const sez of s.sezioni) {
      if (sez.nome) {
        children.push(
          new Paragraph({
            text: sez.nome,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        )
      }
      const intestazione = new TableRow({
        children: ['Esercizio', 'Serie', 'Ripetizioni', 'Carico', 'Recupero', 'Note'].map(
          (t) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })]
            })
        )
      })
      const righe = sez.esercizi.map(
        (e) =>
          new TableRow({
            children: [
              nomeConVariante(nomeConMonopodalico(e.nome, e.monopodalico), e.variante),
              e.serie ?? '',
              // A cluster: "3 × 2" sono i cluster per le ripetizioni di ognuno.
              ripetizioniTesto(e) ?? '',
              caricoTesto(e.carico, e.unita_carico) ?? '',
              recuperoTesto(e) ?? '',
              e.nota ?? ''
            ].map((t) => new TableCell({ children: [new Paragraph({ children: conACapo(t) })] }))
          })
      )
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [2800, 800, 1200, 1300, 1200, 2200],
          rows: [intestazione, ...righe]
        })
      )
    }

    if (s.note) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Note della seduta:', bold: true }),
            // le note partono sulla riga sotto l'etichetta
            new TextRun({ text: '', break: 1 }),
            ...conACapo(s.note)
          ],
          spacing: { before: 200 }
        })
      )
    }
  })

  // Le indicazioni per casa anche nel Word, in fondo come sul foglio.
  const perCasa = p.indicazioni ?? []
  const quandoCasa = (p.frequenza_casa ?? '').trim()
  if (perCasa.length > 0 || quandoCasa !== '') {
    children.push(
      new Paragraph({
        text: 'Indicazioni',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300 }
      })
    )
    if (quandoCasa !== '') {
      children.push(new Paragraph({ children: [new TextRun({ text: quandoCasa, bold: true })] }))
    }
    for (const v of perCasa) children.push(new Paragraph({ text: v, bullet: { level: 0 } }))
  }

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}
