// I farmaci: tipi, riconoscimento dei nomi nel testo e lettura dell'elenco AIFA.
// Senza React e senza Electron, cosi' la pagina (che sottolinea mentre si scrive)
// e le prove usano la stessa funzione.
//
// Il database dei farmaci e' solo di consultazione: non decide se il paziente
// prende un farmaco ("non prende Brufen" si sottolinea lo stesso) e non da'
// consigli. Quello che si salva, nei pazienti, resta il testo come e' stato scritto.

// ---- tipi ----------------------------------------------------------------

export type LivelloAttenzione = 0 | 1 | 2
export type StatoScheda = 'bozza' | 'validata'

export const NOMI_LIVELLO: Record<LivelloAttenzione, string> = {
  0: 'Nessuna attenzione particolare',
  1: 'Da tenere presente',
  2: 'Alta attenzione'
}

export interface FarmacoEtichetta {
  id: number
  nome: string
  ordine: number
}

export interface FarmacoScheda {
  id: number
  principio_attivo: string
  classe: string | null
  usi: string | null
  info_fisio: string | null
  avvertenze: string | null
  livello: LivelloAttenzione
  fonte: string | null
  // AAAA-MM-GG
  data_revisione: string | null
  stato: StatoScheda
  // id delle etichette
  etichette: number[]
}

export type FarmacoSchedaInput = Omit<FarmacoScheda, 'id'> & { id?: number }

// Dove porta un nome riconosciuto: a una scheda, oppure solo a un principio
// attivo di cui non c'e' (ancora) la scheda.
export interface RefFarmaco {
  schedaId: number | null
  principio: string
}

export interface IndiceFarmaci {
  schede: FarmacoScheda[]
  etichette: FarmacoEtichetta[]
  // nome normalizzato -> dove porta (piu' voci = associazione di principi attivi)
  nomi: Record<string, RefFarmaco[]>
  // parole che non si sottolineano mai (normalizzate)
  escluse: string[]
}

export interface NomeCollegato {
  id: number
  nome: string
  scheda_id: number
  principio_attivo: string
}

export interface PazienteFarmaco {
  id: number
  paziente_id: number
  // come lo ha scritto chi compila ("Brufen")
  testo: string
  nota: string | null
}

export interface EsitoImportFarmaci {
  // nomi nuovi messi nell'indice
  nomiAggiunti: number
  // nomi che c'erano gia'
  nomiGiaPresenti: number
  principi: number
}

export interface StatoFarmaci {
  schede: number
  nomiAifa: number
  aifaImportatoIl: string | null
}

// ---- normalizzazione -----------------------------------------------------

// Minuscole e senza accenti: "Tachipirìna" e "tachipirina" sono la stessa parola.
export function normalizza(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

// Le parti del nome di un sale che non cambiano il principio attivo
// ("Tramadolo cloridrato" e' tramadolo).
const PAROLE_DEL_SALE = new Set([
  'cloridrato',
  'solfato',
  'sodico',
  'sodica',
  'potassico',
  'potassica',
  'medoxomil',
  'medoximil',
  'cilexetil',
  'mofetile',
  'fosfato',
  'bromuro',
  'maleato',
  'tartrato',
  'besilato',
  'diidrato',
  'anidro'
])

// La chiave con cui si confrontano i principi attivi fra loro: "Ossicodone
// (oxicodone) cloridrato" e "Ossicodone" sono la stessa.
export function chiavePrincipio(testo: string): string {
  const senzaTonde = normalizza(testo).replace(/\([^)]*\)/g, ' ')
  let parole = senzaTonde.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  parole = parole.filter((p) => !PAROLE_DEL_SALE.has(p))
  // "Sodio risedronato" / "Sodio ibandronato": il sodio e' il sale
  if (parole.length > 1 && parole[0] === 'sodio') parole = parole.slice(1)
  return parole.join(' ')
}

// "Amoxicillina + Acido clavulanico" -> due principi attivi.
export function dividiPrincipio(testo: string): { chiave: string; etichetta: string }[] {
  return testo
    .split(/\s*[+/]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ chiave: chiavePrincipio(p), etichetta: p.replace(/\s+/g, ' ') }))
    .filter((p) => p.chiave !== '')
}

// ---- riconoscimento nel testo -------------------------------------------

