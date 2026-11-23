// Le date della settimana (lunedi' - domenica), usate dalla pagina della settimana
// e da chi la prepara in anticipo (precarico.ts).

export const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Il lunedi' della settimana in cui cade una data. getDay() da' 0 alla
// domenica: qui la settimana comincia di lunedi', come l'agenda.
export function lunediDi(d: Date): Date {
  const l = new Date(d)
  l.setHours(0, 0, 0, 0)
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7))
  return l
}

// La chiave con cui si tengono da parte le sedute di una settimana.
export const chiaveSettimana = (lunedi: Date): string => `settimana:${iso(lunedi)}`
