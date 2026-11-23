// La seduta stampata: PDF (HTML) e Word.
import { test } from 'vitest'
import { pazExport, seduteExport } from './fixture-seduta'
import assert from 'node:assert/strict'
import { generaDocx, generaHtml } from '../src/main/export-doc'

test('La scheda della seduta: tabella, dosaggi, escaping', () => {
  const html = generaHtml(pazExport, seduteExport)
  assert.ok(html.includes('Rossi') && html.includes('Seduta del 10/08/2026'))
  assert.ok(html.includes('Mobilizzazione &amp; scivolamenti rotulei')) // escaping HTML
  // La seduta si stampa con la stessa tabella della finestra che si mostra al
  // paziente: fascetta della sezione, e carte con la dose in grande.
  assert.ok(html.includes('Riscaldamento'))
  assert.ok(html.includes('class="fascetta"'), 'fascetta della sezione')
  assert.ok(html.includes('esercizio-scheda'), 'carte come quelle a schermo')
  assert.ok(html.includes('<small>recupero</small>'), 'recupero in una bolla')
  // nella sua colonna il recupero si scrive corto: "rec." lo dice gia'
  // l'intestazione
  assert.ok(html.includes('1 min'))
  assert.ok(!html.includes('rec. 1 min'), 'nella tabella il recupero non ripete rec.')
  assert.ok(html.includes('3 × 10'))
  // il RIR sta nella colonna del carico, accanto ai chili
  assert.ok(html.includes('60 kg · RIR 2'), 'carico e RIR nella stessa colonna')
  // il cluster: 4 x (3 x 2), e i due recuperi separati dalla barra
  assert.ok(html.includes('4 × (3 × 2)'), 'volume a cluster')
  // (le virgolette nel testo si scrivono &quot;: sullo schermo e' lo stesso segno)
  assert.ok(html.includes(`15&quot; / 2'`), 'recuperi a cluster nella colonna')
  // La scheda normale non porta mai foto, spiegazioni o link, anche se
  // l'esercizio li ha: e' quella corta per chi sa gia' cosa fare.
  assert.ok(!html.includes('<div class="scheda-es">'))
})

// L'esercizio con una variante: il paziente deve vedere se e' normale o con
// qualcosa in piu', e per quello normale non si scrive niente.
test("La variante dell'esercizio si legge sulla scheda, e l'esercizio normale non ne ha", async () => {
  const [prima, ...altri] = seduteExport[0].sezioni[0].esercizi
  const sedute = [
    {
      ...seduteExport[0],
      sezioni: [{ nome: 'Equilibrio', esercizi: [{ ...prima, variante: 'con luci <reattive>' }, ...altri] }]
    }
  ]
  const html = generaHtml(pazExport, sedute)
  assert.ok(html.includes('<span class="variante-es">con luci &lt;reattive&gt;</span>'), 'la variante sta accanto al nome')
  assert.equal(html.split('<span class="variante-es">').length - 1, 1, 'solo l\'esercizio che ce l\'ha')
  assert.ok(!generaHtml(pazExport, seduteExport).includes('<span class="variante-es">'), 'nessuna se non c\'e\'')
  // anche nella scheda illustrata
  assert.ok(generaHtml(pazExport, sedute, true).includes('<span class="variante-es">con luci'))
  // e nel Word
  const docx = await generaDocx(pazExport, sedute)
  assert.ok(docx.length > 1000)
})

