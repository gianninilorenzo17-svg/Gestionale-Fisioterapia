import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { trovaFarmaci, type FarmacoTrovato } from '../../../../shared/farmaci'
import { useFarmaci, type DatiFarmaci } from '../../farmaci'
import BollaFarmaco, { useBolla } from './BollaFarmaco'
import { apriSchedaFarmaco } from './SchedaFarmaco'

// Il campo di testo con i farmaci sottolineati.
//
// Il campo resta il <textarea> di prima (salvataggio, Invio, annulla, selezione,
// incolla: tutto com'era). Dietro c'e' un livello con lo stesso testo, trasparente,
// dove solo i nomi dei farmaci hanno la sottolineatura: cosi' il testo salvato e
// quello esportato sono sempre testo semplice, senza codici. La sottolineatura e'
// solo un suggerimento: il riconoscimento non capisce se il paziente prende o no il
// farmaco ("non prende Brufen" si sottolinea lo stesso).
//
// Il controllo parte quando si smette di scrivere per un istante, non a ogni tasto.
const ATTESA_CONTROLLO = 350

// Gli stili del campo che il livello dietro deve avere uguali, altrimenti le
// righe vanno a capo in punti diversi e la sottolineatura finisce fuori posto.
const STILI_COPIATI = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textTransform',
  'textIndent',
  'tabSize',
  'paddingTop',
  'paddingLeft',
  'paddingBottom',
  'borderTopWidth',
  'borderLeftWidth',
  'borderBottomWidth',
  'borderRightWidth',
  'borderRadius'
] as const

// Le sottolineature gia' trovate restano al loro posto mentre si scrive: quelle
// prima del punto modificato stanno ferme, quelle dopo si spostano, quella toccata
// sparisce finche' non si ricontrolla.
function rimappa(trovati: FarmacoTrovato[], vecchio: string, nuovo: string): FarmacoTrovato[] {
  if (vecchio === nuovo) return trovati
  let prefisso = 0
  const max = Math.min(vecchio.length, nuovo.length)
  while (prefisso < max && vecchio[prefisso] === nuovo[prefisso]) prefisso++
  let suffisso = 0
  while (
    suffisso < max - prefisso &&
    vecchio[vecchio.length - 1 - suffisso] === nuovo[nuovo.length - 1 - suffisso]
  ) {
    suffisso++
  }
  const delta = nuovo.length - vecchio.length
  const finePrefisso = prefisso
  const inizioSuffisso = vecchio.length - suffisso
  const fuori: FarmacoTrovato[] = []
  for (const t of trovati) {
    // una lettera attaccata subito prima o dopo cambia la parola: va ricontrollata
    if (t.fine < finePrefisso) fuori.push(t)
    else if (t.inizio > inizioSuffisso) fuori.push({ ...t, inizio: t.inizio + delta, fine: t.fine + delta })
  }
  return fuori
}

