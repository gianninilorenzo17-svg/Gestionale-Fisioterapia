// Le schede dei farmaci con cui parte il database: la prima tranche, tutte «bozza
// da verificare». Sono informazioni di riferimento per chi lavora in
// fisioterapia, non indicazioni: dove non c'e' certezza il campo e' vuoto.
//
// Le schede sono per principio attivo ma dicono quasi tutte la stessa cosa
// dentro una classe: il testo della classe sta una volta sola qui sotto, e ogni
// principio attivo ci aggiunge, se serve, solo la sua parte.
import type { LivelloAttenzione } from '../shared/farmaci'

export const ETICHETTE_INIZIALI = [
  'Rischio tendineo/muscolare',
  'Rischio emorragico',
  'Può mascherare dolore/sintomi',
  'Risposta cardiovascolare all’esercizio',
  'Equilibrio/sedazione/cadute',
  'Osso/densità ossea'
] as const

const TENDINE = ETICHETTE_INIZIALI[0]
const EMORRAGICO = ETICHETTE_INIZIALI[1]
const MASCHERA = ETICHETTE_INIZIALI[2]
const CUORE = ETICHETTE_INIZIALI[3]
const EQUILIBRIO = ETICHETTE_INIZIALI[4]
const OSSO = ETICHETTE_INIZIALI[5]

export const FONTE_BOZZA =
  'Bozza da conoscenze generali (RCP e fogli illustrativi AIFA/EMA): da verificare'

export interface SchedaIniziale {
  principio_attivo: string
  classe: string
  usi: string
  info_fisio: string
  avvertenze: string
  livello: LivelloAttenzione
  etichette: string[]
}

interface Classe {
  classe: string
  usi: string
  info_fisio: string
  avvertenze: string
  livello: LivelloAttenzione
  etichette: string[]
}

// Il principio attivo e, se serve, le righe che cambiano rispetto alla classe.
type Voce = [nome: string, cambia?: Partial<Classe>]

function dalla(classe: Classe, voci: Voce[]): SchedaIniziale[] {
  return voci.map(([nome, cambia]) => ({ principio_attivo: nome, ...classe, ...cambia }))
}

const FANS: Classe = {
  classe: 'FANS',
  usi: 'Dolore e infiammazione muscolo-scheletrica, febbre.',
  info_fisio:
    'Riducono dolore e infiammazione: il dolore riferito può essere più basso di quello reale.',
  avvertenze:
    'Possibili effetti su stomaco, reni e pressione. Aumentano la tendenza al sanguinamento se associati a anticoagulanti o antiaggreganti.',
  livello: 1,
  etichette: [MASCHERA, EMORRAGICO]
}

const CORTISONICI: Classe = {
  classe: 'Corticosteroide',
  usi: 'Infiammazioni, allergie, asma, malattie autoimmuni.',
  info_fisio:
    'Con dosi alte o cicli prolungati possono indebolire muscoli (miopatia), tendini e ossa. Riducono dolore e infiammazione.',
  avvertenze:
    'Il rischio di rottura di un tendine aumenta se associati a fluorochinoloni; anche le infiltrazioni vicino ai tendini possono aumentarlo. Possono alzare glicemia e pressione.',
  livello: 1,
  etichette: [TENDINE, MASCHERA, OSSO]
}

const FLUOROCHINOLONI: Classe = {
  classe: 'Fluorochinolone (antibiotico)',
  usi: 'Infezioni batteriche (urinarie, respiratorie e altre).',
  info_fisio:
    'Rischio di tendinite e di rottura del tendine (soprattutto d’Achille), anche settimane dopo la fine della cura. Possibili dolori muscolari e articolari.',
  avvertenze:
    'Il rischio aumenta con corticosteroidi, età oltre i 60 anni e problemi ai reni. Dolore o gonfiore a un tendine durante o dopo la cura è un segnale da riferire al medico.',
  livello: 2,
  etichette: [TENDINE]
}

const STATINE: Classe = {
  classe: 'Statina',
  usi: 'Abbassare il colesterolo, prevenzione cardiovascolare.',
  info_fisio:
    'Dolore, crampi e debolezza muscolare sono effetti noti. Indica un quadro di rischio cardiovascolare.',
  avvertenze:
    'Raramente miopatia grave (rabdomiolisi): dolore muscolare diffuso con debolezza o urine scure va riferito al medico.',
  livello: 1,
  etichette: [TENDINE]
}

