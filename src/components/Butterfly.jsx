import { useEffect, useRef } from 'react'
import { BUTTERFLY } from '../scene.js'

const pct = (n) => `${n}%`

// One wing half, drawn for the LEFT side with the body at x = 40. The right wing is mirrored.
// Swallowtail silhouette: forewing on top, hindwing with a short tail below.
const FORE = 'M40,17 C36,7 24,0.5 11,3.2 C3.5,5 0.5,11 3,15.5 C6,20 16,22.6 27,22 C32,21.7 36,20.4 40,19.5 Z'
const HIND = 'M40,20.5 C34,22 26,23.6 18,27 C10,30.5 6,36 9,40.5 C11.5,43.6 16,42 20,39.5 C23,37.6 25.5,35 27.5,32.5 L26,40.5 L31.5,34.5 C35,31.5 38.5,27.5 40,23.5 Z'

function Wing({ side }) {
  return (
    <span className={`bfly-wing bfly-wing-${side}`}>
      <svg
        viewBox="0 0 40 44"
        aria-hidden="true"
        focusable="false"
        style={side === 'r' ? { transform: 'scaleX(-1)' } : undefined}
      >
        {/* black ground, yellow panels on top: a swallowtail's dark border and veins */}
        <path d={FORE} fill="#151515" />
        <path d={HIND} fill="#151515" />
        <path
          d="M39,17.6 C35.5,9.5 25,4 13,6 C7.5,7.2 4.5,11.2 6.2,14.6 C8.5,18.4 17,20.3 26.5,19.8 C31,19.6 35,18.6 39,18 Z"
          fill="#ffbe1a"
        />
        <path
          d="M39,21.2 C34,22.6 27,24.2 19.5,27.4 C13.5,30.2 10.5,34.4 12.6,37.6 C14.4,39.8 17.4,38.8 20.4,36.8 C23.6,34.6 26.4,31.6 28.6,29 C32.4,27.4 36.2,25 39,23 Z"
          fill="#f6a81c"
        />
        {/* veins */}
        <g stroke="#151515" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.9">
          <path d="M39,18 C31,16.5 22,13 13,7.5" />
          <path d="M39,18.4 C30,17.8 21,16.4 10,13" />
          <path d="M39,18.8 C31,19.2 22,19.4 11,17.6" />
          <path d="M39,22 C32,24 24,27 15,33" />
          <path d="M39,22.8 C33,26.4 27,30.6 22,37" />
        </g>
        {/* pale spots along the dark border */}
        <g fill="#fff3c9" opacity="0.92">
          <circle cx="8.6" cy="7.2" r="1.1" />
          <circle cx="4.6" cy="12.4" r="1" />
          <circle cx="7.4" cy="18.2" r="0.9" />
          <circle cx="11.2" cy="33.2" r="0.9" />
          <circle cx="16.6" cy="39.6" r="0.8" />
          <circle cx="22.4" cy="36.2" r="0.7" />
        </g>
        {/* blue eyespot on the hindwing, as on a tiger swallowtail */}
        <circle cx="25.8" cy="33.4" r="1.6" fill="#4f8fd6" opacity="0.85" />
      </svg>
    </span>
  )
}

