// Modal helpers shared by the vendor dialogue and the menu panel.

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/** Keeps Tab / Shift+Tab inside `container`. Call from a keydown handler. */
export function trapTab(e, container) {
  if (e.key !== 'Tab' || !container) return
  const nodes = [...container.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0)
  if (nodes.length === 0) {
    e.preventDefault()
    return
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement
  if (!container.contains(active)) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

/**
 * Makes the page behind a modal inert and locks body scroll. Returns the undo function,
 * which also puts focus back on `returnTo`.
 */
export function lockPage(returnTo) {
  const root = document.getElementById('root')
  const prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  if (root) root.inert = true
  return () => {
    document.body.style.overflow = prevOverflow
    if (root) root.inert = false
    returnTo?.focus({ preventScroll: true })
  }
}