const ANTICOAGULANTI: Classe = {
  classe: 'Anticoagulante',
  usi: 'Prevenzione e cura di trombosi ed embolie; prevenzione dell’ictus nella fibrillazione atriale.',
  info_fisio:
    'Rischio di ematomi e sanguinamenti dopo traumi, trattamenti con pressione, manovre profonde o strumenti.',
  avvertenze: 'Un trauma o un ematoma che non si spiega meritano attenzione.',
  livello: 2,
  etichette: [EMORRAGICO]
}

const ANTIAGGREGANTI: Classe = {
  classe: 'Antiaggregante piastrinico',
  usi: 'Prevenzione di infarto e ictus, dopo stent o eventi cardiovascolari.',
  info_fisio:
    'Indica di solito una malattia cardiovascolare. Aumenta la tendenza a lividi ed ematomi.',
  avvertenze: 'Rischio di sanguinamento aumentato se associato ad anticoagulanti o FANS.',
  livello: 1,
  etichette: [EMORRAGICO, CUORE]
}

const BETABLOCCANTI: Classe = {
  classe: 'Beta-bloccante',
  usi: 'Ipertensione, angina, aritmie, scompenso cardiaco.',
  info_fisio:
    'Riducono la frequenza cardiaca a riposo e sotto sforzo: la frequenza cardiaca non misura bene l’intensità dello sforzo (più utile la scala dello sforzo percepito).',
  avvertenze: 'Possibili stanchezza e vertigini con i cambi di posizione.',
  livello: 1,
  etichette: [CUORE]
}

const MIORILASSANTI: Classe = {
  classe: 'Miorilassante',
  usi: 'Contratture e spasmi muscolari dolorosi.',
  info_fisio: 'Riducono il tono muscolare: possono falsare la valutazione di forza e rigidità.',
  avvertenze: 'Possibili sonnolenza e vertigini.',
  livello: 1,
  etichette: [EQUILIBRIO, MASCHERA]
}

const OPPIOIDI: Classe = {
  classe: 'Oppioide',
  usi: 'Dolore moderato o forte.',
  info_fisio:
    'Attenuano il dolore (può essere più basso di quello reale). Sonnolenza, vertigini e rallentamento dei riflessi: più rischio di cadute.',
  avvertenze: 'Con altri sedativi o alcol l’effetto sedativo aumenta. Possibile stipsi.',
  livello: 2,
  etichette: [MASCHERA, EQUILIBRIO]
}

const GABAPENTINOIDI: Classe = {
  classe: 'Gabapentinoide',
  usi: 'Dolore neuropatico, epilessia.',
  info_fisio:
    'Sonnolenza, vertigini e instabilità: attenzione a equilibrio e cadute. Attenuano il dolore neuropatico.',
  avvertenze: 'Con oppioidi o altri sedativi l’effetto sedativo aumenta. Possibile gonfiore alle gambe.',
  livello: 1,
  etichette: [EQUILIBRIO, MASCHERA]
}

const SSRI: Classe = {
  classe: 'Antidepressivo (SSRI)',
  usi: 'Depressione, ansia.',
  info_fisio:
    'Possibili vertigini e sonnolenza. Nell’uso prolungato è descritta un’associazione con minore densità ossea e più fratture.',
  avvertenze: '',
  livello: 1,
  etichette: [EQUILIBRIO, OSSO]
}

const BIFOSFONATI: Classe = {
  classe: 'Bifosfonato',
  usi: 'Osteoporosi.',
  info_fisio: 'Indica osteoporosi o bassa densità ossea.',
  avvertenze:
    'Raramente, con uso prolungato, dolore alla coscia o all’inguine (fratture atipiche del femore) e osteonecrosi della mandibola.',
  livello: 1,
  etichette: [OSSO]
}

const PPI: Classe = {
  classe: 'Inibitore di pompa protonica',
  usi: 'Protezione dello stomaco, reflusso, ulcera; spesso associati ai FANS.',
  info_fisio:
    'Spesso prescritto insieme a FANS o cortisonici. Con uso prolungato è descritta un’associazione con minore densità ossea.',
  avvertenze: 'Uso prolungato: possibile carenza di magnesio (crampi) e di vitamina B12.',
  livello: 0,
  etichette: [OSSO]
}

