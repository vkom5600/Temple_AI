// Temple artwork, drawn in code (no image files) so it takes the colour of whatever
// it sits on (currentColor) and can be faded with CSS opacity.
//   <Gopuram />  a temple gateway tower, used faded in the background
//   <Mandala />  the slowly turning circle in the day banners
// The garland strip along the top of banners (.toran) is pure CSS, in styles.css.

const CX = 100 // centre line of the tower

// One storey: a body with a wider ledge underneath, and arched niches cut into it.
function storey(i: number) {
  const half = 28 + i * 6 // half-width grows as we go down
  const top = 64 + i * 22
  const ledge = top + 18
  const bottom = ledge + 4
  const outline = `M${CX - half} ${top}H${CX + half}V${ledge}H${CX + half + 4}V${bottom}H${CX - half - 4}V${ledge}H${CX - half}Z`

  const count = 1 + 2 * Math.floor(i / 2)
  const step = (2 * half) / (count + 1)
  const niches = Array.from({ length: count }, (_, k) => {
    const x = CX - half + step * (k + 1)
    return `M${x - 2.5} ${ledge - 3}V${top + 7}Q${x - 2.5} ${top + 4} ${x} ${top + 4}Q${x + 2.5} ${top + 4} ${x + 2.5} ${top + 7}V${ledge - 3}Z`
  })
  return [outline, ...niches].join('')
}

const STOREYS = Array.from({ length: 7 }, (_, i) => storey(i))
const BASE = `M30 218H170V256H176V262H24V256H30Z M88 262V236Q88 224 100 224Q112 224 112 236V262Z`
const CROWN = `M${CX - 31} 64C${CX - 31} 40 ${CX + 31} 40 ${CX + 31} 64Z`
const FINIALS = [CX - 17, CX, CX + 17].map((x) => {
  const base = x === CX ? 47 : 50
  return `M${x - 3.5} ${base}H${x + 3.5}V${base - 2}Q${x + 4.5} ${base - 7} ${x} ${base - 9}L${x} ${base - 18}L${x} ${base - 9}Q${x - 4.5} ${base - 7} ${x - 3.5} ${base - 2}Z`
})

export function Gopuram({ className = '' }: { className?: string }) {
  return (
    <svg className={`gopuram ${className}`} viewBox="0 0 200 262" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <path d={CROWN} />
        {FINIALS.map((d) => <path key={d} d={d} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />)}
        {STOREYS.map((d) => <path key={d} d={d} fillRule="evenodd" />)}
        <path d={BASE} fillRule="evenodd" />
      </g>
    </svg>
  )
}

export function Mandala({ className = '' }: { className?: string }) {
  const petals = (n: number, r: number, rx: number, ry: number) =>
    Array.from({ length: n }, (_, i) => (
      <ellipse key={`${r}-${i}`} cx="0" cy={-r} rx={rx} ry={ry} transform={`rotate(${(360 / n) * i})`} />
    ))
  return (
    <svg className={`mandala ${className}`} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle r="96" /><circle r="78" /><circle r="14" />
        {petals(16, 60, 10, 24)}
        {petals(8, 32, 9, 18)}
      </g>
    </svg>
  )
}

// A thin garland strip (marigolds and mango leaves) for the top edge of banners.
export const Toran = () => <div className="toran" aria-hidden="true" />
