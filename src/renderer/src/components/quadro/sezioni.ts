// Le linguette della scheda del paziente e le parti di quelle lunghe: stanno qui
// perche' le usano sia la scheda sia il Quadro, che con un clic porta
// direttamente alla parte giusta (il riquadro del KOOS apre i Questionari, non
// la cima della Clinica).
export type SchedaAperta = 'quadro' | 'diario' | 'clinica' | 'pedana' | 'percorso'

export type SezioneClinica =
  | 'anamnesi'
  | 'bodychart'
  | 'questionari'
  | 'valutazione'
  | 'promemoria'
  | 'segni'

export type SezionePercorso =
  | 'fase'
  | 'obiettivi'
  | 'progressioni'
  | 'carico'
  | 'casa'
  | 'massimali'

export type Destinazione =
  | { scheda: 'quadro' | 'diario' | 'pedana' }
  | { scheda: 'clinica'; sezione?: SezioneClinica }
  | { scheda: 'percorso'; sezione?: SezionePercorso }