// L'esercizio fatto a una gamba si legge accanto al nome: "Squat monopodalico",
// in PDF, scheda illustrata e Word.
test('Il monopodalico si legge accanto al nome, solo dove e\' segnato', async () => {
  const [prima, ...altri] = seduteExport[0].sezioni[0].esercizi
  const sedute = [
    {
      ...seduteExport[0],
      sezioni: [{ nome: 'Forza', esercizi: [{ ...prima, nome: 'Squat', monopodalico: 1 as const }, ...altri] }]
    }
  ]
  // accanto al nome, in un colore suo, abbreviabile
  assert.ok(generaHtml(pazExport, sedute).includes('<span class="nome">Squat</span><span class="gambe-es"><span class="pieno">Monopodalico</span><span class="ab">Mono</span></span>'))
  assert.equal(generaHtml(pazExport, sedute).split('class="gambe-es"').length - 1, 1, 'solo l\'esercizio segnato')
  assert.ok(generaHtml(pazExport, sedute, true).includes('<span class="nome">Squat</span><span class="gambe-es">'))
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await generaDocx(pazExport, sedute))
  assert.ok((await zip.file('word/document.xml')!.async('string')).includes('Squat monopodalico'))
})

// A due gambe sulla scheda non si scrive niente, nemmeno "bipodalico".
test('A due gambe sulla scheda non si scrive niente', () => {
  const [prima, ...altri] = seduteExport[0].sezioni[0].esercizi
  const sedute = [
    {
      ...seduteExport[0],
      sezioni: [{ nome: 'Forza', esercizi: [{ ...prima, nome: 'Squat', monopodalico: 0 as const }, ...altri] }]
    }
  ]
  const html = generaHtml(pazExport, sedute)
  assert.ok(html.includes('<span class="nome">Squat</span>'))
  assert.ok(!html.includes('podalico'))
})

// La scheda illustrata, da consegnare a chi si allena da solo: foto, come si
// esegue e il link al video, che nel PDF resta cliccabile.
const conFoto = [
  {
    ...seduteExport[0],
    sezioni: [
      {
        nome: 'A casa',
        esercizi: [
          {
            ...seduteExport[0].sezioni[0].esercizi[0],
            nota_tecnica: 'Scendi lentamente, senza inarcare la schiena.',
            link: 'https://www.youtube.com/watch?v=abc',
            immagine: 'data:image/png;base64,iVBORw0KGgo='
          },
          { ...seduteExport[0].sezioni[0].esercizi[0], nome: 'Senza foto' }
        ]
      }
    ]
  }
]

test('La scheda illustrata: foto, come si esegue, link', () => {
  const illustrata = generaHtml(pazExport, conFoto, true)
  assert.ok(illustrata.includes('data:image/png;base64,iVBORw0KGgo='))
  assert.ok(illustrata.includes('Scendi lentamente'))
  // la dose si legge come nella scheda senza immagini: frase e bolle
  assert.ok(illustrata.includes('class="frase-scheda"'), 'dose a frase')
  assert.ok(illustrata.includes('<small>recupero</small>'), 'recupero in una bolla')
  assert.ok(illustrata.includes('1 min'), 'il valore del recupero')
  assert.ok(illustrata.includes('href="https://www.youtube.com/watch?v=abc"'))
  // il riquadro della foto resta anche dove la foto manca: i cartelli della
  // stessa riga devono restare allineati
  assert.equal(illustrata.split('<div class="foto">').length - 1, 2)
  // ma se nella sezione non c'e' nessuna foto, i riquadri vuoti spariscono
  const senzaFoto = generaHtml(pazExport, [seduteExport[0]], true)
  assert.ok(
    senzaFoto.includes('class="scheda-es esercizio-scheda con-foto"') && !senzaFoto.includes('<div class="foto">')
  )
})

// un link che non e' web (javascript:, file:) non diventa cliccabile, e le
// virgolette dentro un attributo non lo chiudono prima del tempo
test('Un link che non e\' web non diventa cliccabile', () => {
  const es0 = conFoto[0].sezioni[0].esercizi[0]
  const cattivi = generaHtml(
    pazExport,
    [
      {
        ...conFoto[0],
        sezioni: [
          {
            nome: 'A casa',
            esercizi: [
              { ...es0, link: 'javascript:alert(1)' },
              { ...es0, nome: 'Squat', link: 'https://a.it/x"onmouseover="alert(1)' },
              { ...es0, nome: 'Foto', immagine: 'x" onerror="alert(1)' }
            ]
          }
        ]
      }
    ],
    true
  )
  assert.ok(!cattivi.includes('href="javascript'), 'un link javascript non e\' cliccabile')
  assert.ok(!cattivi.includes('"onmouseover="'), 'le virgolette non chiudono l\'attributo')
  assert.ok(!cattivi.includes('" onerror="'), 'nemmeno nell\'immagine')
  assert.ok(cattivi.includes('x&quot;onmouseover=&quot;'), 'le virgolette del link diventano testo')
  assert.ok(cattivi.includes('x&quot; onerror=&quot;'), 'e quelle dell\'immagine')
})