export interface FarmacoTrovato {
  // posizioni nel testo originale (fine esclusa)
  inizio: number
  fine: number
  testo: string
  refs: RefFarmaco[]
}

export interface IndiceDiRicerca {
  nomi: Map<string, RefFarmaco[]>
  escluse: Set<string>
  // quante parole al massimo ha un nome dell'indice (limite 4)
  maxParole: number
}

const MAX_PAROLE = 4
const MIN_LETTERE = 3

export function preparaRicerca(indice: Pick<IndiceFarmaci, 'nomi' | 'escluse'>): IndiceDiRicerca {
  const nomi = new Map<string, RefFarmaco[]>()
  let maxParole = 1
  for (const [nome, refs] of Object.entries(indice.nomi)) {
    nomi.set(nome, refs)
    const n = nome.split(' ').length
    if (n > maxParole) maxParole = n
  }
  return { nomi, escluse: new Set(indice.escluse), maxParole: Math.min(maxParole, MAX_PAROLE) }
}

interface Parola {
  inizio: number
  fine: number
  norm: string
}

const PAROLE = /[\p{L}\p{N}]+/gu

// Trova i nomi di farmaci in un testo: parola intera, senza maiuscole e accenti.
// "Brufen 600" -> "Brufen" (i numeri accanto non contano); i nomi di piu' parole
// ("Augmentin duo") valgono solo se le parole sono vicine, separate da spazi.
// Il costo e' una ricerca nell'indice per parola: niente di pesante.
export function trovaFarmaci(testo: string, ricerca: IndiceDiRicerca): FarmacoTrovato[] {
  if (!testo || ricerca.nomi.size === 0) return []
  const parole: Parola[] = []
  for (const m of testo.matchAll(PAROLE)) {
    parole.push({ inizio: m.index, fine: m.index + m[0].length, norm: normalizza(m[0]) })
  }
  const trovati: FarmacoTrovato[] = []
  let i = 0
  while (i < parole.length) {
    let preso = false
    const massimo = Math.min(ricerca.maxParole, parole.length - i)
    for (let n = massimo; n >= 1 && !preso; n--) {
      const gruppo = parole.slice(i, i + n)
      if (n > 1 && !vicine(testo, gruppo)) continue
      const chiave = gruppo.map((p) => p.norm).join(' ')
      if (n === 1 && (chiave.length < MIN_LETTERE || /^\p{N}+$/u.test(chiave))) continue
      if (ricerca.escluse.has(chiave)) continue
      const refs = ricerca.nomi.get(chiave)
      if (!refs) continue
      trovati.push({
        inizio: gruppo[0].inizio,
        fine: gruppo[n - 1].fine,
        testo: testo.slice(gruppo[0].inizio, gruppo[n - 1].fine),
        refs
      })
      i += n
      preso = true
    }
    if (preso) continue
    // "Brufen600" attaccato: si guardano le lettere, senza i numeri in coda
    const p = parole[i]
    const attaccato = /^(\p{L}{4,})\p{N}+$/u.exec(p.norm)
    if (attaccato && !ricerca.escluse.has(attaccato[1])) {
      const refs = ricerca.nomi.get(attaccato[1])
      if (refs) {
        trovati.push({
          inizio: p.inizio,
          fine: p.inizio + attaccato[1].length,
          testo: testo.slice(p.inizio, p.inizio + attaccato[1].length),
          refs
        })
      }
    }
    i++
  }
  return trovati
}

// Le parole di un nome in piu' parole devono stare una accanto all'altra,
// separate solo da spazi (non da virgole o punti).
function vicine(testo: string, gruppo: Parola[]): boolean {
  for (let k = 1; k < gruppo.length; k++) {
    const tra = testo.slice(gruppo[k - 1].fine, gruppo[k].inizio)
    if (!/^[ \t ]{1,3}$/.test(tra)) return false
  }
  return true
}

// ---- elenco AIFA -----------------------------------------------------------

export interface VoceAifa {
  // nome commerciale, come sta nell'elenco
  nome: string
  // principio attivo, come sta nell'elenco
  principio: string
}

export interface RisultatoLetturaAifa {
  voci: VoceAifa[]
}