export default function TestoConFarmaci({
  value,
  onChange,
  ...resto
}: {
  value: string
  onChange: (e: { target: { value: string } }) => void
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>): React.JSX.Element {
  const dati = useFarmaci()
  // `per` = il testo per cui sono state calcolate le sottolineature, `perDati` = con
  // quale indice (cambia quando si collega un nome o si salva una scheda)
  const [trovati, setTrovati] = useState<{
    per: string
    lista: FarmacoTrovato[]
    perDati: DatiFarmaci | null
  }>({ per: '', lista: [], perDati: null })
  const sotto = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  const parole = useRef<(HTMLSpanElement | null)[]>([])
  const { bolla, mostra, nascondi, sullaBolla } = useBolla()
  const parolaCorrente = useRef<number | null>(null)

  // Il controllo: subito la prima volta o se cambia l'indice, dopo una pausa nella
  // scrittura se e' cambiato il testo.
  useEffect(() => {
    if (!dati) return
    const cambiatoTesto = trovati.per !== value
    if (!cambiatoTesto && trovati.perDati === dati) return
    const ricontrolla = (): void =>
      setTrovati({ per: value, lista: trovaFarmaci(value, dati.ricerca), perDati: dati })
    if (!cambiatoTesto || trovati.perDati !== dati) {
      ricontrolla()
      return
    }
    const t = setTimeout(ricontrolla, ATTESA_CONTROLLO)
    return () => clearTimeout(t)
  }, [value, dati, trovati])

  const visibili = useMemo(
    () => (trovati.per === value ? trovati.lista : rimappa(trovati.lista, trovati.per, value)),
    [trovati, value]
  )

  // Il livello dietro ha la stessa forma del campo.
  useLayoutEffect(() => {
    const ta = campo.current
    const dietro = sotto.current
    if (!ta || !dietro) return
    const st = getComputedStyle(ta)
    for (const k of STILI_COPIATI) dietro.style[k] = st[k]
    // la barra di scorrimento del campo restringe il testo: dietro si lascia lo stesso posto
    const barra = Math.max(
      0,
      ta.offsetWidth - ta.clientWidth - parseFloat(st.borderLeftWidth) - parseFloat(st.borderRightWidth)
    )
    dietro.style.paddingRight = `${parseFloat(st.paddingRight) + barra}px`
    dietro.scrollTop = ta.scrollTop
  })

  useEffect(() => {
    const ta = campo.current
    if (!ta || typeof ResizeObserver === 'undefined') return
    const o = new ResizeObserver(() => {
      if (sotto.current) sotto.current.scrollTop = ta.scrollTop
    })
    o.observe(ta)
    return () => o.disconnect()
  }, [])

  // Quale farmaco c'e' sotto il cursore: il livello dietro non prende il mouse,
  // quindi si guardano i rettangoli delle (poche) parole sottolineate.
  const sotto_il_cursore = (x: number, y: number): number | null => {
    for (let i = 0; i < visibili.length; i++) {
      const el = parole.current[i]
      if (!el) continue
      for (const r of Array.from(el.getClientRects())) {
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i
      }
    }
    return null
  }

  const sulMouse = (e: React.MouseEvent<HTMLTextAreaElement>): void => {
    if (visibili.length === 0) return
    const i = sotto_il_cursore(e.clientX, e.clientY)
    if (i === parolaCorrente.current) return
    parolaCorrente.current = i
    const el = i != null ? parole.current[i] : null
    if (i == null || !el) {
      nascondi()
      return
    }
    const r = el.getBoundingClientRect()
    mostra({
      refs: visibili[i].refs,
      rect: { left: r.left, top: r.top, bottom: r.bottom, right: r.right }
    })
  }

  const sulClic = (e: React.MouseEvent<HTMLTextAreaElement>): void => {
    if (visibili.length === 0) return
    const ta = e.currentTarget
    // trascinando per selezionare non si apre niente
    if (ta.selectionStart !== ta.selectionEnd) return
    const i = sotto_il_cursore(e.clientX, e.clientY)
    if (i != null) apriSchedaFarmaco(visibili[i].refs)
  }

  // I pezzi di testo: normale, farmaco, normale...
  const pezzi: React.ReactNode[] = []
  let da = 0
  visibili.forEach((t, i) => {
    if (t.inizio > da) pezzi.push(value.slice(da, t.inizio))
    pezzi.push(
      <span
        key={`${t.inizio}-${i}`}
        className="farmaco-sottolineato"
        ref={(el) => {
          parole.current[i] = el
        }}
      >
        {value.slice(t.inizio, t.fine)}
      </span>
    )
    da = t.fine
  })
  pezzi.push(value.slice(da))
  parole.current.length = visibili.length

  return (
    <div className="testo-farmaci">
      <div className="testo-farmaci-sotto" ref={sotto} aria-hidden="true">
        {pezzi}
        {'\n'}
      </div>
      <textarea
        {...resto}
        ref={campo}
        value={value}
        onChange={(e) => {
          nascondi()
          parolaCorrente.current = null
          onChange(e)
        }}
        onScroll={(e) => {
          if (sotto.current) sotto.current.scrollTop = e.currentTarget.scrollTop
          nascondi()
        }}
        onMouseMove={sulMouse}
        onMouseLeave={() => {
          parolaCorrente.current = null
          nascondi()
        }}
        onClick={sulClic}
      />
      {bolla && dati && (
        <BollaFarmaco
          stato={bolla}
          dati={dati}
          gestori={sullaBolla}
          onApri={() => apriSchedaFarmaco(bolla.refs)}
        />
      )}
    </div>
  )
}
