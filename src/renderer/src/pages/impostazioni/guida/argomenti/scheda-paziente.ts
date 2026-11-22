import type { ArgomentoGuida } from '../modello'

export const schedaPaziente: ArgomentoGuida = {
  id: 'scheda-paziente',
  titolo: 'Quadro del paziente e scorciatoie',
  breve: 'La prima pagina del paziente, i tasti da 1 a 5 e gli elenchi di Clinica e Percorso',
  parole: [
    'quadro',
    'cruscotto',
    'panoramica',
    'dashboard',
    'tasti',
    'scorciatoie',
    'tastiera',
    'lsi',
    'questionario',
    'elenco',
    'indice',
    'dolore'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'Il **Quadro** è la prima linguetta che si apre quando entri in un paziente. Risponde a due domande: cosa stiamo facendo e a che punto è. Non c’è niente da scrivere: legge quello che hai già scritto altrove (sedute, fase, obiettivi, pedana, questionari, promemoria).'
      ]
    },
    {
      titolo: 'Cosa si vede',
      elementi: [
        {
          punti: [
            '**A che punto è**: le fasi del percorso con quella di adesso, da quanto tempo è in quella fase, le settimane dall’intervento e le sedute fatte. A destra gli **obiettivi della fase** con quanti sono raggiunti.',
            '**Ultima seduta**: la nota, il trattamento, gli esercizi principali, dolore e sforzo.',
            '**Progressioni**: a che step è ogni scala (solo se la fase ne ha).',
            '**Prossime sedute**: le sedute programmate e quante ne ha fatte questa settimana rispetto a quante ne deve fare.',
            '**Dolore**: l’ultimo valore segnato e com’è cambiato dall’inizio.',
            '**LSI più basso**: il test della pedana che oggi frena di più. Compare solo se il paziente ha test con il confronto fra i due lati. Il colore è solo un aiuto: verde da 90% in su, ambra fra 80% e 89%, rosso sotto l’80%.',
            'Un **questionario**: l’ultimo compilato, con la differenza dalla prima compilazione. Diventa verde o rosso solo se nel questionario hai scritto il cambiamento che conta (linguetta **Cambiamento**): senza, il numero si legge e basta.',
            '**Promemoria**: il più urgente, se ce ne sono ancora da fare.'
          ]
        },
        'Quello che il paziente non ha (la pedana, un questionario, i promemoria) non compare: niente riquadri vuoti.'
      ]
    },
    {
      titolo: 'Muoversi in fretta',
      elementi: [
        {
          punti: [
            'Ogni riquadro del Quadro si preme tutto intero e porta alla linguetta dove quella cosa si legge per esteso: il dolore al **Diario sedute**, l’LSI alla **Pedana**, il questionario ai **Questionari** della **Clinica**. L’ultima seduta si apre direttamente.',
            'I tasti **1**, **2**, **3**, **4**, **5** cambiano linguetta nell’ordine: Quadro, Diario sedute, Clinica, Pedana, Percorso. Non scattano mentre scrivi in una casella o hai una finestra aperta.',
            'In **Clinica** e in **Percorso** a sinistra c’è un elenco con una voce per ogni parte (per esempio Anamnesi, Body chart, Questionari, Promemoria). Sotto ogni voce c’è scritto cosa c’è dentro, per esempio «3 · KOOS 16 nov» o «1 scaduto». Premi una voce e a destra compare quella parte. Le voci vuote stanno in fondo, in grigio: si aprono lo stesso per scrivere la prima cosa.'
          ]
        }
      ]
    },
    {
      titolo: 'Da ricordare',
      elementi: [
        {
          punti: [
            'La **Body chart** ha una parte sua nella **Clinica**: si crea con il pulsante **Nuova**.',
            'Il dolore dal Quadro mette insieme il dolore segnato in fondo alle sedute e i punti del grafico dall’esordio nell’anamnesi.',
            'Il Quadro, come il resto della scheda, non compare mai nei documenti stampati.'
          ]
        }
      ]
    }
  ]
}