test('Il Word della seduta e\' un file vero', async () => {
  const docxBuf = await generaDocx(pazExport, seduteExport)
  assert.ok(docxBuf.length > 1000 && docxBuf[0] === 0x50 && docxBuf[1] === 0x4b) // magic 'PK' (zip)
})

// Le note in fondo restano come le ha scritte chi le ha scritte: a capo e spazi
// non si perdono ne' nel PDF ne' nel Word.
// Lo stesso vale per la spiegazione dell'esercizio e per la nota sulla sua riga,
// anche nella scheda illustrata: a capo, righe vuote e rientri restano.
test('Spiegazione e nota dell\'esercizio mantengono gli a capo, nel PDF e nel Word', async () => {
  const es = {
    ...seduteExport[0].sezioni[0].esercizi[0],
    nota: 'Prima\nSeconda',
    nota_tecnica: 'Passo 1\r\n\r\n   - rientrato\nPasso 3',
    immagine: null,
    link: null
  }
  const sedute = [{ ...seduteExport[0], sezioni: [{ nome: 'A casa', esercizi: [es] }] }]
  const illustrata = generaHtml(pazExport, sedute, true)
  assert.ok(illustrata.includes('>Passo 1\n\n   - rientrato\nPasso 3<'), 'la spiegazione arriva com\'e\'')
  assert.ok(!illustrata.includes('\r'), 'senza ritorni a capo di Windows')
  assert.match(illustrata, /\.scheda-es \.come \{[^}]*white-space: pre-wrap/)
  assert.match(illustrata, /\.scheda-es \.nota-es \{[^}]*white-space: pre-wrap/)
  assert.ok(illustrata.includes('>Prima\nSeconda<'))
  // anche nella tabella della scheda normale
  const tabella = generaHtml(pazExport, sedute)
  assert.ok(tabella.includes('>Prima\nSeconda<'))
  assert.match(tabella, /\.esercizio-scheda \.nota-es \{[^}]*white-space: pre-wrap/)

  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await generaDocx(pazExport, sedute))
  const xml = await zip.file('word/document.xml')!.async('string')
  assert.equal(xml.split('<w:br/>').length - 1, 2, 'a capo della nota in tabella, più quello sotto "Note della seduta:"')
})

test('Le note della seduta mantengono gli a capo, nel PDF e nel Word', async () => {
  const sedute = [{ ...seduteExport[0], note: 'Prima riga\n\n   Terza riga rientrata' }]
  const html = generaHtml(pazExport, sedute)
  assert.ok(html.includes('Prima riga\n\n   Terza riga rientrata'), 'il testo arriva con gli a capo')
  assert.match(html, /\.note \{[^}]*white-space: pre-wrap/, 'e la pagina li rispetta')

  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await generaDocx(pazExport, sedute))
  const xml = await zip.file('word/document.xml')!.async('string')
  assert.equal(xml.split('<w:br/>').length - 1, 3, 'una dopo l etichetta e due fra le righe')
  assert.ok(xml.includes('xml:space="preserve">   Terza riga rientrata'), 'gli spazi restano')
})

