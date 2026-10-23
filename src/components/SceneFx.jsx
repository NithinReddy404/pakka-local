import { useEffect, useRef, useState } from 'react'
import { BIRDS, CLOUDS, DUST, LIGHTS } from '../scene.js'
import { seeded } from '../motion.js'

const pct = (n) => `${n}%`

/** Soft cloud sprites for one layer ("sky" or "haze"); CSS animations, no JS per frame. */
export function Clouds({ layer }) {
  return CLOUDS.filter((c) => c.layer === layer).map((c, i) => (
    <div
      key={i}
      className="cloud-track"
      aria-hidden="true"
      style={{
        top: pct(c.y),
        height: pct(c.height),
        '--w': pct(c.width),
        '--o': c.opacity,
        '--travel': pct(100 + c.width),
        '--rest': pct(c.rest + c.width),
        animationDuration: `${c.duration}s`,
        animationDelay: `${c.delay}s`,
      }}
    >
      <div className="cloud" />
    </div>
  ))
}

/** Sunset glow behind the right-hand trees: breathes between .35 and .55 (CSS). */
export function SunsetGlow() {
  const s = LIGHTS.sunset
  return (
    <div
      className="sunset"
      aria-hidden="true"
      style={{ left: pct(s.x - s.width / 2), top: pct(s.y - s.height / 2), width: pct(s.width), height: pct(s.height) }}
    />
  )
}

const BIRD_FRAMES = [
  'M0,4 Q5,0 10,5 Q15,0 20,4 Q15,2 10,7 Q5,2 0,4 Z',
  'M0,5 Q5,3 10,5 Q15,3 20,5 Q15,4.6 10,6.6 Q5,4.6 0,5 Z',
  'M1,3 Q5,7 10,5 Q15,7 19,3 Q15,8.6 10,6.6 Q5,8.6 1,3 Z',
]

function Bird({ style }) {
  return (
    <svg className="bird" viewBox="0 0 20 10" width="20" height="10" style={style} aria-hidden="true" focusable="false">
      {BIRD_FRAMES.map((d, i) => (
        <path key={i} d={d} className={`bird-f bird-f${i + 1}`} />
      ))}
    </svg>
  )
}

/**
 * Two birds cross the sky on a gentle arc every 25-45 s. One WAAPI animation per flight;
 * skipped while the tab is hidden or the scene is paused (`pausedRef`).
 */
export function Birds({ pausedRef, enabled }) {
  const flockRef = useRef(null)
  useEffect(() => {
    if (!enabled) return undefined
    const flock = flockRef.current
    const layer = flock.parentElement
    let timer = 0
    let anim = null
    const next = (first) => {
      const waitS = first ? 6 + Math.random() * 8 : BIRDS.waitMin + Math.random() * (BIRDS.waitMax - BIRDS.waitMin)
      timer = window.setTimeout(fly, waitS * 1000)
    }
    const fly = () => {
      if (document.hidden || pausedRef.current) {
        next(false)
        return
      }
      const W = layer.clientWidth
      const H = layer.clientHeight
      const p = (x, y) => `translate3d(${((x / 100) * W).toFixed(1)}px, ${((y / 100) * H).toFixed(1)}px, 0)`
      const midX = (BIRDS.from.x + BIRDS.to.x) / 2
      const flip = Math.random() < 0.5 // sometimes right to left
      const a = flip ? BIRDS.to : BIRDS.from
      const b = flip ? BIRDS.from : BIRDS.to
      flock.style.setProperty('--dir', flip ? '-1' : '1')
      anim = flock.animate(
        [
          { transform: p(a.x, a.y), opacity: 1 },
          { transform: p((a.x + midX) / 2, (a.y + BIRDS.mid.y) / 2 - 1) },
          { transform: p(midX, BIRDS.mid.y) },
          { transform: p((b.x + midX) / 2, (b.y + BIRDS.mid.y) / 2 - 1) },
          { transform: p(b.x, b.y), opacity: 1 },
        ],
        { duration: BIRDS.flightS * 1000, easing: 'linear' },
      )
      anim.finished.catch(() => {}).then(() => next(false))
    }
    next(true)
    return () => {
      window.clearTimeout(timer)
      anim?.cancel()
    }
  }, [enabled, pausedRef])
  return (
    <div ref={flockRef} className="flock" aria-hidden="true">
      <Bird style={{ left: 0, top: 0 }} />
      <Bird style={{ left: '22px', top: '9px', animationDelay: '-0.2s', scale: '0.8' }} />
    </div>
  )
}