/* Deterministic wander: a smooth closed spline through pseudo-random waypoints around the
   board, so the flight looks like a butterfly's drift rather than a geometric loop. */
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
function catmull(points, samples) {
  const n = points.length
  const out = []
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    for (let k = 0; k < samples; k++) {
      const t = k / samples
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  return out
}

/**
 * A yellow swallowtail that drifts around the menu board on a wandering path, banks into its
 * turns, bobs with each wingbeat, and settles on the board's top edge now and then with slow,
 * open-and-close wingbeats. The bubble ("click here for the full menu") rides with it but is
 * never rotated. Butterfly and bubble open the menu; the board hotspot remains the keyboard
 * control, so this is aria-hidden. Under reduced motion it perches still.
 */
export default function Butterfly({ board, text, onOpen, reduce }) {
  const anchorRef = useRef(null)
  const flyRef = useRef(null)
  const bodyRef = useRef(null)

  useEffect(() => {
    const anchor = anchorRef.current
    const fly = flyRef.current
    const bug = bodyRef.current
    const layer = anchor.parentElement
    let pathAnim = null
    let bankAnim = null
    let poll = 0

    const build = () => {
      pathAnim?.cancel()
      bankAnim?.cancel()
      window.clearInterval(poll)
      const W = layer.clientWidth
      const H = layer.clientHeight
      const bw = (board.width / 100) * W
      const bh = (board.height / 100) * H
      const size = bug.offsetHeight || 32
      const perch = { x: bw * 0.08, y: -bh / 2 - size * 0.42 }
      const at = (p) => `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`

      if (reduce) {
        fly.style.transform = at(perch)
        bug.dataset.perched = '1'
        return
      }
      fly.style.transform = ''

      // Waypoints: 7 stops around the board at varied distances and heights.
      const rnd = seeded(BUTTERFLY.seed)
      const R = BUTTERFLY.radius * bw
      const pts = []
      const K = 7
      for (let i = 0; i < K; i++) {
        const a = (i / K) * Math.PI * 2 + (rnd() - 0.5) * 0.6
        const r = R * (0.55 + rnd() * 0.9)
        pts.push({ x: Math.cos(a) * r, y: -bh * 0.35 + Math.sin(a) * r * 0.55 - rnd() * bh * 0.6 })
      }
      const spline = catmull(pts, 22)
      const N = spline.length

      const flyMs = BUTTERFLY.loopS * 1000
      const perchMs = BUTTERFLY.perchS * 1000
      const landMs = 900
      const total = perchMs + landMs + flyMs + landMs
      const t0 = perchMs / total
      const t1 = (perchMs + landMs) / total
      const t2 = (perchMs + landMs + flyMs) / total

      // Path frames: perch, take off to the spline start, wander, glide back, perch.
      const frames = [
        { transform: at(perch), offset: 0 },
        { transform: at(perch), offset: t0, easing: 'cubic-bezier(.3,0,.2,1)' },
      ]
      const banks = [
        { transform: 'rotate(0deg) scale(1)', offset: 0 },
        { transform: 'rotate(0deg) scale(1)', offset: t0 },
      ]
      for (let i = 0; i <= N; i++) {
        const p = spline[i % N]
        const q = spline[(i + 1) % N]
        const u = i / N
        // wingbeat bob and a little depth: higher in the frame reads as farther away
        const bob = Math.sin(u * flyMs * 0.0065) * 1.6
        const depth = 1 - Math.min(0.16, Math.max(0, (-p.y - bh * 0.4) / (R * 2.2)))
        const bank = Math.max(-22, Math.min(22, (q.x - p.x) * 2.2))
        const off = t1 + (t2 - t1) * u
        frames.push({ transform: at({ x: p.x, y: p.y + bob }), offset: off })
        banks.push({ transform: `rotate(${bank.toFixed(1)}deg) scale(${depth.toFixed(3)})`, offset: off })
      }
      frames.push({ transform: at(perch), offset: 1, easing: 'cubic-bezier(.4,0,.6,1)' })
      banks.push({ transform: 'rotate(0deg) scale(1)', offset: 1 })

      pathAnim = fly.animate(frames, { duration: total, iterations: Infinity, easing: 'linear' })
      bankAnim = bug.animate(banks, { duration: total, iterations: Infinity, easing: 'linear' })

      // Slow wingbeats while perched, fast ones in flight.
      poll = window.setInterval(() => {
        const t = (pathAnim.currentTime || 0) % total
        const perched = t < perchMs * 0.9 || t > total - landMs * 0.35
        if (bug.dataset.perched !== (perched ? '1' : '')) bug.dataset.perched = perched ? '1' : ''
      }, 120)
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(layer)
    return () => {
      ro.disconnect()
      pathAnim?.cancel()
      bankAnim?.cancel()
      window.clearInterval(poll)
    }
  }, [board, reduce])

  return (
    <span
      ref={anchorRef}
      className="bfly-anchor"
      style={{ left: pct(board.left + board.width / 2), top: pct(board.top + board.height / 2) }}
      aria-hidden="true"
    >
      <span ref={flyRef} className="bfly-fly">
        <span ref={bodyRef} className="bfly" onClick={onOpen}>
          <Wing side="l" />
          <Wing side="r" />
          <span className="bfly-body" />
        </span>
        <span className="bfly-bubble" onClick={onOpen}>
          {text}
        </span>
      </span>
    </span>
  )
}
