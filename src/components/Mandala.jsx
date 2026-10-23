// Dark-brown mandala ornament like the ones in the corners of the real menu board.
// Geometry is generated once at module load; the SVG is static.

const INK = '#4a2c10'

const petal = (r0, r1, w) => `M0,${-r0} Q${w},${-(r0 + r1) / 2} 0,${-r1} Q${-w},${-(r0 + r1) / 2} 0,${-r0} Z`
const ring = (n, fn) => Array.from({ length: n }, (_, i) => fn((360 / n) * i, i))

const INNER = ring(8, (a) => <path key={`i${a}`} d={petal(12, 36, 9)} transform={`rotate(${a})`} fill={INK} />)
const MID = ring(16, (a) => (
  <g key={`m${a}`} transform={`rotate(${a})`}>
    <path d={petal(42, 66, 10)} fill="none" stroke={INK} strokeWidth="2.4" />
    <path d={petal(47, 61, 4)} fill={INK} />
  </g>
))
const DOTS = ring(32, (a) => <circle key={`d${a}`} cx="0" cy="-71" r="2.2" fill={INK} transform={`rotate(${a})`} />)
const OUTER = ring(24, (a) => (
  <g key={`o${a}`} transform={`rotate(${a + 7.5})`}>
    <path d={petal(76, 98, 9)} fill={INK} />
    <path d={petal(80, 92, 3.5)} fill="#f3c63f" />
  </g>
))

export default function Mandala({ className }) {
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      {OUTER}
      {DOTS}
      <circle r="68" fill="none" stroke={INK} strokeWidth="1.6" />
      {MID}
      <circle r="40" fill="none" stroke={INK} strokeWidth="3" />
      {INNER}
      <circle r="12" fill="none" stroke={INK} strokeWidth="2.4" />
      <circle r="6" fill={INK} />
    </svg>
  )
}