/** Faint steam wisps rising from the cart's glass food case (CSS loops). */
export function Steam() {
  const s = LIGHTS.steam
  return (
    <>
      <div className="steam" aria-hidden="true" style={{ left: pct(s.x), top: pct(s.y) }} />
      <div className="steam steam-2" aria-hidden="true" style={{ left: pct(s.x + 1.6), top: pct(s.y + 0.4) }} />
    </>
  )
}

/** Warm dust motes drifting over the gravel. Positions are seeded; motion is WAAPI only. */
export function Dust({ enabled, phone }) {
  const [motes] = useState(() => {
    const rnd = seeded(1750)
    return Array.from({ length: DUST.desktop }, () => ({
      x: 2 + rnd() * 96,
      y: DUST.yMin + rnd() * (DUST.yMax - DUST.yMin),
      size: 2 + rnd() * 3,
      opacity: 0.15 + rnd() * 0.2,
      dx: (rnd() - 0.5) * 60,
      dy: -10 - rnd() * 25,
      ms: 9000 + rnd() * 9000,
      delay: -rnd() * 9000,
    }))
  })
  const refs = useRef([])
  const count = phone ? DUST.phone : DUST.desktop
  useEffect(() => {
    if (!enabled) return undefined
    const anims = refs.current.slice(0, count).map((el, i) => {
      const m = motes[i]
      return el.animate(
        [
          { transform: 'translate3d(0,0,0)', opacity: 0 },
          { opacity: m.opacity, offset: 0.3 },
          { opacity: m.opacity, offset: 0.7 },
          { transform: `translate3d(${m.dx}px, ${m.dy}px, 0)`, opacity: 0 },
        ],
        { duration: m.ms, delay: m.delay, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
      )
    })
    return () => anims.forEach((a) => a.cancel())
  }, [enabled, count, motes])
  if (!enabled) return null
  return motes.slice(0, count).map((m, i) => (
    <span
      key={i}
      ref={(el) => {
        refs.current[i] = el
      }}
      className="mote"
      aria-hidden="true"
      style={{ left: pct(m.x), top: pct(m.y), width: `${m.size}px`, height: `${m.size}px` }}
    />
  ))
}

/**
 * SVG displacement filter for the tree cutouts (desktop only). The turbulence frequency is
 * nudged ~10 times a second by a timer instead of every frame, so the cost stays at ten
 * repaints of the tree pixels per second.
 */
export function TreeFilter({ enabled, pausedRef }) {
  const turbRef = useRef(null)
  useEffect(() => {
    if (!enabled) return undefined
    const t0 = performance.now()
    const id = window.setInterval(() => {
      if (document.hidden || pausedRef.current) return
      const t = (performance.now() - t0) / 1000
      const f = 0.012 + 0.0009 * Math.sin((t * 2 * Math.PI) / 9)
      const g = 0.012 + 0.0007 * Math.cos((t * 2 * Math.PI) / 13)
      turbRef.current?.setAttribute('baseFrequency', `${f.toFixed(5)} ${g.toFixed(5)}`)
    }, 100)
    return () => window.clearInterval(id)
  }, [enabled, pausedRef])
  return (
    <svg className="fx-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <filter id="tree-sway" x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
        <feTurbulence ref={turbRef} type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