// Il file e' quasi sempre in Windows-1252 (l'euro e le lettere accentate): se
// non e' UTF-8 valido si legge cosi'.
export function decodificaTesto(byte: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(byte).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(byte)
  }
}

// CSV con il punto e virgola e le virgolette doppie ("" dentro un campo).
export function leggiCsv(testo: string, separatore = ';'): string[][] {
  const righe: string[][] = []
  let riga: string[] = []
  let campo = ''
  let tra = false
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i]
    if (tra) {
      if (c === '"') {
        if (testo[i + 1] === '"') {
          campo += '"'
          i++
        } else tra = false
      } else campo += c
    } else if (c === '"') tra = true
    else if (c === separatore) {
      riga.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && testo[i + 1] === '\n') i++
      riga.push(campo)
      campo = ''
      if (riga.some((x) => x !== '')) righe.push(riga)
      riga = []
    } else campo += c
  }
  riga.push(campo)
  if (riga.some((x) => x !== '')) righe.push(riga)
  return righe
}

export function leggiListaAifa(byte: Uint8Array): RisultatoLetturaAifa {
  const righe = leggiCsv(decodificaTesto(byte))
  if (righe.length < 2) throw new Error('Il file è vuoto: scegli il CSV della lista di trasparenza AIFA.')
  const testa = righe[0].map((x) => normalizza(x).trim())
  const colPrincipio = testa.findIndex((x) => x === 'principio attivo')
  const colNome = testa.findIndex((x) => x === 'farmaco')
  if (colPrincipio < 0 || colNome < 0) {
    throw new Error(
      'Questo file non sembra la lista di trasparenza AIFA in CSV (mancano le colonne «Principio attivo» e «Farmaco»). Scarica il CSV dalla pagina Liste di trasparenza.'
    )
  }
  const viste = new Set<string>()
  const voci: VoceAifa[] = []
  for (const r of righe.slice(1)) {
    const nome = (r[colNome] ?? '').replace(/\s+/g, ' ').trim()
    const principio = (r[colPrincipio] ?? '').replace(/\s+/g, ' ').trim()
    if (!nome || !principio) continue
    const k = `${nome}\u0000${principio}`
    if (viste.has(k)) continue
    viste.add(k)
    voci.push({ nome, principio })
  }
  return { voci }
}

export interface NomeDaIndicizzare {
  nome_norm: string
  principio: string
}

// Dalle righe dell'elenco ai nomi dell'indice.
//  - i generici ("IBUPROFENE ABC") non servono: il principio attivo si riconosce
//    gia' da solo;
//  - un nome commerciale di piu' parole ("ALPHA D3") vale anche con la prima
//    parola sola ("Alpha"), se tutti i nomi che iniziano cosi' portano allo
//    stesso principio attivo.
export function nomiDaElenco(voci: VoceAifa[]): NomeDaIndicizzare[] {
  const fuori: NomeDaIndicizzare[] = []
  const primeParole = new Map<string, Set<string>>()
  const interi = new Set<string>()
  // le prime parole dei principi attivi ("acido", "calcio"): non sono nomi
  // commerciali e non si riconoscono da sole
  const primeDeiPrincipi = new Set<string>()
  for (const v of voci) {
    for (const p of dividiPrincipio(v.principio)) primeDeiPrincipi.add(p.chiave.split(' ')[0])
  }
  for (const v of voci) {
    const nome = parolePulite(v.nome)
    if (nome.length === 0) continue
    const parti = dividiPrincipio(v.principio)
    const primaDelPrincipio = new Set(parti.map((p) => p.chiave.split(' ')[0]))
    // generico: inizia come il principio attivo
    if (primaDelPrincipio.has(nome[0])) continue
    const intero = nome.join(' ')
    interi.add(intero)
    fuori.push({ nome_norm: intero, principio: v.principio })
    if (nome.length > 1) {
      const set = primeParole.get(nome[0]) ?? new Set<string>()
      set.add(v.principio)
      primeParole.set(nome[0], set)
    }
  }
  for (const [prima, principi] of primeParole) {
    if (
      prima.length < 4 ||
      /^\p{N}/u.test(prima) ||
      interi.has(prima) ||
      primeDeiPrincipi.has(prima) ||
      principi.size !== 1
    ) {
      continue
    }
    fuori.push({ nome_norm: prima, principio: [...principi][0] })
  }
  return fuori
}

