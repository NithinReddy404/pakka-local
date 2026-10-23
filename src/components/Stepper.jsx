import { memo, useEffect, useRef } from 'react'
import { fill, useI18n } from '../i18n.js'
import { orderStore, useCount } from '../orderStore.js'
import { prefersReducedMotion } from '../motion.js'

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * Quantity control for one order entry: a yellow "+ Add" pill at 0, then "− n +" and a
 * remove button. Subscribes to its own key only, so a change re-renders just this control;
 * only the number animates (a small transform pop), so rows never reflow.
 */
function Stepper({ entryKey, label }) {
  const { s } = useI18n()
  const n = useCount([entryKey])
  const numRef = useRef(null)
  const prev = useRef(n)

  useEffect(() => {
    if (n !== prev.current && n > 0 && prev.current > 0 && !prefersReducedMotion()) {
      numRef.current?.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' })
    }
    prev.current = n
  }, [n])

  if (n === 0) {
    return (
      <button type="button" className="step-add" aria-label={fill(s.addOne, { item: label })} onClick={() => orderStore.add(entryKey)}>
        <span aria-hidden="true">+</span> {s.add}
      </button>
    )
  }
  return (
    <span className="step">
      <button type="button" className="step-btn" aria-label={fill(s.removeOne, { item: label })} onClick={() => orderStore.dec(entryKey)}>
        −
      </button>
      <span ref={numRef} className="step-n" aria-live="polite">
        {n}
      </span>
      <button type="button" className="step-btn" aria-label={fill(s.addOne, { item: label })} onClick={() => orderStore.add(entryKey)}>
        +
      </button>
      <button type="button" className="step-del" aria-label={fill(s.removeItem, { item: label })} onClick={() => orderStore.remove(entryKey)}>
        <TrashIcon />
      </button>
    </span>
  )
}

export default memo(Stepper)
