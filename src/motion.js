// Small motion helpers shared by the scene, the vendor and the panels.
import { useEffect, useState } from 'react'

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

export const prefersReducedMotion = () => window.matchMedia(REDUCE_QUERY).matches

/** True while the visitor prefers reduced motion; re-renders only when the setting flips. */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia(REDUCE_QUERY)
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduce
}

/** Fine pointer with hover (a desktop mouse or trackpad). */
export const isDesktopPointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

/** Deterministic pseudo-random numbers (mulberry32), so particles land the same each load. */
export function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Pauses every running animation under `root` (WAAPI and CSS) and returns a function that
 * resumes exactly those. Finished animations are left alone so they never restart.
 */
export function pauseAnimations(root) {
  const list = (root === document ? document.getAnimations() : root.getAnimations({ subtree: true })).filter(
    (a) => a.playState === 'running',
  )
  list.forEach((a) => a.pause())
  return () => list.forEach((a) => a.playState === 'paused' && a.play())
}

/** Pause everything on the page while the tab is hidden. Returns the cleanup. */
export function pauseWhileHidden() {
  let resume = null
  const onVis = () => {
    if (document.hidden) {
      resume = pauseAnimations(document)
    } else if (resume) {
      resume()
      resume = null
    }
  }
  document.addEventListener('visibilitychange', onVis)
  return () => document.removeEventListener('visibilitychange', onVis)
}

/** Settles a WAAPI animation's end state into inline style, then drops the animation. */
export function commit(anim) {
  try {
    anim.commitStyles()
  } catch {
    /* element gone or not rendered */
  }
  anim.cancel()
}

export const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
