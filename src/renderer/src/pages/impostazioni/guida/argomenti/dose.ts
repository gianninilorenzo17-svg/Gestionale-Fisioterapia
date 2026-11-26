import type { ArgomentoGuida } from '../modello'

export const dose: ArgomentoGuida = {
  id: 'dose',
  titolo: 'Dose per seduta e per settimana',
  breve: 'Cosa c’è in una seduta e cosa manca al minimo della fase',
  parole: [
    'pliometria',
    'contatti',
    'serie',
    'forza',
    'ipertrofia',
    'potenza',
    'eccentrica',
    'isometria',
    'volume',
    'carico',
    'modello',
    'rtp',
    'preparazione atletica',
    'sezioni',
    'obiettivo',
    'tipo',
    'da sistemare',
    'barretta',
    'avviso',
    'monopodalico',
    'settimana',
    'andamento',
    'grafico',
    'dolore',
    'sforzo'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'Mentre costruisci la seduta, il programma conta quello che ci metti (contatti di pliometria, serie, ripetizioni, secondi) e ti segnala **solo quello che manca** al minimo della fase. Sopra il minimo non dice niente. Serve solo a **programmare**: non entra in nessun documento.',
        'È già tutto pronto: tre modelli di dose, le sezioni e il tipo degli esercizi che il programma ha riconosciuto. A te resta **scegliere il modello di ogni fase**.'
      ]
    },
    {
      titolo: 'Il tipo di ogni esercizio',
      elementi: [
        'Ogni esercizio ha un **tipo**: **Rinforzo**, **Pliometria estensiva**, **Pliometria intensiva** oppure **Non conta**. Il muscolo principale è la sua categoria.',
        {
          passi: [
            'Apri la libreria: [[Configurazione > Libreria esercizi > Esercizi]].',
            'Se accanto alla ricerca c’è **Da sistemare**, premilo e scegli il tipo di ogni esercizio in elenco. Quando non ne resta nessuno il pulsante sparisce.',
            'Per cambiarlo dopo, apri l’esercizio con la matita e usa **Tipo (per la dose)**.'
          ]
        }
      ]
    },
    {
      titolo: 'Le sezioni e il loro obiettivo',
      elementi: [
        'Le sezioni si scrivono una volta in [[Configurazione > Libreria esercizi > Sezioni]], con le categorie che propongono e l’**Obiettivo**: Forza, Ipertrofia, Potenza, Eccentrica, Isometria, Pliometria o Non conta.',
        'L’obiettivo decide dove va il **rinforzo** che metti in quella sezione. La **pliometria** si conta ovunque, anche nel riscaldamento.',
        'Nella fase ([[Patologie e fasi > la fase > Struttura della seduta]]) le sezioni della libreria si **spuntano**; se te ne serve una che vale solo lì, usa **Sezione solo di questa fase**.',
        'In seduta una sezione aggiunta al volo ha il pulsante **Scegli obiettivo**: finché non lo scegli, il suo rinforzo resta «senza obiettivo».'
      ]
    },
    {
      titolo: 'I modelli e le fasi',
      elementi: [
        {
          passi: [
            'Apri [[Configurazione > Libreria esercizi > Dosi]].',
            'In **Il modello di ogni fase** scegli **RTP 1**, **RTP 2** o **Preparazione atletica** per ogni fase. Una fase senza modello conta e basta.',
            'Il modello di una fase si sceglie anche dalla sua linguetta **Dose**.'
          ]
        },
        'Nella stessa pagina i numeri dei modelli si cambiano: per ogni voce la dose **per seduta** (da – a), le volte **a settimana** e un’**indicazione** (percentuale, ripetizioni, RIR). Si salva uscendo dalla casella. Una voce senza numeri si conta ma non si giudica. Con **Nuovo modello** ne aggiungi altri.',
        'In **Preparazione atletica** potenza e pliometria intensiva sono **alternative**: raggiunta una, l’altra non si segnala (c’è la spunta sotto la tabella).'
      ]
    },
    {
      titolo: 'Cosa vedi in seduta',
      elementi: [
        'In cima alla seduta la ciambella **Lavoro di oggi** mostra com’è divisa, in percentuale sulle serie. Passando il mouse su una parte, per esempio **Forza**, si vede quanto va a ogni muscolo.',
        'Sopra gli esercizi c’è **una riga sola** con i numeri, per esempio «Plio int. 30 · Plio est. 90 · Forza 5 · −1».',
        {
          punti: [
            'I numeri sono **verdi** quando la dose è raggiunta, **arancioni** quando si è almeno a metà del minimo e **rossi** sotto la metà (nella vista Settimana il confronto è con la dose di tutta la settimana). Per esempio «Plio est. 20/80» sono 20 contatti su un minimo di 80; «Forza 5 · −1» vuol dire che a un muscolo manca una serie. Le voci non ancora messe compaiono a zero. Il segnale sparisce mentre scrivi, appena aggiungi quello che manca.',
            'Non compare se le **altre sedute della settimana** (fatte o programmate) hanno già raggiunto il minimo le volte chieste, voce per voce e muscolo per muscolo («2–3» vale 2).',
            'Passando il mouse su **Forza** o **Ipertrofia** si vede il dettaglio per muscolo.',
            'Cliccando la riga si apre il dettaglio sopra la scheda: **Seduta** (fatto, dose, cosa manca e com’è divisa) oppure **Settimana**.'
          ]
        },
        'A sinistra di ogni esercizio c’è una **barretta colorata**: dice in quale voce finisce. Cliccandola scegli un’eccezione per quella riga (per esempio contare uno squat come ipertrofia); la barretta prende il colore della voce scelta e sotto compare **Ripristina**.'
      ]
    },
    {
      titolo: 'Come si conta',
      elementi: [
        {
          punti: [
            '**Pliometria** = contatti: serie × cluster × ripetizioni. A **una gamba** si sommano le due (3 × 10 per gamba = 60).',
            '**Forza** e **ipertrofia** = serie, per muscolo principale. Un cluster 4 × (3 × 2) vale 4 serie.',
            '**Potenza** = serie in tutto.',
            '**Eccentrica** = ripetizioni in tutto.',
            '**Isometria massimale** = secondi in tutto: scrivi il tempo nelle ripetizioni (per esempio 5"). Le isometrie fuori da una sezione con obiettivo **Isometria** non si contano.',
            '**«8-10» conta come 8** (il primo numero).',
            'Un esercizio **solo per questa seduta** parte da **Non conta**: dal menu accanto al nome scegli in cosa contarlo (Forza, Potenza…). Non avendo una categoria, in forza e ipertrofia finisce sotto «altro».'
          ]
        }
      ]
    },
    {
      titolo: 'Il carico settimana per settimana',
      elementi: [
        'In [[Pazienti > il paziente > Percorso]] il riquadro **Carico settimana per settimana** mette in fila le settimane già fatte, dalla più recente, con i soli numeri: nessun confronto con la dose. Passando su forza e ipertrofia si vede il dettaglio per muscolo.',
        'Sopra la tabella ci sono due grafici sulle stesse settimane: il carico della voce scelta in **Nel grafico** e sotto **dolore** e **sforzo** medi da 0 a 10.',
        'Se nelle ultime tre settimane il dolore medio è salito ogni settimana (di almeno un punto in tutto) mentre una voce del carico cresceva, in cima compare un **avviso**.'
      ]
    },
    {
      titolo: 'Da ricordare',
      elementi: [
        {
          punti: [
            'Le sedute di una **fase al campo** non entrano nel conto (vedi **Patologie, fasi e distretti**).',
            'La settimana va da lunedì a domenica.',
            'La seduta ricorda il tipo degli esercizi e l’obiettivo delle sezioni: se poi li cambi in libreria, le sedute già salvate restano come erano.',
            'Lato operato e lato sano non si distinguono.'
          ]
        }
      ]
    }
  ]
}