function parolePulite(nome: string): string[] {
  return normalizza(nome)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

// ---- categorie -------------------------------------------------------------

// La «classe» di una scheda e' testo libero ("FANS (COX-2)", "Antidepressivo (SSRI)"):
// per l'elenco per categorie si raggruppa con queste regole, la prima che combacia
// vince (l'ordine conta: "Corticosteroide inalatorio" prima di "Corticosteroide").
// Una classe che non combacia con niente fa categoria a se', senza la parentesi.
const REGOLE_CATEGORIA: [RegExp, string][] = [
  [/aggregante/, 'Antiaggreganti'],
  [/anticoagulante/, 'Anticoagulanti'],
  [/fans|antinfiammatorio/, 'FANS'],
  [/analgesico|spasmolitico|anestetico locale/, 'Analgesici e spasmolitici'],
  [/oppioide/, 'Oppioidi'],
  [/miorilassante|antispastico|botulinica/, 'Miorilassanti e antispastici'],
  [/inalatorio|broncodilatatore|antiasmatico|antistaminico/, 'Respiro e allergie'],
  [/corticosteroide/, 'Corticosteroidi'],
  [/gabapentinoide|antiepilettico/, 'Antiepilettici e dolore neuropatico'],
  [/antidepressivo/, 'Antidepressivi'],
  [/benzodiazepina|ipnotico/, 'Ansiolitici e ipnotici'],
  [/antipsicotico/, 'Antipsicotici'],
  [/parkinson|dopamino/, 'Parkinson'],
  [/antidemenza/, 'Demenza'],
  [/beta-bloccante/, 'Beta-bloccanti'],
  [/antipertensivo|ace-inibitore|sartano|calcio-antagonista|diuretico/, 'Pressione e diuretici'],
  [/statina|ipolipemizzante/, 'Colesterolo'],
  [/glicoside|antiaritmico|nitrato/, 'Cuore'],
  [/bifosfonato|osteoporosi/, 'Osteoporosi'],
  [/antidiabetico/, 'Diabete'],
  [/tiroid/, 'Tiroide'],
  [/antibiotico|fluorochinolone/, 'Antibiotici'],
  [/antigottoso/, 'Gotta'],
  [/biologico|immunosoppressore|antireumatico/, 'Antireumatici'],
  [/aromatasi|antiestrogeno/, 'Terapie ormonali oncologiche'],
  [/antiartrosico|infiltrazione/, 'Articolazioni e artrosi'],
  [/triptano/, 'Emicrania'],
  [/inibitore di pompa|antiacido|procinetico|antidiarroico/, 'Stomaco e intestino'],
  [/alfa-bloccante|5-alfa|pde5/, 'Prostata e urologia'],
  [/contraccettivo/, 'Ormoni'],
  [/integratore/, 'Integratori']
]

export const CATEGORIA_SENZA_CLASSE = 'Senza classe'

export function categoriaFarmaco(classe: string | null | undefined): string {
  const c = (classe ?? '').trim()
  if (c === '') return CATEGORIA_SENZA_CLASSE
  const n = normalizza(c)
  for (const [regola, categoria] of REGOLE_CATEGORIA) if (regola.test(n)) return categoria
  const senzaTonde = c.replace(/\s*\([^)]*\)/g, '').trim()
  return senzaTonde === '' ? c : senzaTonde.charAt(0).toUpperCase() + senzaTonde.slice(1)
}

// Le schede per categoria, in ordine alfabetico; "Senza classe" in fondo.
export function raggruppaPerCategoria<T extends { classe: string | null }>(
  schede: T[]
): { categoria: string; schede: T[] }[] {
  const mappa = new Map<string, T[]>()
  for (const s of schede) {
    const k = categoriaFarmaco(s.classe)
    const lista = mappa.get(k)
    if (lista) lista.push(s)
    else mappa.set(k, [s])
  }
  return [...mappa.entries()]
    .map(([categoria, lista]) => ({ categoria, schede: lista }))
    .sort((a, b) => {
      if (a.categoria === CATEGORIA_SENZA_CLASSE) return 1
      if (b.categoria === CATEGORIA_SENZA_CLASSE) return -1
      return a.categoria.localeCompare(b.categoria, 'it')
    })
}
