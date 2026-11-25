// Con cosa parte la dose quando l'archivio si aggiorna (migrazione 79): il tipo
// di ogni esercizio gia' in libreria, le sezioni pronte con il loro obiettivo e
// l'obiettivo di quelle che c'erano gia'. Le regole sono quelle confermate dal
// fisioterapista; quello che non riconoscono resta vuoto ("Da sistemare").
import type { ObiettivoSezione, TipoEsercizio } from './dose'

const piano = (t: string | null | undefined): string =>
  (t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const SALTO = /\b(cmj|counter ?movement|salt[oi]|saltell|jumps?|hops?|hopping|slh|balz[oi])/
const NON_CONTA =
  /\b(pogo|plank|core|mobilit|stretching|allungament|equilibri|balance|propriocett|andatur|skip|corsa|running|sprint|agility|riscaldament|cambi\w* di direzione|change of direction|cod\b)/

// null = non si capisce: l'esercizio finisce in "Da sistemare".
export function tipoDiPartenza(
  nome: string,
  nomeAlternativo: string | null,
  categoria: string | null,
  categoriaPadre: string | null,
  contaCome: string | null
): TipoEsercizio | null {
  const n = piano(`${nome} ${nomeAlternativo ?? ''}`)
  const cat = piano(`${categoria ?? ''} ${categoriaPadre ?? ''}`)
  const zavorrato = /zavorr|weighted|sovraccaric|loaded/.test(n)

  // alzate olimpiche, squat jump zavorrato e Nordic sono rinforzo
  if (/\b(clean|snatch|jerk|girata|strappo|alzat\w* olimpic|high pull)/.test(n)) return 'rinforzo'
  if (zavorrato && /squat jump|jump squat|squat con salto/.test(n)) return 'rinforzo'
  if (/\bnordic/.test(n)) return 'rinforzo'

  // le isometrie sottomassimali non si contano; quelle massimali sono rinforzo
  if (/isometr/.test(n)) {
    if (/sotto ?massim|sub ?max|submassim/.test(n)) return 'non_conta'
    if (/massim|\bmax/.test(n)) return 'rinforzo'
  }

  // la pliometria detta dal nome
  if (SALTO.test(n)) {
    if (/\bpogo/.test(n)) return 'non_conta'
    if (/continu|rimbalz|ripetut/.test(n)) return 'plio_est'
    if (/drop jump|depth jump|salto in caduta|box jump/.test(n)) return 'plio_int'
    if (zavorrato) return 'plio_int'
    if (/massim|\bmax|singolo salto/.test(n)) return 'plio_int'
  }
  if (/drop jump|depth jump/.test(n)) return 'plio_int'

  if (NON_CONTA.test(n)) return 'non_conta'

  // quello che era gia' stato detto sulla categoria
  if (contaCome === 'plio_est' || contaCome === 'plio_int') return contaCome
  if (/plio/.test(cat) && /estensiv/.test(cat)) return 'plio_est'
  if (/plio/.test(cat) && /intensiv/.test(cat)) return 'plio_int'
  if (NON_CONTA.test(cat)) return 'non_conta'
  if (contaCome === 'forza' || contaCome === 'potenza') return 'rinforzo'
  return null
}

// L'obiettivo che dice il nome di una sezione; null = lo si sceglie a mano.
export function obiettivoDaNome(nome: string): ObiettivoSezione | null {
  const n = piano(nome)
  if (/plio/.test(n)) return 'pliometria'
  if (/riscald|defatic|mobilit|core|controllo|attivazion|equilibri|propriocett|stretch|distale/.test(n)) {
    return 'non_conta'
  }
  if (/isometri/.test(n)) return 'isometria'
  if (/eccentric/.test(n)) return 'eccentrica'
  if (/ipertrof/.test(n)) return 'ipertrofia'
  if (/potenz/.test(n)) return 'potenza'
  if (/forza|rinforz/.test(n)) return 'forza'
  return null
}

// Il nome di una sezione per riconoscerla (maiuscole e spazi non contano).
export const chiaveNome = (nome: string): string => nome.trim().toLowerCase()
