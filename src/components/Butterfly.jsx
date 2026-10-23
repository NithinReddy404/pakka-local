import { useEffect, useRef } from 'react'
import { BUTTERFLY } from '../scene.js'

const pct = (n) => `${n}%`
const WING = 'M17,12.5 C12,2 2.5,0 1.2,5 C0,10.5 6,13.4 17,13.4 Z M17,13.6 C9,14.4 3,19.4 5,23.2 C7,26.4 13,21.4 17,14.6 Z'

function Wing({ side }) {
  return (
    <span className={`bfly-wing bfly-wing-${side}`}>
      <svg viewBox="0 0 17 26" aria-hidden="true" focusable="false" style={side === 'r' ? { transform: 'scaleX(-1)' } : undefined}>
        <path d={WING} fill="#ffbe1a" stroke="#141414" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M17,13 L6,5.5 M17,13 L8,19.5" stroke="#141414" strokeWidth="0.8" fill="none" opacity="0.8" />
        <circle cx="5" cy="5.8" r="1.5" fill="#141414" />
        <circle cx="6.6" cy="21.2" r="1.1" fill="#141414" />
        <path d="M2,6.5 C2.8,9.6 7,11.6 12,12.3" stroke="#fff3c4" strokeWidth="0.7" fill="none" opacity="0.7" />
      </svg>
    </span>
  )
}

/**
 * A yellow-and-black butterfly that loops a slow figure-eight around the menu board,
 * pausing on the board's top edge, with a tiny "click here for the full menu" bubble.
 * Butterfly and bubble open the menu on click; the board hotspot stays the keyboard
 * control, so this is aria-hidden. One WAAPI animation drives the path; the wings flap with
 * CSS (rotateY). Under reduced motion it sits still on the board's top edge.
 */
export default function Butterfly({ board, text, onOpen, reduce }) {
  const anchorRef = useRef(null)
  const flyRef = useRef(null)

  useEffect(() => {
    const anchor = anchorRef.current
    const fly = flyRef.current
    const layer = anchor.parentElement
    let anim = null
    const build = () => {
      anim?.cancel()
      const W = layer.clientWidth
      const H = layer.clientHeight
      const bw = (board.width / 100) * W
      const bh = (board.height / 100) * H
      const size = fly.firstElementChild?.offsetHeight || 26
      const perch = { x: 0, y: -bh / 2 - size / 2 + 3 }
      const at = (p) => ({ transform: `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)` })
      if (reduce) {
        fly.style.transform = at(perch).transform
        return
      }
      fly.style.transform = ''
      const R = BUTTERFLY.radius * bw
      const total = (BUTTERFLY.loopS + BUTTERFLY.perchS + 1.2) * 1000
      const perchEnd = (BUTTERFLY.perchS * 1000) / total
      const loopStart = perchEnd + 600 / total
      const loopEnd = 1 - 600 / total
      const frames = [
        { ...at(perch), offset: 0 },
        { ...at(perch), offset: perchEnd },
      ]
      const N = 36
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2
        const p = { x: R * Math.sin(t), y: -bh * 0.2 + R * 0.55 * Math.sin(2 * t) }
        frames.push({ ...at(p), offset: loopStart + (loopEnd - loopStart) * (i / N) })
      }
      frames.push({ ...at(perch), offset: 1 })
      anim = fly.animate(frames, { duration: total, iterations: Infinity, easing: 'linear' })
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(layer)
    return () => {
      ro.disconnect()
      anim?.cancel()
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
        <span className="bfly" onClick={onOpen}>
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