const ANTIPERTENSIVI: Classe = {
  classe: 'Antipertensivo',
  usi: 'Ipertensione.',
  info_fisio: 'Abbassano la pressione: possibili vertigini cambiando posizione o dopo lo sforzo.',
  avvertenze: '',
  livello: 1,
  etichette: [CUORE, EQUILIBRIO]
}

export const SCHEDE_INIZIALI: SchedaIniziale[] = [
  ...dalla(FANS, [
    ['Ibuprofene'],
    ['Diclofenac'],
    ['Naprossene'],
    ['Ketoprofene'],
    [
      'Nimesulide',
      { avvertenze: 'Possibile tossicità per il fegato: uso per periodi brevi. Possibili effetti su stomaco e reni.' }
    ],
    [
      'Etoricoxib',
      {
        classe: 'FANS (COX-2)',
        avvertenze: 'Può alzare la pressione. Meno effetti sullo stomaco, ma attenzione al cuore.',
        etichette: [MASCHERA, CUORE]
      }
    ]
  ]),
  {
    principio_attivo: 'Paracetamolo',
    classe: 'Analgesico e antipiretico',
    usi: 'Dolore lieve o moderato, febbre.',
    info_fisio: 'Attenua il dolore ma non è antinfiammatorio.',
    avvertenze: 'Dosi alte o prolungate possono danneggiare il fegato.',
    livello: 0,
    etichette: [MASCHERA]
  },
  {
    principio_attivo: 'Acido acetilsalicilico',
    classe: 'Antiaggregante / FANS',
    usi: 'Prevenzione cardiovascolare (dosi basse); dolore e febbre (dosi più alte).',
    info_fisio:
      'A dosi basse indica di solito una malattia cardiovascolare in cura. Aumenta la tendenza a lividi ed ematomi.',
    avvertenze: 'Rischio di sanguinamento aumentato se associato ad anticoagulanti o altri FANS.',
    livello: 1,
    etichette: [EMORRAGICO, CUORE]
  },
  ...dalla(CORTISONICI, [['Prednisone'], ['Metilprednisolone'], ['Betametasone']]),
  ...dalla(FLUOROCHINOLONI, [['Ciprofloxacina'], ['Levofloxacina'], ['Moxifloxacina']]),
  ...dalla(STATINE, [['Atorvastatina'], ['Simvastatina'], ['Rosuvastatina']]),
  ...dalla(ANTICOAGULANTI, [
    ['Warfarin', { avvertenze: 'Controllo periodico dell’INR. Molte interazioni con altri farmaci.' }],
    ['Rivaroxaban'],
    ['Apixaban'],
    ['Enoxaparina', { usi: 'Prevenzione e cura delle trombosi, spesso dopo interventi o immobilizzazione (iniezioni).' }]
  ]),
  ...dalla(ANTIAGGREGANTI, [['Clopidogrel'], ['Ticagrelor']]),
  ...dalla(BETABLOCCANTI, [['Bisoprololo'], ['Metoprololo'], ['Atenololo'], ['Nebivololo']]),
  ...dalla(ANTIPERTENSIVI, [
    ['Ramipril', { classe: 'ACE-inibitore', avvertenze: 'Può dare tosse secca persistente.' }],
    ['Amlodipina', { classe: 'Calcio-antagonista', avvertenze: 'Possibile gonfiore alle caviglie.' }],
    [
      'Furosemide',
      {
        classe: 'Diuretico',
        info_fisio:
          'Fa perdere liquidi e sali: possibili crampi, disidratazione con caldo e sudore, vertigini.',
        avvertenze: ''
      }
    ],
    [
      'Idroclorotiazide',
      {
        classe: 'Diuretico',
        info_fisio:
          'Fa perdere liquidi e sali: possibili crampi, disidratazione con caldo e sudore, vertigini.',
        avvertenze: ''
      }
    ]
  ]),
  ...dalla(MIORILASSANTI, [
    ['Tizanidina', { avvertenze: 'Possibili sonnolenza, vertigini e calo di pressione.' }],
    ['Tiocolchicoside'],
    [
      'Baclofene',
      { usi: 'Spasticità (per esempio da lesioni del sistema nervoso).', info_fisio: 'Riduce la spasticità: cambia il tono muscolare che si valuta.' }
    ]
  ]),
  ...dalla(OPPIOIDI, [
    [
      'Tramadolo',
      {
        livello: 1,
        avvertenze:
          'Può interagire con alcuni antidepressivi e abbassare la soglia per le crisi epilettiche. Possibili nausea e vertigini.'
      }
    ],
    ['Codeina', { livello: 1, usi: 'Dolore moderato, spesso in associazione al paracetamolo.' }],
    ['Ossicodone'],
    ['Morfina'],
    [
      'Fentanil',
      {
        avvertenze:
          'Se in cerotto: il calore sulla zona del cerotto (termoforo, lampade, diatermia) può aumentarne l’assorbimento.'
      }
    ]
  ]),
  ...dalla(GABAPENTINOIDI, [['Gabapentin'], ['Pregabalin', { usi: 'Dolore neuropatico, epilessia, ansia.' }]]),
  ...dalla(SSRI, [
    ['Sertralina'],
    ['Escitalopram'],
    [
      'Duloxetina',
      {
        classe: 'Antidepressivo (SNRI)',
        usi: 'Depressione, ansia, dolore neuropatico, fibromialgia.',
        avvertenze: 'Può alzare la pressione.',
        etichette: [EQUILIBRIO, OSSO, MASCHERA]
      }
    ],
    [
      'Amitriptilina',
      {
        classe: 'Antidepressivo (triciclico)',
        usi: 'Depressione, dolore neuropatico, prevenzione dell’emicrania.',
        info_fisio:
          'Sedazione e vertigini cambiando posizione (calo di pressione): più rischio di cadute. Nell’uso prolungato è descritta un’associazione con minore densità ossea e più fratture.',
        avvertenze: 'Bocca secca, stitichezza, battito accelerato.',
        etichette: [EQUILIBRIO, OSSO, MASCHERA]
      }
    ]
  ]),
  ...dalla(BIFOSFONATI, [['Acido alendronico'], ['Risedronato']]),
  ...dalla(PPI, [['Omeprazolo'], ['Pantoprazolo'], ['Esomeprazolo']]),
  {
    principio_attivo: 'Metformina',
    classe: 'Antidiabetico',
    usi: 'Diabete di tipo 2.',
    info_fisio:
      'Indica diabete: è associato a neuropatia periferica, guarigione più lenta e maggiore frequenza di problemi tendinei.',
    avvertenze: 'Da sola non dà di solito ipoglicemia.',
    livello: 0,
    etichette: []
  },
  {
    principio_attivo: 'Gliclazide',
    classe: 'Antidiabetico (sulfanilurea)',
    usi: 'Diabete di tipo 2.',
    info_fisio:
      'Può causare ipoglicemia, soprattutto con esercizio, digiuno o pasti saltati: sudore, tremori, confusione, debolezza.',
    avvertenze: '',
    livello: 1,
    etichette: [EQUILIBRIO]
  },
  {
    principio_attivo: 'Insulina',
    classe: 'Antidiabetico (insulina)',
    usi: 'Diabete.',
    info_fisio:
      'Rischio di ipoglicemia, soprattutto con esercizio, digiuno o pasti saltati: sudore, tremori, confusione, debolezza. Indica diabete: neuropatia periferica e guarigione più lenta.',
    avvertenze: '',
    livello: 2,
    etichette: [EQUILIBRIO]
  },
  {
    principio_attivo: 'Colecalciferolo',
    classe: 'Integratore (vitamina D)',
    usi: 'Carenza di vitamina D, salute delle ossa.',
    info_fisio: 'Spesso associato a osteopenia o osteoporosi, o a carenza accertata.',
    avvertenze: '',
    livello: 0,
    etichette: [OSSO]
  },
  {
    principio_attivo: 'Creatina',
    classe: 'Integratore sportivo',
    usi: 'Forza e potenza nello sport.',
    info_fisio: 'Può far aumentare il peso corporeo per ritenzione di liquidi.',
    avvertenze: '',
    livello: 0,
    etichette: []
  },
  {
    principio_attivo: 'Levotiroxina',
    classe: 'Ormone tiroideo',
    usi: 'Ipotiroidismo e altre malattie della tiroide.',
    info_fisio:
      'Indica una malattia della tiroide. Con dosi eccessive: battito accelerato, tremori, perdita di densità ossea.',
    avvertenze: '',
    livello: 0,
    etichette: [CUORE, OSSO]
  }
]

