// Il colore di una sezione della scheda del paziente (a schermo e nel PDF).
// Si riconosce dal nome (riscaldamento, pliometria, forza...); le sezioni con
// altri nomi prendono i colori a turno, cosi' due sezioni di fila non sono uguali.
export type ColoreSezione = 'ambra' | 'blu' | 'verde' | 'viola'

export function coloreSezione(nome: string, indice: number): ColoreSezione {
  const n = nome.toLowerCase()
  if (/riscald/.test(n)) return 'ambra'
  if (/plio|salt|potenz|veloc/.test(n)) return 'blu'
  if (/rinforz|forza|muscol|palestra/.test(n)) return 'verde'
  if (/defatic|stretch|mobilit|allung|raffredd/.test(n)) return 'viola'
  return (['verde', 'blu', 'ambra', 'viola'] as const)[indice % 4]
}
