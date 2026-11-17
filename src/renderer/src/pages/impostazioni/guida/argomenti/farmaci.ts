import type { ArgomentoGuida } from '../modello'

export const farmaci: ArgomentoGuida = {
  id: 'farmaci',
  titolo: 'Farmaci',
  breve: 'Sottolineatura nell’anamnesi, schede di riferimento, elenco AIFA',
  parole: [
    'medicinali',
    'principio attivo',
    'nome commerciale',
    'aifa',
    'liste di trasparenza',
    'bolla',
    'sottolineato',
    'etichette',
    'bozza',
    'validata',
    'anamnesi'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'È uno strumento di **consultazione**: riconosce i nomi dei farmaci che scrivi e ti fa vedere subito cosa sono. Non dice cosa fare e non decide se il paziente li prende davvero. Le schede sono separate dai dati dei pazienti.'
      ]
    },
    {
      titolo: 'Nell’anamnesi prossima',
      elementi: [
        'Nella **Storia precedente** i nomi di farmaci (commerciali o principi attivi) compaiono con una sottolineatura sottile. Il testo salvato resta testo semplice: la sottolineatura si vede solo a video.',
        'Passando il cursore su un nome compare una bolla con principio attivo, classe, a cosa serve, informazioni per la fisioterapia e avvertenze. Con un clic si apre la scheda completa.',
        'Il riconoscimento è solo un suggerimento: «non prende Brufen» si sottolinea lo stesso. Non fa niente se lo ignori.'
      ]
    },
    {
      titolo: 'Nell’anamnesi remota',
      elementi: [
        'Sotto **Altre patologie e farmaci** c’è **+ Farmaci**: una lista discreta, che resta chiusa se il paziente non prende niente.',
        {
          punti: [
            '**Aggiungi un farmaco**: scrivi il nome e scegli dall’elenco che compare, o premi Invio per scriverlo com’è.',
            '**Aggiungi i farmaci riconosciuti in anamnesi prossima**: ti propone quelli già scritti nella storia precedente, con la frase accanto. Spunti tu quali aggiungere.',
            'L’icona della **nota** serve se il paziente ti riferisce una dose. Non ci sono campi per dosaggio, durata o motivo.',
            'Un nome tratteggiato è un nome che l’app non conosce: con un clic lo colleghi a un principio attivo o crei la scheda. Il testo resta com’è.'
          ]
        },
        'Nelle stampe e negli export compaiono solo i nomi, come li hai scritti. Informazioni, avvertenze, etichette e note non si stampano mai.'
      ]
    },
    {
      titolo: 'Le schede',
      elementi: [
        'Si trovano in [[Configurazione > Farmaci]], divise per **categoria** (FANS, Oppioidi, Anticoagulanti…): un clic su una categoria apre le sue schede, con **Categorie** si torna indietro. La barra di ricerca c’è sempre e cerca in tutte le categorie, anche per classe. C’è una scheda per principio attivo, con classe, a cosa serve, informazioni per la fisioterapia, avvertenze, **livello di attenzione** (nessuno, da tenere presente, alta), etichette, fonte e data dell’ultima revisione.',
        'Quelle iniziali sono **bozze da verificare** e lo dicono bene in vista, anche nella bolla. Quando le hai controllate, nella scheda scegli **Validata da me**.',
        'Le **etichette** si cambiano in [[Configurazione > Farmaci > Etichette]]. Livello ed etichette sono dati strutturati, pensati per evidenziare in seguito le informazioni importanti.',
        'Un nome commerciale con più principi attivi (associazioni) mostra una scheda per ciascuno.'
      ]
    },
    {
      titolo: 'L’elenco dei nomi commerciali (AIFA)',
      elementi: [
        {
          passi: [
            'Scarica il CSV «Lista farmaci equivalenti» dalla pagina **Liste di trasparenza** di AIFA (aifa.gov.it). L’elenco è aggiornato ogni mese.',
            'Apri [[Configurazione > Farmaci]] e premi **Importa elenco**.',
            'Scegli il file scaricato.'
          ]
        },
        'Il programma non scarica niente da solo. Un nuovo elenco si **aggiunge** al database: le tue schede e i tuoi collegamenti non si toccano. L’elenco è legato ai prezzi di riferimento, quindi non contiene tutti i farmaci: per gli altri usa i collegamenti.'
      ]
    },
    {
      titolo: 'Un nome che l’app non conosce',
      elementi: [
        'Resta testo libero e non ti blocca. Per insegnarglielo: in [[Configurazione > Farmaci > Nomi collegati a mano]] scrivi «Enantyum = Dexketoprofene», oppure dalla lista del paziente clicca il nome tratteggiato. Un collegamento a mano ha la precedenza sull’elenco AIFA.',
        'Le **Parole da ignorare** sono nomi che coincidono con parole comuni («ferro», «target»…): non si sottolineano mai.'
      ]
    }
  ]
}