// Nomi commerciali comuni che l'elenco AIFA non contiene. Ogni riga e' un nome
// e il principio attivo (nelle associazioni, i principi separati da «+»).
export const NOMI_INIZIALI: [nome: string, principio: string][] = [
  ['Tachipirina', 'Paracetamolo'],
  ['Efferalgan', 'Paracetamolo'],
  ['Moment', 'Ibuprofene'],
  ['Nurofen', 'Ibuprofene'],
  ['Flector', 'Diclofenac'],
  ['Momendol', 'Naprossene'],
  ['Lipitor', 'Atorvastatina'],
  ['Zocor', 'Simvastatina'],
  ['Crestor', 'Rosuvastatina'],
  ['Coumadin', 'Warfarin'],
  ['Eliquis', 'Apixaban'],
  ['Clexane', 'Enoxaparina'],
  ['Aspirina', 'Acido acetilsalicilico'],
  ['Cardioaspirina', 'Acido acetilsalicilico'],
  ['Plavix', 'Clopidogrel'],
  ['Brilique', 'Ticagrelor'],
  ['Deltacortene', 'Prednisone'],
  ['Medrol', 'Metilprednisolone'],
  ['Bentelan', 'Betametasone'],
  ['Sirdalud', 'Tizanidina'],
  ['Muscoril', 'Tiocolchicoside'],
  ['Tramal', 'Tramadolo'],
  ['Oxycontin', 'Ossicodone'],
  ['Durogesic', 'Fentanil'],
  ['Neurontin', 'Gabapentin'],
  ['Laroxyl', 'Amitriptilina'],
  ['Cymbalta', 'Duloxetina'],
  ['Zoloft', 'Sertralina'],
  ['Cipralex', 'Escitalopram'],
  ['Fosamax', 'Acido alendronico'],
  ['Actonel', 'Risedronato'],
  ['Mopral', 'Omeprazolo'],
  ['Peptazol', 'Pantoprazolo'],
  ['Nexium', 'Esomeprazolo'],
  ['Glucophage', 'Metformina'],
  ['Diamicron', 'Gliclazide'],
  ['Lantus', 'Insulina'],
  ['Levemir', 'Insulina'],
  ['Tresiba', 'Insulina'],
  ['Toujeo', 'Insulina'],
  ['Humalog', 'Insulina'],
  ['Novorapid', 'Insulina'],
  ['Dibase', 'Colecalciferolo'],
  ['Norvasc', 'Amlodipina'],
  ['Lasix', 'Furosemide'],
  ['Triatec', 'Ramipril'],
  ['Congescor', 'Bisoprololo'],
  ['Seloken', 'Metoprololo'],
  ['Tenormin', 'Atenololo'],
  ['Nebilox', 'Nebivololo'],
  ['Eutirox', 'Levotiroxina']
]

// Parole che coincidono con altre di uso comune: non si sottolineano mai (la
// lista si cambia da Configurazione → Farmaci). Alcune sono nomi di prodotti
// dell'elenco AIFA, altre prime parole di nomi di sali o integratori.
export const PAROLE_ESCLUSE_INIZIALI = [
  'acido',
  'acqua',
  'adrenalina',
  'alpha',
  'antunes',
  'aranda',
  'almeida',
  'betaina',
  'calcio',
  'calcium',
  'cerchio',
  'clever',
  'coral',
  'diane',
  'elan',
  'ermes',
  'ferro',
  'fulcro',
  'giant',
  'gladio',
  'glamor',
  'glucosio',
  'gray',
  'homer',
  'lampard',
  'loss',
  'lura',
  'parvati',
  'performer',
  'quark',
  'return',
  'sarasvati',
  'sodio',
  'stadium',
  'target',
  'twice',
  'winch'
]