// «Bipodalico» si scrive solo dove l'esercizio si fa in tutti e due i modi e si e'
// scelto a due gambe; un esercizio sempre a due gambe, o sempre a una, non scrive niente.
test('Il bipodalico compare solo sugli esercizi a scelta', () => {
  const [prima, ...altri] = seduteExport[0].sezioni[0].esercizi
  const con = (gambe: string | null) => [
    { ...seduteExport[0], sezioni: [{ nome: 'Forza', esercizi: [{ ...prima, nome: 'Squat', monopodalico: 0 as const, gambe }, ...altri] }] }
  ]
  assert.ok(generaHtml(pazExport, con('scelta')).includes('<span class="pieno">Bipodalico</span>'))
  assert.ok(!generaHtml(pazExport, con('due')).includes('podalico'))
  assert.ok(!generaHtml(pazExport, con('una')).includes('podalico'))
  assert.ok(!generaHtml(pazExport, con(null)).includes('podalico'))
})

// La dose come frase: «3 serie da 5 rip.», senza «rip.» dopo un tempo.
test('La dose si scrive come frase', async () => {
  const { fraseDose } = await import('../src/shared/scheda-riga')
  const lunga = (d: object): string => fraseDose(d)!.lunga.map((x) => x.testo).join('')
  assert.equal(lunga({ serie: '3', ripetizioni: '5' }), '3 serie da 5 rip.')
  assert.equal(lunga({ serie: '5', ripetizioni: '30-40"' }), '5 serie da 30-40"')
  assert.equal(lunga({ serie: '3' }), '3 serie')
  assert.equal(lunga({ ripetizioni: "5-10'" }), "5-10'")
  assert.equal(lunga({ ripetizioni: '8' }), '8 rip.')
  assert.equal(lunga({ serie: '4', cluster: '3', ripetizioni: '2' }), '4 × (3 × 2)')
  assert.equal(fraseDose({ serie: '3', ripetizioni: '5' })!.corta, '3 × 5')
  assert.equal(fraseDose({}), null)
})

// Lo stile della dose (bolle colorate o caselle bianche) si sceglie a parte per la
// scheda senza immagini e per quella con le immagini.
test('Lo stile della dose e\' indipendente fra scheda senza e con immagini', async () => {
  const { impostaStileCorrente } = await import('../src/shared/stile-scheda')
  try {
    impostaStileCorrente('senza', 'caselle')
    impostaStileCorrente('con', 'bolle')
    const senza = generaHtml(pazExport, conFoto)
    assert.ok(senza.includes('class="caselle-scheda"') && !senza.includes('class="frase-scheda"'))
    assert.ok(senza.includes('<small>Serie</small>') && senza.includes('<small>Recupero</small>'))
    const con = generaHtml(pazExport, conFoto, true)
    assert.ok(con.includes('class="frase-scheda"') && !con.includes('class="caselle-scheda"'))
    impostaStileCorrente('senza', 'bolle')
    impostaStileCorrente('con', 'caselle')
    assert.ok(generaHtml(pazExport, conFoto).includes('class="frase-scheda"'))
    assert.ok(generaHtml(pazExport, conFoto, true).includes('class="caselle-scheda"'))
    // un valore sconosciuto torna alle bolle
    impostaStileCorrente('con', 'altro')
    assert.ok(generaHtml(pazExport, conFoto, true).includes('class="frase-scheda"'))
  } finally {
    impostaStileCorrente('senza', 'bolle')
    impostaStileCorrente('con', 'bolle')
  }
})

test('Le caselle della dose: serie, rip., carico e recupero, con il vuoto dove manca', async () => {
  const { caselleDose } = await import('../src/shared/scheda-riga')
  assert.deepEqual(caselleDose({ serie: '3', ripetizioni: '5', carico: '20', unita_carico: 'kg', recupero: '90"' }), {
    serie: '3',
    rip: '5',
    carico: '20 kg',
    recupero: '90"'
  })
  assert.deepEqual(caselleDose({ serie: '3' }), { serie: '3', rip: null, carico: null, recupero: null })
  assert.equal(caselleDose({ serie: '4', cluster: '3', ripetizioni: '2' }).rip, '3 × 2')
})
